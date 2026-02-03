/**
 * Safety Agent
 *
 * Fetches avalanche reports from TOPR (Tatrzańskie Ochotnicze Pogotowie Ratunkowe).
 * Parses real data from lawiny.topr.pl.
 *
 * @module agents/SafetyAgent
 */

import { BaseAgent, type AgentContext } from './BaseAgent';
import type { AvalancheReport, AvalancheLevel, Aspect } from '@/types';

/**
 * Safety agent input parameters
 */
export interface SafetyInput {
  /** Region identifier */
  region: string;
  /** Specific zone within region (optional) */
  zone?: string;
}

/**
 * TOPR report data structure (from embedded JSON)
 */
interface TOPRReport {
  iss: string; // Issuer (TOPR)
  sub: string; // Subject
  id: number; // Report ID
  iat: string; // Issued at timestamp "2026-01-31 18:01"
  exp: string; // Expires at timestamp "2026-02-01 20:00"
  iby: string; // Issued by (author)
  mst: {
    lev: number; // Danger level 1-5
    wet: string; // Wet snow indicator
    tnd: number; // Tendency: -1 decreasing, 0 stable, 1 increasing
    desc0: string; // Level name in Polish (e.g., "Niskie")
    desc1: string; // Description text
  };
  am?: TOPRPeriod;
  pm?: TOPRPeriod;
  history?: TOPRHistoryEntry[];
  comment?: string;
}

interface TOPRPeriod {
  lev: number;
  prb?: string; // Problem code
  obj?: {
    upper?: { exp?: string }; // Exposure as 8-bit string
    lower?: { exp?: string };
    height?: number;
  };
}

interface TOPRHistoryEntry {
  date: string;
  lev: number;
}

/**
 * Safety Agent for avalanche risk assessment
 */
export class SafetyAgent extends BaseAgent<SafetyInput, AvalancheReport | null> {
  constructor() {
    super({
      id: 'safety',
      name: 'Safety Agent',
      description: 'Fetches avalanche danger levels from TOPR',
      cacheTtl: 60 * 60 * 1000, // 1 hour
    });
  }

  /**
   * Fetch avalanche report
   * TOPR only covers Tatry - Beskidy has no official avalanche service
   */
  protected async executeInternal(
    input: SafetyInput,
    context: AgentContext
  ): Promise<AvalancheReport | null> {
    this.log(`Fetching avalanche report for ${input.region}`);

    const isTatry = input.region.toLowerCase().includes('tatry');
    const isBeskidy = input.region.toLowerCase().includes('beskid');

    // Beskidy has no official avalanche bulletin service
    if (isBeskidy) {
      this.log('No official avalanche service for Beskidy region');
      return null;
    }

    // TOPR covers Tatry region
    if (isTatry) {
      try {
        const report = await this.fetchTOPRReport(context.signal);
        if (report) {
          this.log(`Got TOPR report: level ${report.level}, valid until ${report.validUntil}`);
          return report;
        }
      } catch (error) {
        this.warn('Failed to fetch TOPR data:', error);
      }
    }

    return null;
  }

