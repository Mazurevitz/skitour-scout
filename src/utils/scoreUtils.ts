/**
 * Score Utility Functions
 *
 * Centralized score color and styling utilities.
 */

import { SCORE_THRESHOLDS } from '@/constants';

/**
 * Get text color class for a condition score
 */
export function getScoreColor(score: number): string {
  if (score >= SCORE_THRESHOLDS.EXCELLENT) return 'text-green-400';
  if (score >= SCORE_THRESHOLDS.GOOD) return 'text-yellow-400';
  return 'text-red-400';
}

/**
 * Get background color class for a condition score
 */
export function getScoreBg(score: number): string {
  if (score >= SCORE_THRESHOLDS.EXCELLENT) return 'bg-green-900/30';
  if (score >= SCORE_THRESHOLDS.GOOD) return 'bg-yellow-900/30';
  return 'bg-red-900/30';
}

/**
 * Get hex color for a condition score (for map markers)
 */
export function getScoreHexColor(score: number): string {
  if (score >= SCORE_THRESHOLDS.EXCELLENT) return '#22c55e';
  if (score >= SCORE_THRESHOLDS.GOOD) return '#eab308';
  return '#ef4444';
}
