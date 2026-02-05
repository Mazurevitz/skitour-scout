/**
 * Web Search Agent
 *
 * Searches the web for recent ski touring condition reports.
 * Uses search APIs to find real, recent data.
 *
 * @module agents/WebSearchAgent
 */

import { BaseAgent, type AgentContext } from './BaseAgent';
import { LLMService } from '@/services/llm';
import {
  searchConfidence,
  aiConfidence,
  type DataConfidence,
  type WithConfidence,
} from '@/types/confidence';
import { getEdgeFunctionUrl, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Search result from web
 */
export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  date?: string;
  source: string;
}

/**
 * Processed condition report
 */
export interface ConditionReport {
  /** Summary of conditions */
  summary: string;
  /** Location mentioned */
  location: string;
  /** Date of report */
  reportDate: string;
  /** Original source URL */
  sourceUrl: string;
  /** Source name */
  sourceName: string;
  /** Extracted conditions */
  conditions: string[];
  /** Sentiment: positive, neutral, negative */
  sentiment: 'positive' | 'neutral' | 'negative';
  /** Confidence metadata */
  confidence: DataConfidence;
}

/**
 * Web search input
 */
export interface WebSearchInput {
  /** Region to search for */
  region: string;
  /** Specific locations to include */
  locations?: string[];
  /** Max results to return */
  limit?: number;
}

/**
 * Web Search Agent for finding real condition reports
 */
export class WebSearchAgent extends BaseAgent<WebSearchInput, WithConfidence<ConditionReport[]>> {
  constructor() {
    super({
      id: 'websearch',
      name: 'Web Search Agent',
      description: 'Searches for recent ski touring condition reports online',
      cacheTtl: 30 * 60 * 1000, // 30 minutes
    });
  }

  /**
   * Search for condition reports
   */
  protected async executeInternal(
    input: WebSearchInput,
    context: AgentContext
  ): Promise<WithConfidence<ConditionReport[]>> {
    this.log(`Searching for conditions in ${input.region}`);

    const { locations = [], limit = 5 } = input;

    // Build search queries - more queries for wider coverage
    const queries = this.buildSearchQueries(input.region, locations);
    this.log(`Search queries: ${queries.join(', ')}`);

    // Fetch search results from multiple queries in parallel for speed
    const allResults: SearchResult[] = [];
    const searchErrors: string[] = [];
    const queriesToRun = queries.slice(0, 5); // Run up to 5 queries

    const searchPromises = queriesToRun.map(async (query) => {
      try {
        const results = await this.searchDuckDuckGo(query, context.signal);
        this.log(`Query "${query}" returned ${results.length} results`);
        return results;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        searchErrors.push(`"${query}": ${msg}`);
        this.warn(`Search failed for "${query}":`, error);
        return [];
      }
    });

    const resultsArrays = await Promise.all(searchPromises);
    for (const results of resultsArrays) {
      allResults.push(...results);
    }

    // Deduplicate and filter by domain/content
    const uniqueResults = this.deduplicateResults(allResults);
    this.log(`Found ${uniqueResults.length} unique results after filtering`);

    // If no results from search, return empty with info about what was tried
    if (uniqueResults.length === 0) {
      this.log('No search results found');
      return {
        data: [],
        confidence: {
          level: 'low',
          sourceType: 'search',
          sourceName: 'Web Search (DuckDuckGo)',
          fetchedAt: new Date().toISOString(),
          notes: `No results found. Queries tried: ${queriesToRun.join(', ')}`,
        },
      };
    }

    // Score all results and take only the most relevant ones
    const scoredResults = uniqueResults
      .map(r => ({ result: r, score: this.scoreRelevance(r) }))
      .filter(r => r.score >= 3) // Minimum relevance threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, limit + 2); // Get a few extra for processing

    this.log(`Top ${scoredResults.length} results by relevance: ${scoredResults.map(r => `${r.result.source}(${r.score})`).join(', ')}`);

    // Process only the most relevant results
    const reports = await this.processResults(
      scoredResults.map(r => r.result).slice(0, limit),
      context
    );

    return {
      data: reports,
      confidence: {
        level: reports.length > 0 ? 'medium' : 'low',
        sourceType: 'search',
        sourceName: 'Web Search (DuckDuckGo)',
        fetchedAt: new Date().toISOString(),
        notes: `Found ${reports.length} reports from ${uniqueResults.length} search results`,
      },
    };
  }


