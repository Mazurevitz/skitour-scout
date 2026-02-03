/**
 * Data Confidence System
 *
 * Tracks the source, freshness, and reliability of all data.
 */

/** How confident we are in the data */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

/** Source type for data provenance */
export type DataSourceType =
  | 'api'           // Official API (weather, etc.)
  | 'scraped'       // Web scraping
  | 'user_report'   // User-submitted data
  | 'ai_generated'  // LLM-generated/summarized
  | 'calculated'    // Derived from other data
  | 'static'        // Hardcoded/mock data
  | 'search'        // Web search results
  | 'cached';       // Cached data (may be stale)

/**
 * Metadata about data provenance and confidence
 */
export interface DataConfidence {
  /** Confidence level */
  level: ConfidenceLevel;
  /** Source type */
  sourceType: DataSourceType;
  /** Human-readable source name */
  sourceName: string;
  /** When the data was fetched */
  fetchedAt: string;
  /** When the source data was created/updated (if known) */
  sourceDate?: string;
  /** How old the data is in hours */
  ageHours?: number;
  /** Additional notes about reliability */
  notes?: string;
  /** URL to the original source */
  sourceUrl?: string;
}

/**
 * Wrapper for any data with confidence metadata
 */
export interface WithConfidence<T> {
  data: T;
  confidence: DataConfidence;
}

/**
 * Calculate confidence level based on data age and source
 */
export function calculateConfidence(
  sourceType: DataSourceType,
  ageHours: number
): ConfidenceLevel {
  // API data
  if (sourceType === 'api') {
    if (ageHours < 1) return 'high';
    if (ageHours < 6) return 'medium';
    return 'low';
  }

  // Search/scraped data
  if (sourceType === 'search' || sourceType === 'scraped') {
    if (ageHours < 24) return 'medium';
    if (ageHours < 72) return 'low';
    return 'unknown';
  }

  // User reports
  if (sourceType === 'user_report') {
    if (ageHours < 12) return 'high';
    if (ageHours < 48) return 'medium';
    return 'low';
  }

  // Static/mock data
  if (sourceType === 'static') {
    return 'unknown';
  }

  // AI generated
  if (sourceType === 'ai_generated') {
    return 'low';
  }

  // Calculated
  if (sourceType === 'calculated') {
    return 'medium';
  }

  return 'unknown';
}

/**
 * Create confidence metadata for API data
 */
export function apiConfidence(sourceName: string, sourceUrl?: string): DataConfidence {
  return {
    level: 'high',
    sourceType: 'api',
    sourceName,
    fetchedAt: new Date().toISOString(),
    ageHours: 0,
    sourceUrl,
  };
}

/**
 * Create confidence metadata for static/mock data
 */
export function staticConfidence(notes?: string): DataConfidence {
  return {
    level: 'unknown',
    sourceType: 'static',
    sourceName: 'Mock Data',
    fetchedAt: new Date().toISOString(),
    notes: notes ?? 'This is placeholder data, not from a real source',
  };
}

/**
 * Create confidence metadata for search results
 */
export function searchConfidence(
  sourceName: string,
  sourceDate: string,
  sourceUrl?: string
): DataConfidence {
  const ageHours = (Date.now() - new Date(sourceDate).getTime()) / (1000 * 60 * 60);
  return {
    level: calculateConfidence('search', ageHours),
    sourceType: 'search',
    sourceName,
    fetchedAt: new Date().toISOString(),
    sourceDate,
    ageHours: Math.round(ageHours),
    sourceUrl,
  };
}

/**
 * Create confidence metadata for AI-generated content
 */
export function aiConfidence(model: string, basedOn?: string): DataConfidence {
  return {
    level: 'low',
    sourceType: 'ai_generated',
    sourceName: `AI (${model})`,
    fetchedAt: new Date().toISOString(),
    notes: basedOn ? `Generated based on: ${basedOn}` : 'AI-generated content',
  };
}

/**
 * Get color for confidence level (Tailwind classes)
 */
export function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'text-green-400';
    case 'medium':
      return 'text-yellow-400';
    case 'low':
      return 'text-orange-400';
    case 'unknown':
      return 'text-gray-500';
  }
}

/**
 * Get background color for confidence level
 */
export function getConfidenceBgColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'bg-green-900/30';
    case 'medium':
      return 'bg-yellow-900/30';
    case 'low':
      return 'bg-orange-900/30';
    case 'unknown':
      return 'bg-gray-800/50';
  }
}

/**
 * Get label for confidence level
 */
export function getConfidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'Verified';
    case 'medium':
      return 'Recent';
    case 'low':
      return 'Uncertain';
    case 'unknown':
      return 'Unverified';
  }
}

/**
 * Get icon name for source type
 */
export function getSourceIcon(sourceType: DataSourceType): string {
  switch (sourceType) {
    case 'api':
      return 'database';
    case 'scraped':
      return 'globe';
    case 'user_report':
      return 'user';
    case 'ai_generated':
      return 'sparkles';
    case 'calculated':
      return 'calculator';
    case 'static':
      return 'file-question';
    case 'search':
      return 'search';
    case 'cached':
      return 'clock';
  }
}