  /**
   * Fetch and parse TOPR avalanche bulletin
   */
  private async fetchTOPRReport(signal?: AbortSignal): Promise<AvalancheReport | null> {
    // Use proxy in browser to bypass CORS
    const url = '/api/proxy/topr/';

    try {
      const response = await fetch(url, {
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      return this.parseTOPRHtml(html);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      this.warn('TOPR fetch error:', error);
      return null;
    }
  }

  /**
   * Parse TOPR HTML page to extract avalanche data
   */
  private parseTOPRHtml(html: string): AvalancheReport | null {
    try {
      // Extract the oLawReport JSON object from the page
      // Look for both "var oLawReport" and "const oLawReport"
      const jsonMatch = html.match(/(?:var|const)\s+oLawReport\s*=\s*(\{[\s\S]*?\});/);
      if (!jsonMatch) {
        this.warn('Could not find oLawReport in TOPR page');
        return this.parseTOPRFallback(html);
      }

      const reportData: TOPRReport = JSON.parse(jsonMatch[1]);
      this.log(`Parsed TOPR report ID: ${reportData.id}, issued by: ${reportData.iby}`);

      // Extract danger level from mst.lev
      const level = Math.min(5, Math.max(1, reportData.mst?.lev || 1)) as AvalancheLevel;
      const levelName = reportData.mst?.desc0 || '';

      // Parse dates
      const issuedAt = reportData.iat || new Date().toISOString();
      const validUntil = reportData.exp || this.getDefaultExpiry();

      // Determine trend from mst.tnd: -1 = decreasing, 0 = stable, 1 = increasing
      const trend = this.parseTrend(reportData.mst?.tnd, reportData.history);

      // Extract problem aspects from AM/PM data
      const aspects = this.extractAspects(reportData);

      // Extract avalanche problems
      const problems = this.extractProblems(reportData);

      // Add description if available
      if (reportData.comment) {
        problems.unshift(reportData.comment.slice(0, 150) + (reportData.comment.length > 150 ? '...' : ''));
      }

      // Determine altitude range
      const altitudeRange = this.extractAltitudeRange(reportData);

      return {
        level,
        trend,
        problemAspects: aspects,
        altitudeRange,
        problems,
        validUntil: this.parsePolishDate(validUntil),
        source: `TOPR - ${levelName}`,
        reportUrl: 'https://lawiny.topr.pl/',
        issuedAt: this.parsePolishDate(issuedAt),
      };
    } catch (error) {
      this.warn('Failed to parse TOPR JSON:', error);
      return this.parseTOPRFallback(html);
    }
  }

  /**
   * Parse trend from TOPR tnd value
   */
  private parseTrend(tnd?: number, history?: TOPRHistoryEntry[]): 'increasing' | 'stable' | 'decreasing' {
    // Use tnd if available: -1 = decreasing, 0 = stable, 1 = increasing
    if (tnd !== undefined) {
      if (tnd > 0) return 'increasing';
      if (tnd < 0) return 'decreasing';
      return 'stable';
    }

    // Fallback to calculating from history
    return this.calculateTrend(history);
  }

  /**
   * Fallback parsing using regex if JSON extraction fails
   */
  private parseTOPRFallback(html: string): AvalancheReport | null {
    try {
      // Try to extract level from class names or image names
      const levelMatch = html.match(/law0(\d)/);
      const level = levelMatch ? (parseInt(levelMatch[1]) as AvalancheLevel) : null;

      if (!level) {
        return null;
      }

      // Try to extract dates
      const dateMatch = html.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/g);
      const validUntil = dateMatch?.[1] || this.getDefaultExpiry();

      return {
        level,
        trend: 'stable',
        problemAspects: ['N', 'NE', 'NW'] as Aspect[], // Common problem aspects
        altitudeRange: { from: 1800, to: 2500 },
        problems: ['Check lawiny.topr.pl for details'],
        validUntil,
        source: 'TOPR (lawiny.topr.pl)',
        reportUrl: 'https://lawiny.topr.pl/',
      };
    } catch {
      return null;
    }
  }

  /**
   * Calculate trend from history data
   */
  private calculateTrend(history?: TOPRHistoryEntry[]): 'increasing' | 'stable' | 'decreasing' {
    if (!history || history.length < 2) {
      return 'stable';
    }

    // Compare recent levels
    const recent = history.slice(-3);
    if (recent.length < 2) return 'stable';

    const lastLevel = recent[recent.length - 1].lev;
    const prevLevel = recent[recent.length - 2].lev;

    if (lastLevel > prevLevel) return 'increasing';
    if (lastLevel < prevLevel) return 'decreasing';
    return 'stable';
  }

  /**
   * Extract problem aspects from exposure data
   * Exposure is encoded as 8-bit string: N, NE, E, SE, S, SW, W, NW
   */
  private extractAspects(report: TOPRReport): Aspect[] {
    const aspects: Aspect[] = [];
    const aspectOrder: Aspect[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

    // Try AM period first
    const exp = report.am?.obj?.upper?.exp || report.pm?.obj?.upper?.exp;

    if (exp && exp.length === 8) {
      for (let i = 0; i < 8; i++) {
        if (exp[i] === '1') {
          aspects.push(aspectOrder[i]);
        }
      }
    }

    // Default aspects if none found
    if (aspects.length === 0) {
      return ['N', 'NE', 'NW'];
    }

    return aspects;
  }

  /**
   * Extract avalanche problems from problem codes
   */
  private extractProblems(report: TOPRReport): string[] {
    const problems: string[] = [];
    const problemCodes: Record<string, string> = {
      'prwd': 'Wind-drifted snow (Śnieg nawiewany)',
      'prnn': 'No distinct avalanche problem',
      'prns': 'New snow (Świeży śnieg)',
      'prps': 'Persistent weak layers (Słabe warstwy)',
      'prww': 'Wet snow (Mokry śnieg)',
      'prgd': 'Gliding snow (Śnieg ślizgowy)',
    };

    const amProblem = report.am?.prb;
    const pmProblem = report.pm?.prb;

    if (amProblem && problemCodes[amProblem]) {
      problems.push(problemCodes[amProblem]);
    }
    if (pmProblem && pmProblem !== amProblem && problemCodes[pmProblem]) {
      problems.push(problemCodes[pmProblem]);
    }

    // Add time-based issues
    if (report.pm && report.pm.lev > (report.am?.lev || 0)) {
      problems.push('Increasing danger in afternoon');
    }

    return problems.length > 0 ? problems : ['Check report for details'];
  }

  /**
   * Extract altitude range from report
   */
  private extractAltitudeRange(report: TOPRReport): { from: number; to: number } {
    const height = report.am?.obj?.height || report.pm?.obj?.height;

    // Height 999 typically means "above treeline" in Tatry context
    if (height === 999 || !height) {
      return { from: 1800, to: 2500 }; // Typical Tatry range
    }

    return { from: height, to: 2500 };
  }

  /**
   * Parse Polish date format to ISO string
   */
  private parsePolishDate(dateStr: string): string {
    try {
      // Handle format like "2026-01-31 18:01"
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        return new Date(dateStr.replace(' ', 'T')).toISOString();
      }
      return new Date(dateStr).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  /**
   * Get default expiry (next day 20:00)
   */
  private getDefaultExpiry(): string {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 1);
    expiry.setHours(20, 0, 0, 0);
    return expiry.toISOString();
  }

  /**
   * Get danger level description
   */
  static getDangerDescription(level: AvalancheLevel): string {
    const descriptions: Record<AvalancheLevel, string> = {
      1: 'Low (Niskie) - Generally favorable conditions',
      2: 'Moderate (Umiarkowane) - Heightened conditions on specific terrain',
      3: 'Considerable (Znaczne) - Dangerous conditions on specific terrain',
      4: 'High (Duże) - Very dangerous conditions',
      5: 'Very High (Bardzo duże) - Extraordinarily dangerous conditions',
    };
    return descriptions[level];
  }

  /**
   * Get danger level color
   */
  static getDangerColor(level: AvalancheLevel): string {
    const colors: Record<AvalancheLevel, string> = {
      1: '#4ade80', // Green
      2: '#facc15', // Yellow
      3: '#fb923c', // Orange
      4: '#f87171', // Red
      5: '#1f2937', // Black
    };
    return colors[level];
  }

  /**
   * Get recommended actions based on danger level
   */
  static getRecommendations(level: AvalancheLevel): string[] {
    const recommendations: Record<AvalancheLevel, string[]> = {
      1: [
        'Standard precautions apply',
        'Favorable conditions for ski touring',
        'Be aware of isolated danger spots',
      ],
      2: [
        'Careful route selection recommended',
        'Avoid steep slopes with unfavorable aspects',
        'Travel one at a time on suspect terrain',
      ],
      3: [
        'Experienced judgment essential',
        'Avoid steep slopes (>30°) on indicated aspects',
        'Conservative terrain choices strongly advised',
        'Check conditions with locals before departure',
      ],
      4: [
        'Restrict travel to low-angle terrain',
        'Avoid all avalanche terrain',
        'Natural avalanches likely',
        'Consider postponing trip',
      ],
      5: [
        'Avoid all avalanche terrain',
        'Travel not recommended',
        'Stay off steep slopes entirely',
        'Widespread natural avalanches expected',
      ],
    };
    return recommendations[level];
  }
}