  /**
   * Build search queries for the region
   * Wide coverage with varied query types
   */
  private buildSearchQueries(region: string, locations: string[]): string[] {
    const queries: string[] = [];

    // Get current date context
    const now = new Date();
    const monthNames = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
                        'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
    const currentMonth = monthNames[now.getMonth()];
    const year = now.getFullYear();

    // Also check previous month for recent reports
    const prevMonthIdx = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevMonth = monthNames[prevMonthIdx];

    // If we have specific locations (1-2), prioritize them
    if (locations.length <= 2 && locations.length > 0) {
      for (const location of locations) {
        queries.push(`"${location}" skituring relacja ${year}`);
        queries.push(`"${location}" narty skiturowe warunki ${currentMonth}`);
        queries.push(`${location} warunki śnieg ${year}`);
        queries.push(`${location} ski touring conditions`);
      }
    } else {
      // Region-wide search - multiple query strategies

      // 1. Current month ski touring reports
      queries.push(`${region} skituring relacja ${currentMonth} ${year}`);
      queries.push(`${region} skituring ${prevMonth} ${year}`);

      // 2. General ski touring conditions
      queries.push(`${region} narty skiturowe warunki ${year}`);
      queries.push(`${region} warunki śniegowe skituring`);

      // 3. Trip reports and blogs
      queries.push(`${region} relacja narciarska ${year}`);
      queries.push(`skituring ${region} blog`);

      // 4. Location-specific queries for top locations
      for (const location of locations.slice(0, 3)) {
        queries.push(`${location} skituring warunki ${year}`);
      }

      // 5. Forum discussions
      queries.push(`${region} warunki forum narciarskie`);
    }

    return queries;
  }

  /**
   * Domains to exclude (resorts, weather sites without conditions)
   */
  private readonly EXCLUDED_DOMAINS = [
    'booking.com',
    'tripadvisor',
    'nocowanie.pl',
    'gorace-zrodla.pl',
    'szczyrkowski.pl', // Resort, not touring
    'beskidsportarena.pl', // Resort
    'kotelnica.pl', // Resort
    'wikipedia.org',
    'facebook.com',
  ];

