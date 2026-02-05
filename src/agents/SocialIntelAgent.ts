/**
 * Social Intel Agent
 *
 * Enhanced web search agent that uses LLM to parse unstructured
 * condition reports into structured data.
 *
 * @module agents/SocialIntelAgent
 */

import { BaseAgent, type AgentContext } from './BaseAgent';
import { LLMService } from '@/services/llm';
import {
  aiConfidence,
  searchConfidence,
  type DataConfidence,
  type WithConfidence,
} from '@/types/confidence';
import { getEdgeFunctionUrl, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Structured condition intel from social sources
 */
export interface StructuredIntel {
  /** Specific location mentioned */
  location: string;
  /** Snow type: puch, firn, szren, beton, cukier, kamienie */
  snow_type: string | null;
  /** Identified hazards */
  hazards: string[];
  /** Estimated report timestamp */
  timestamp: string;
  /** Overall sentiment: good, moderate, poor */
  conditions_rating: 'good' | 'moderate' | 'poor' | 'unknown';
  /** Key observations extracted */
  observations: string[];
  /** Original source URL */
  source_url: string;
  /** Source name */
  source_name: string;
  /** Raw snippet for reference */
  raw_snippet: string;
  /** Confidence metadata */
  confidence: DataConfidence;
}

/**
 * Social Intel input parameters
 */
export interface SocialIntelInput {
  /** Region to search */
  region: string;
  /** Specific locations to include */
  locations?: string[];
  /** Maximum results */
  limit?: number;
}

/**
 * LLM extraction prompt template (Polish)
 */
const EXTRACTION_PROMPT = `Analizujesz raport o warunkach skiturowych z Polski. Wyodrębnij informacje z tego tekstu.

TEKST DO ANALIZY:
"""
{title}
{snippet}
"""

Wyodrębnij dane w formacie JSON:
{
  "location": "nazwa góry/szlaku lub 'nieznane'",
  "snow_type": "jedno z: puch, firn, szreń, beton, cukier, kamienie, mokry, lub null jeśli nieznane",
  "hazards": ["lista zagrożeń: lawina, lód, mgła, wiatr, kamienie, itp."],
  "timestamp": "data ISO jeśli podana, lub 'recent' jeśli aktualne",
  "conditions_rating": "good (dobre), moderate (średnie), poor (słabe), lub unknown",
  "observations": ["2-3 kluczowe obserwacje z tekstu PO POLSKU"]
}

Odpowiedz TYLKO poprawnym JSON, bez wyjaśnień.`;

/**
 * Social Intel Agent - LLM-powered condition parsing
 */
export class SocialIntelAgent extends BaseAgent<SocialIntelInput, WithConfidence<StructuredIntel[]>> {
  constructor() {
    super({
      id: 'social-intel',
      name: 'Social Intel Agent',
      description: 'Parses unstructured web reports into structured condition data using LLM',
      cacheTtl: 30 * 60 * 1000, // 30 minutes
    });
  }

  protected async executeInternal(
    input: SocialIntelInput,
    context: AgentContext
  ): Promise<WithConfidence<StructuredIntel[]>> {
    this.log(`Gathering social intel for ${input.region}`);

    const { locations = [], limit = 5 } = input;
    const results: StructuredIntel[] = [];

    // Build search queries
    const queries = this.buildSearchQueries(input.region, locations);

    // Fetch search results
    const searchResults: Array<{ title: string; snippet: string; url: string; source: string }> = [];

    for (const query of queries.slice(0, 3)) {
      try {
        const queryResults = await this.searchDuckDuckGo(query, context.signal);
        searchResults.push(...queryResults);
      } catch (error) {
        this.warn(`Search failed for "${query}":`, error);
      }
    }

    // Deduplicate by URL
    const uniqueResults = this.deduplicateByUrl(searchResults);
    this.log(`Found ${uniqueResults.length} unique search results`);

    if (uniqueResults.length === 0) {
      return {
        data: [],
        confidence: {
          level: 'low',
          sourceType: 'search',
          sourceName: 'Social Intel (DuckDuckGo)',
          fetchedAt: new Date().toISOString(),
          notes: 'No search results found',
        },
      };
    }

    // Process each result with LLM if available
    const hasLLM = context.llmEnabled && isSupabaseConfigured();

    for (const result of uniqueResults.slice(0, limit)) {
      try {
        let intel: StructuredIntel;

        if (hasLLM && result.snippet.length > 30) {
          intel = await this.extractWithLLM(result, context);
        } else {
          intel = this.extractWithRegex(result);
        }

        results.push(intel);
      } catch (error) {
        this.warn(`Failed to process result from ${result.source}:`, error);
        // Still add with basic extraction
        results.push(this.extractWithRegex(result));
      }
    }

    return {
      data: results,
      confidence: {
        level: hasLLM ? 'medium' : 'low',
        sourceType: hasLLM ? 'ai_generated' : 'search',
        sourceName: `Social Intel (${hasLLM ? 'LLM-enhanced' : 'regex-based'})`,
        fetchedAt: new Date().toISOString(),
        notes: `Processed ${results.length} reports from web search`,
      },
    };
  }

  /**
   * Extract structured data using LLM
   */
  private async extractWithLLM(
    result: { title: string; snippet: string; url: string; source: string },
    context: AgentContext
  ): Promise<StructuredIntel> {
    const llm = new LLMService();

    const prompt = EXTRACTION_PROMPT
      .replace('{title}', result.title)
      .replace('{snippet}', result.snippet);

    try {
      const response = await llm.prompt(
        prompt,
        'Jesteś analitykiem warunków skiturowych. Wyodrębniasz dane z raportów. Odpowiadaj tylko poprawnym JSON.',
        { signal: context.signal }
      );

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const extracted = JSON.parse(jsonMatch[0]);

      return {
        location: extracted.location || 'Unknown',
        snow_type: this.normalizeSnowType(extracted.snow_type),
        hazards: Array.isArray(extracted.hazards) ? extracted.hazards : [],
        timestamp: this.normalizeTimestamp(extracted.timestamp),
        conditions_rating: this.normalizeRating(extracted.conditions_rating),
        observations: Array.isArray(extracted.observations) ? extracted.observations.slice(0, 3) : [],
        source_url: result.url,
        source_name: result.source,
        raw_snippet: result.snippet.slice(0, 200),
        confidence: aiConfidence(llm.getModel(), result.source),
      };
    } catch (error) {
      this.warn('LLM extraction failed, falling back to regex:', error);
      return this.extractWithRegex(result);
    }
  }

  /**
   * Extract structured data using regex patterns (fallback)
   */
  private extractWithRegex(
    result: { title: string; snippet: string; url: string; source: string }
  ): StructuredIntel {
    const text = `${result.title} ${result.snippet}`.toLowerCase();

    // Extract snow type
    const snowType = this.detectSnowType(text);

    // Extract hazards
    const hazards = this.detectHazards(text);

    // Extract location
    const location = this.detectLocation(text);

    // Determine rating from sentiment words
    const rating = this.detectRating(text);

    // Extract date if present
    const timestamp = this.extractDate(text);

    return {
      location,
      snow_type: snowType,
      hazards,
      timestamp,
      conditions_rating: rating,
      observations: [result.snippet.slice(0, 100)],
      source_url: result.url,
      source_name: result.source,
      raw_snippet: result.snippet.slice(0, 200),
      confidence: searchConfidence(result.source, timestamp, result.url),
    };
  }

  /**
   * Detect snow type from text
   */
  private detectSnowType(text: string): string | null {
    const patterns: [RegExp, string][] = [
      [/puch|powder|świeży śnieg|fresh snow/i, 'puch'],
      [/firn|corn|wiosenn/i, 'firn'],
      [/szreń|crust|skorup/i, 'szren'],
      [/beton|hard|tward|lód|ice|oblodz/i, 'beton'],
      [/cukier|sugar|granu/i, 'cukier'],
      [/kamien|rock|stone|skał/i, 'kamienie'],
      [/mokr|wet|wilgotn/i, 'mokry'],
    ];

    for (const [pattern, type] of patterns) {
      if (pattern.test(text)) return type;
    }
    return null;
  }

  /**
   * Detect hazards from text (Polish labels)
   */
  private detectHazards(text: string): string[] {
    const hazards: string[] = [];
    const patterns: [RegExp, string][] = [
      [/lawin|avalanche/i, 'ryzyko lawinowe'],
      [/lód|ice|oblodz/i, 'oblodzenie'],
      [/mgła|fog|zamglen/i, 'słaba widoczność'],
      [/wiatr|wind|halny/i, 'silny wiatr'],
      [/kamien|rock|skał/i, 'odsłonięte skały'],
      [/niebezp|danger|uwaga|warn/i, 'uwaga'],
    ];

    for (const [pattern, hazard] of patterns) {
      if (pattern.test(text) && !hazards.includes(hazard)) {
        hazards.push(hazard);
      }
    }
    return hazards;
  }

  /**
   * Detect location from text
   */
  private detectLocation(text: string): string {
    const locations = [
      'Skrzyczne', 'Pilsko', 'Rycerzowa', 'Barania Góra', 'Babia Góra',
      'Kasprowy', 'Rysy', 'Świnica', 'Tatry', 'Beskid', 'Szczyrk',
      'Hala Miziowa', 'Klimczok', 'Szyndzielnia', 'Romanka', 'Morskie Oko',
      'Hala Gąsienicowa', 'Kościelec', 'Zawrat', 'Błatnia',
    ];

    for (const loc of locations) {
      if (text.toLowerCase().includes(loc.toLowerCase())) {
        return loc;
      }
    }
    return 'Nieznana';
  }

  /**
   * Detect conditions rating from sentiment
   */
  private detectRating(text: string): 'good' | 'moderate' | 'poor' | 'unknown' {
    const goodWords = /świetn|doskonał|super|great|excellent|perfect|polecam|bajk|ideał/i;
    const poorWords = /złe|słab|niebezp|danger|bad|poor|avoid|odradzam|uwaga|ryzyko/i;

    if (goodWords.test(text)) return 'good';
    if (poorWords.test(text)) return 'poor';
    return 'moderate';
  }

  /**
   * Extract date from text
   */
  private extractDate(text: string): string {
    const patterns = [
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
      /(\d{4})-(\d{2})-(\d{2})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          if (pattern === patterns[0]) {
            return new Date(`${match[3]}-${match[2]}-${match[1]}`).toISOString();
          }
          return new Date(match[0]).toISOString();
        } catch {
          continue;
        }
      }
    }

    // Check for relative dates
    if (/dzisiaj|today/i.test(text)) return new Date().toISOString();
    if (/wczoraj|yesterday/i.test(text)) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString();
    }

    return new Date().toISOString();
  }

  /**
   * Normalize snow type from LLM output
   */
  private normalizeSnowType(type: string | null): string | null {
    if (!type) return null;
    const normalized = type.toLowerCase().trim();
    const valid = ['puch', 'firn', 'szren', 'beton', 'cukier', 'kamienie', 'mokry'];
    return valid.includes(normalized) ? normalized : null;
  }

  /**
   * Normalize timestamp from LLM output
   */
  private normalizeTimestamp(ts: string | null): string {
    if (!ts || ts === 'recent') return new Date().toISOString();
    try {
      return new Date(ts).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  /**
   * Normalize rating from LLM output
   */
  private normalizeRating(rating: string | null): 'good' | 'moderate' | 'poor' | 'unknown' {
    if (!rating) return 'unknown';
    const r = rating.toLowerCase();
    if (r === 'good') return 'good';
    if (r === 'moderate') return 'moderate';
    if (r === 'poor' || r === 'bad') return 'poor';
    return 'unknown';
  }

  /**
   * Build search queries
   */
  private buildSearchQueries(region: string, locations: string[]): string[] {
    const queries: string[] = [];
    const year = new Date().getFullYear();

    if (locations.length > 0 && locations.length <= 2) {
      for (const loc of locations) {
        queries.push(`${loc} warunki narciarskie ${year}`);
        queries.push(`${loc} skituring śnieg`);
      }
    } else {
      queries.push(`${region} warunki narciarskie ${year}`);
      queries.push(`${region} skituring warunki`);
      queries.push(`${region} śnieg zima ${year}`);
    }

    return queries;
  }

  /**
   * Search DuckDuckGo
   */
  private async searchDuckDuckGo(
    query: string,
    signal?: AbortSignal
  ): Promise<Array<{ title: string; snippet: string; url: string; source: string }>> {
    const encodedQuery = encodeURIComponent(query);

    // Use Edge Function in production, local proxy in development
    let url: string;
    if (isSupabaseConfigured()) {
      const edgeUrl = getEdgeFunctionUrl('search-proxy');
      url = `${edgeUrl}?q=${encodedQuery}`;
    } else {
      url = `/api/proxy/ddg/html/?q=${encodedQuery}`;
    }

    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Search failed: ${response.status}`);

    const html = await response.text();
    return this.parseSearchResults(html);
  }

  /**
   * Parse DuckDuckGo HTML
   */
  private parseSearchResults(html: string): Array<{ title: string; snippet: string; url: string; source: string }> {
    const results: Array<{ title: string; snippet: string; url: string; source: string }> = [];

    // Extract URLs and titles
    const linkPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
    const snippetPattern = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

    const urls: string[] = [];
    const titles: string[] = [];
    const snippets: string[] = [];

    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      const actualUrl = this.extractUrl(match[1]);
      if (actualUrl) {
        urls.push(actualUrl);
        titles.push(this.decodeHtml(match[2]));
      }
    }

    while ((match = snippetPattern.exec(html)) !== null) {
      snippets.push(this.decodeHtml(match[1]));
    }

    for (let i = 0; i < Math.min(urls.length, 10); i++) {
      try {
        results.push({
          title: titles[i] || 'Unknown',
          snippet: snippets[i] || '',
          url: urls[i],
          source: new URL(urls[i]).hostname.replace('www.', ''),
        });
      } catch {
        // Skip invalid URLs
      }
    }

    return results;
  }

  /**
   * Extract actual URL from DuckDuckGo redirect
   */
  private extractUrl(ddgUrl: string): string | null {
    try {
      if (ddgUrl.includes('uddg=')) {
        const match = ddgUrl.match(/uddg=([^&]*)/);
        if (match) return decodeURIComponent(match[1]);
      }
      if (ddgUrl.startsWith('http')) return ddgUrl;
      if (ddgUrl.startsWith('//')) return 'https:' + ddgUrl;
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Decode HTML entities
   */
  private decodeHtml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]*>/g, '');
  }

  /**
   * Deduplicate results by URL
   */
  private deduplicateByUrl<T extends { url: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
  }
}
