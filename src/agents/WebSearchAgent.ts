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

    // Build search queries
    const queries = this.buildSearchQueries(input.region, locations);
    this.log(`Search queries: ${queries.join(', ')}`);

    // Fetch search results (using DuckDuckGo HTML - no API key needed)
    const allResults: SearchResult[] = [];
    const searchErrors: string[] = [];

    for (const query of queries.slice(0, 3)) {
      try {
        const results = await this.searchDuckDuckGo(query, context.signal);
        this.log(`Query "${query}" returned ${results.length} results`);
        allResults.push(...results);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        searchErrors.push(`"${query}": ${msg}`);
        this.warn(`Search failed for "${query}":`, error);
      }
    }

    // Deduplicate by URL
    const uniqueResults = this.deduplicateResults(allResults);
    this.log(`Found ${uniqueResults.length} unique results total`);

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
          notes: `No results found. Queries tried: ${queries.slice(0, 3).join(', ')}`,
        },
      };
    }

    // Process results into condition reports
    const reports = await this.processResults(
      uniqueResults.slice(0, limit),
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
   */
  private buildSearchQueries(region: string, locations: string[]): string[] {
    const queries: string[] = [];
    const year = new Date().getFullYear();

    // Polish search terms for ski touring conditions
    const conditionTerms = [
      'warunki narciarskie',
      'skituring',
      'warunki śniegowe',
      'ski touring',
    ];

    // If we have specific locations (1-2), prioritize them
    if (locations.length <= 2 && locations.length > 0) {
      // Specific location search - more targeted queries
      for (const location of locations) {
        queries.push(`${location} warunki narciarskie ${year}`);
        queries.push(`${location} skituring warunki`);
        queries.push(`${location} śnieg zima`);
        queries.push(`${location} narty`);
      }
    } else {
      // Region-wide search
      queries.push(`${region} ${conditionTerms[0]} ${year}`);
      queries.push(`${region} skituring`);

      // Add location-specific queries for variety
      for (const location of locations.slice(0, 2)) {
        queries.push(`${location} warunki narciarskie`);
      }
    }

    return queries;
  }

  /**
   * Search using DuckDuckGo HTML (no API key needed)
   */
  private async searchDuckDuckGo(
    query: string,
    signal?: AbortSignal
  ): Promise<SearchResult[]> {
    const encodedQuery = encodeURIComponent(query);
    // Use proxy in browser to bypass CORS
    const url = `/api/proxy/ddg/html/?q=${encodedQuery}`;

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
   * Deduplicate results by URL
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
  }

  /**
   * Process search results into condition reports
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

      // If LLM is available, use it to generate better summary
      let summary = result.snippet;
      let confidence = searchConfidence(result.source, reportDate, result.url);

      if (context.llmConfig && result.snippet.length > 50) {
        try {
          const llm = new LLMService(context.llmConfig);
          const enhanced = await llm.prompt(
            `Extract ski conditions from this text. Write 1 SHORT sentence (max 20 words). NO introduction. Start directly with conditions.\n\nText: "${result.title} - ${result.snippet}"`,
            'Output format: Direct condition statement. Example: "Fresh powder above 1200m, icy trails below." Never start with "Here is" or "Summary:" or similar phrases.',
            { signal: context.signal }
          );
          if (enhanced && enhanced.length > 10) {
            // Clean up any preambles the LLM might still add
            summary = this.cleanLLMResponse(enhanced);
            confidence = aiConfidence(
              context.llmConfig.provider === 'ollama'
                ? context.llmConfig.ollamaModel || 'ollama'
                : context.llmConfig.openrouterModel || 'openrouter',
              result.source
            );
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
   * Extract conditions from text
   */
  private extractConditions(text: string): string[] {
    const conditions: string[] = [];
    const lowerText = text.toLowerCase();

    // Snow conditions
    if (lowerText.includes('puch') || lowerText.includes('powder')) {
      conditions.push('powder');
    }
    if (lowerText.includes('firn') || lowerText.includes('corn')) {
      conditions.push('corn snow');
    }
    if (lowerText.includes('lód') || lowerText.includes('ice') || lowerText.includes('oblodz')) {
      conditions.push('icy');
    }
    if (lowerText.includes('twardy') || lowerText.includes('hard')) {
      conditions.push('hard-packed');
    }

    // Weather conditions
    if (lowerText.includes('słońce') || lowerText.includes('sunny') || lowerText.includes('słonecz')) {
      conditions.push('sunny');
    }
    if (lowerText.includes('mgła') || lowerText.includes('fog')) {
      conditions.push('fog');
    }
    if (lowerText.includes('wiatr') || lowerText.includes('wind')) {
      conditions.push('windy');
    }
    if (lowerText.includes('opady') || lowerText.includes('śnieg') || lowerText.includes('snow')) {
      conditions.push('snowing');
    }

    // Visibility
    if (lowerText.includes('dobra widoczność') || lowerText.includes('good visibility')) {
      conditions.push('good visibility');
    }
    if (lowerText.includes('słaba widoczność') || lowerText.includes('poor visibility')) {
      conditions.push('poor visibility');
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

    return 'Unknown';
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