  /**
   * Search using DuckDuckGo HTML (no API key needed)
   */
  private async searchDuckDuckGo(
    query: string,
    signal?: AbortSignal
  ): Promise<SearchResult[]> {
    const encodedQuery = encodeURIComponent(query);

    // Use Edge Function in production, local proxy in development
    let url: string;
    if (isSupabaseConfigured()) {
      const edgeUrl = getEdgeFunctionUrl('search-proxy');
      url = `${edgeUrl}?q=${encodedQuery}`;
    } else {
      // Fallback to local proxy for development
      url = `/api/proxy/ddg/html/?q=${encodedQuery}`;
    }

    try {
      const response = await fetch(url, {
        signal,
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const html = await response.text();
      return this.parseDuckDuckGoResults(html);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      this.warn('DuckDuckGo search failed:', error);
      return [];
    }
  }

  /**
   * Parse DuckDuckGo HTML results
   */
  private parseDuckDuckGoResults(html: string): SearchResult[] {
    const results: SearchResult[] = [];

    // Try multiple parsing strategies as DuckDuckGo HTML varies

    // Strategy 1: Look for result__a class (classic format)
    const resultPattern1 = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;

    // Strategy 2: Look for result-link class
    const resultPattern2 = /<a[^>]*class="[^"]*result-link[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;

    // Strategy 3: Look for links with uddg parameter (DuckDuckGo redirect)
    const resultPattern3 = /<a[^>]*href="[^"]*uddg=([^"&]*)[^"]*"[^>]*>([^<]*)<\/a>/gi;

    const snippetPatterns = [
      /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
      /<span[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
      /<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    ];

    let match;
    const urls: string[] = [];
    const titles: string[] = [];
    const snippets: string[] = [];

    // Try all URL/title patterns
    for (const pattern of [resultPattern1, resultPattern2]) {
      while ((match = pattern.exec(html)) !== null) {
        const rawUrl = match[1];
        const actualUrl = this.extractActualUrl(rawUrl);
        if (actualUrl && !actualUrl.includes('duckduckgo.com')) {
          urls.push(actualUrl);
          titles.push(this.decodeHtmlEntities(match[2]));
        }
      }
    }

    // Try uddg pattern separately
    while ((match = resultPattern3.exec(html)) !== null) {
      try {
        const actualUrl = decodeURIComponent(match[1]);
        if (actualUrl.startsWith('http') && !actualUrl.includes('duckduckgo.com')) {
          urls.push(actualUrl);
          titles.push(this.decodeHtmlEntities(match[2]));
        }
      } catch {
        // Skip malformed URLs
      }
    }

    // Try all snippet patterns
    for (const pattern of snippetPatterns) {
      while ((match = pattern.exec(html)) !== null) {
        snippets.push(this.decodeHtmlEntities(match[1]));
      }
    }

    // Log for debugging
    this.log(`Parsed ${urls.length} URLs, ${snippets.length} snippets from HTML (${html.length} chars)`);

    // Combine into results
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
  private extractActualUrl(ddgUrl: string): string | null {
    try {
      // DuckDuckGo format: //duckduckgo.com/l/?uddg=ENCODED_URL
      if (ddgUrl.includes('uddg=')) {
        const match = ddgUrl.match(/uddg=([^&]*)/);
        if (match) {
          return decodeURIComponent(match[1]);
        }
      }
      // Direct URL
      if (ddgUrl.startsWith('http')) {
        return ddgUrl;
      }
      if (ddgUrl.startsWith('//')) {
        return 'https:' + ddgUrl;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Decode HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]*>/g, ''); // Strip any remaining HTML
  }

  /**
   * Deduplicate and filter results by URL
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter((r) => {
      // Skip duplicates
      if (seen.has(r.url)) return false;
      seen.add(r.url);

      // Filter out excluded domains
      const domain = r.source.toLowerCase();
      if (this.EXCLUDED_DOMAINS.some(ex => domain.includes(ex))) {
        this.log(`Filtered out: ${r.source} (excluded domain)`);
        return false;
      }

      // Filter out results that look like resort/lift status pages
      const lowerSnippet = r.snippet.toLowerCase();
      const lowerTitle = r.title.toLowerCase();
      const resortKeywords = ['wyciąg', 'kolej', 'gondola', 'karnet', 'cennik', 'naśnieżanie', 'ośrodek narciarski'];
      if (resortKeywords.some(kw => lowerSnippet.includes(kw) || lowerTitle.includes(kw))) {
        // Only filter if it doesn't also mention skituring
        if (!lowerSnippet.includes('skitur') && !lowerSnippet.includes('ski tour')) {
          this.log(`Filtered out: ${r.title} (resort info)`);
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Score result relevance for ski touring
   */
  private scoreRelevance(result: SearchResult): number {
    let score = 0;
    const text = (result.title + ' ' + result.snippet).toLowerCase();
    const source = result.source.toLowerCase();

    // High relevance keywords (ski touring specific) - +10 each
    const highRelevance = ['skituring', 'skitur', 'ski touring', 'narty skiturowe', 'foki', 'harszle', 'narciarstwo wysokogórskie'];
    for (const kw of highRelevance) {
      if (text.includes(kw)) score += 10;
    }

    // Medium relevance (trip reports, conditions) - +4 each
    const mediumRelevance = ['relacja', 'raport', 'warunki', 'podejście', 'zjazd', 'trasa', 'wycieczka'];
    for (const kw of mediumRelevance) {
      if (text.includes(kw)) score += 4;
    }

    // Snow/conditions keywords - +2 each
    const snowKeywords = ['śnieg', 'puch', 'firn', 'pokrywa', 'lawina', 'szczyt', 'grań'];
    for (const kw of snowKeywords) {
      if (text.includes(kw)) score += 2;
    }

    // Good sources (ski touring blogs/forums) - +8
    const goodSources = ['skitury.pl', 'skiturowe', 'tatromaniak', 'wspinanie', 'wgory', 'gory', 'bergzeit', 'powderline'];
    for (const src of goodSources) {
      if (source.includes(src)) score += 8;
    }

    // Recent date mentioned - +3
    const year = new Date().getFullYear();
    if (text.includes(String(year))) score += 3;
    if (text.includes(String(year - 1))) score += 1; // Last year still somewhat relevant

    // Negative signals (reduce score)
    const badKeywords = ['hotel', 'nocleg', 'rezerwacja', 'apartament', 'spa', 'basen'];
    for (const kw of badKeywords) {
      if (text.includes(kw)) score -= 5;
    }

    return score;
  }

  /**
   * Process search results into condition reports
   * Results are already sorted by relevance from executeInternal
   */
  private async processResults(
    results: SearchResult[],
    context: AgentContext
  ): Promise<ConditionReport[]> {
    const reports: ConditionReport[] = [];

    for (const result of results) {
      // Try to extract date from snippet or use current
      const reportDate = this.extractDate(result.snippet) || new Date().toISOString();

      // Extract conditions mentioned
      const conditions = this.extractConditions(result.snippet);

      // Determine sentiment
      const sentiment = this.analyzeSentiment(result.snippet);

      // If LLM is available, use it to generate better summary in Polish
      let summary = result.snippet;
      let confidence = searchConfidence(result.source, reportDate, result.url);

      if (context.llmEnabled && result.snippet.length > 50) {
        try {
          const llm = new LLMService();
          const enhanced = await llm.prompt(
            `Wyciągnij informacje o warunkach narciarskich z tekstu. Napisz 1 KRÓTKIE zdanie po polsku (max 20 słów). BEZ wstępu. Zacznij od warunków.\n\nTekst: "${result.title} - ${result.snippet}"`,
            'Format: Bezpośrednia informacja o warunkach. Przykład: "Świeży puch powyżej 1200m, oblodzone szlaki niżej." Nigdy nie zaczynaj od "Oto" ani "Podsumowanie:".',
            { signal: context.signal }
          );
          if (enhanced && enhanced.length > 10) {
            // Clean up any preambles the LLM might still add
            summary = this.cleanLLMResponse(enhanced);
            confidence = aiConfidence(llm.getModel(), result.source);
          }
        } catch (error) {
          this.warn('LLM summarization failed:', error);
        }
      }

      reports.push({
        summary: summary.slice(0, 300),
        location: this.extractLocation(result.title + ' ' + result.snippet),
        reportDate,
        sourceUrl: result.url,
        sourceName: result.source,
        conditions,
        sentiment,
        confidence,
      });
    }

    return reports;
  }

  /**
   * Extract date from text
   */
  private extractDate(text: string): string | null {
    // Look for Polish date patterns
    const patterns = [
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/,  // 15.01.2024
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // 15/01/2024
      /(\d{4})-(\d{2})-(\d{2})/,         // 2024-01-15
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          // Assume DD.MM.YYYY format for first two patterns
          if (pattern === patterns[0] || pattern === patterns[1]) {
            return new Date(`${match[3]}-${match[2]}-${match[1]}`).toISOString();
          }
          return new Date(match[0]).toISOString();
        } catch {
          continue;
        }
      }
    }

    // Check for relative dates
    const lowerText = text.toLowerCase();
    if (lowerText.includes('dzisiaj') || lowerText.includes('today')) {
      return new Date().toISOString();
    }
    if (lowerText.includes('wczoraj') || lowerText.includes('yesterday')) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString();
    }

    return null;
  }

  /**
   * Extract conditions from text (Polish labels)
   */
  private extractConditions(text: string): string[] {
    const conditions: string[] = [];
    const lowerText = text.toLowerCase();

    // Snow conditions
    if (lowerText.includes('puch') || lowerText.includes('powder')) {
      conditions.push('puch');
    }
    if (lowerText.includes('firn') || lowerText.includes('corn')) {
      conditions.push('firn');
    }
    if (lowerText.includes('lód') || lowerText.includes('ice') || lowerText.includes('oblodz')) {
      conditions.push('lód');
    }
    if (lowerText.includes('twardy') || lowerText.includes('hard')) {
      conditions.push('twardy śnieg');
    }

    // Weather conditions
    if (lowerText.includes('słońce') || lowerText.includes('sunny') || lowerText.includes('słonecz')) {
      conditions.push('słonecznie');
    }
    if (lowerText.includes('mgła') || lowerText.includes('fog')) {
      conditions.push('mgła');
    }
    if (lowerText.includes('wiatr') || lowerText.includes('wind')) {
      conditions.push('wiatr');
    }
    if (lowerText.includes('opady') || lowerText.includes('śnieg') || lowerText.includes('snow')) {
      conditions.push('opady śniegu');
    }

    // Visibility
    if (lowerText.includes('dobra widoczność') || lowerText.includes('good visibility')) {
      conditions.push('dobra widoczność');
    }
    if (lowerText.includes('słaba widoczność') || lowerText.includes('poor visibility')) {
      conditions.push('słaba widoczność');
    }

    return conditions;
  }

  /**
   * Simple sentiment analysis
   */
  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const lowerText = text.toLowerCase();

    const positiveWords = [
      'świetne', 'doskonałe', 'rewelacyjne', 'super', 'great', 'excellent',
      'perfect', 'amazing', 'polecam', 'recommend', 'bajka', 'idealne',
    ];
    const negativeWords = [
      'złe', 'słabe', 'niebezpieczne', 'dangerous', 'bad', 'poor', 'avoid',
      'odradzam', 'uwaga', 'warning', 'ryzyko', 'risk', 'lawina', 'avalanche',
    ];

    let score = 0;
    for (const word of positiveWords) {
      if (lowerText.includes(word)) score++;
    }
    for (const word of negativeWords) {
      if (lowerText.includes(word)) score--;
    }

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  /**
   * Extract location from text
   */
  private extractLocation(text: string): string {
    const locations = [
      'Skrzyczne', 'Pilsko', 'Rycerzowa', 'Barania Góra', 'Babia Góra',
      'Kasprowy', 'Rysy', 'Świnica', 'Tatry', 'Beskid', 'Szczyrk',
      'Hala Miziowa', 'Klimczok', 'Szyndzielnia',
    ];

    for (const loc of locations) {
      if (text.includes(loc)) {
        return loc;
      }
    }

    return 'Nieznana';
  }

  /**
   * Clean LLM response to remove preambles and normalize
   */
  private cleanLLMResponse(text: string): string {
    let cleaned = text.trim();

    // Remove common preamble patterns
    const preamblePatterns = [
      /^(here is|here's|based on|according to|the text|i |let me|summary:?\s*)/i,
      /^(ski touring conditions?|current conditions?|conditions in)[^:]*:\s*/i,
      /^(unfortunately|however|note:?)\s*,?\s*/i,
      /^["']?summary["']?:?\s*/i,
      /^in (1-2|one|two) sentences?:?\s*/i,
    ];

    for (const pattern of preamblePatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Remove trailing incomplete sentences (often from truncation)
    const lastPeriod = cleaned.lastIndexOf('.');
    if (lastPeriod > 20 && lastPeriod < cleaned.length - 1) {
      // There's content after the last period, likely incomplete
      const afterPeriod = cleaned.slice(lastPeriod + 1).trim();
      if (afterPeriod.length > 5 && !afterPeriod.endsWith('.') && !afterPeriod.endsWith('!') && !afterPeriod.endsWith('?')) {
        cleaned = cleaned.slice(0, lastPeriod + 1);
      }
    }

    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    // Limit length
    if (cleaned.length > 200) {
      const truncateAt = cleaned.lastIndexOf('.', 200);
      if (truncateAt > 50) {
        cleaned = cleaned.slice(0, truncateAt + 1);
      } else {
        cleaned = cleaned.slice(0, 197) + '...';
      }
    }

    return cleaned;
  }
}
