/**
 * UI Constants
 *
 * Centralized magic numbers and UI configuration.
 */

// Timing constants (in milliseconds)
export const TOAST_DURATION_MS = 2000;
export const GEOLOCATION_TIMEOUT_MS = 10000;
export const LLM_TIMEOUT_MS = 30000;

// Scroll/gesture thresholds (in pixels)
export const SWIPE_DISMISS_THRESHOLD_PX = 100;

// Score thresholds for condition rating
export const SCORE_THRESHOLDS = {
  EXCELLENT: 70,
  GOOD: 40,
} as const;

// Bottom sheet snap points (percentage of viewport height)
export const BOTTOM_SHEET_SNAPS = [15, 50, 90] as const;

// Display limits
export const TOP_ROUTES_COUNT = 3;
export const RECENT_REPORTS_LIMIT = 5;
export const SKELETON_COUNT = 3;
export const MIN_REPORTS_FOR_AGGREGATION = 3;
export const RECENT_REPORTS_HOURS = 48;

// Star rating
export const STAR_RATINGS = [1, 2, 3, 4, 5] as const;
