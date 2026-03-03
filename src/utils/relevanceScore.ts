/**
 * Report Relevance Score Calculator
 *
 * Calculates a 0-100 relevance score for community ski condition reports
 * based on age decay, weather changes, and report consistency.
 *
 * @module utils/relevanceScore
 */

import type {
  WeatherSnapshot,
  RelevanceFactors,
  RelevanceTier,
  WeatherCondition,
  ElevationWeather,
} from '@/types';

/**
 * Age-based depreciation configuration
 */
export const AGE_CONFIG = {
  /** Hours after which report is considered "archived" and excluded from aggregations */
  ARCHIVE_THRESHOLD_HOURS: 336, // 14 days = 2 weeks
  /** Hours at which report reaches minimum weight (but still counted) */
  FULL_DECAY_HOURS: 168, // 7 days
  /** Grace period with full weight */
  FULL_WEIGHT_HOURS: 12,
  /** Minimum weight for non-archived reports */
  MIN_WEIGHT: 0.2,
} as const;

/**
 * Weight configuration for relevance factors
 */
const WEIGHTS = {
  /** Maximum age penalty in points */
  MAX_AGE_PENALTY: 40,
  /** Hours of grace period before age penalty starts */
  AGE_GRACE_HOURS: 6,
  /** Hours at which full age decay is applied */
  AGE_FULL_DECAY_HOURS: 72,

  /** Maximum temperature change penalty */
  MAX_TEMP_PENALTY: 15,
  /** Temperature change threshold before penalty starts (°C) */
  TEMP_THRESHOLD: 3,

  /** Maximum fresh snow bonus/penalty */
  MAX_SNOW_DELTA: 10,
  /** Fresh snow threshold for bonus (cm) */
  SNOW_THRESHOLD: 5,

  /** Maximum freezing level penalty */
  MAX_FREEZING_PENALTY: 10,
  /** Freezing level change threshold (meters) */
  FREEZING_THRESHOLD: 200,

  /** Maximum weather event penalty */
  MAX_WEATHER_EVENT_PENALTY: 20,
  /** Rain penalty */
  RAIN_PENALTY: 20,
  /** High wind penalty (forms wind slab) */
  HIGH_WIND_PENALTY: 15,
  /** Wind speed threshold for penalty (km/h) */
  HIGH_WIND_THRESHOLD: 40,

  /** Maximum consistency bonus */
  MAX_CONSISTENCY_BONUS: 5,
  /** Minimum reports needed for consistency bonus */
  MIN_REPORTS_FOR_BONUS: 2,
} as const;

/**
 * Relevance tier thresholds
 */
const TIER_THRESHOLDS = {
  excellent: 80,
  good: 60,
  fair: 40,
  stale: 20,
} as const;

/**
 * Calculate the age penalty for a report
 * @param reportTimestamp - When the report was submitted
 * @returns Age penalty (0 to MAX_AGE_PENALTY)
 */
function calculateAgePenalty(reportTimestamp: string): number {
  const reportTime = new Date(reportTimestamp).getTime();
  const now = Date.now();
  const hoursOld = (now - reportTime) / (1000 * 60 * 60);

  if (hoursOld <= WEIGHTS.AGE_GRACE_HOURS) {
    return 0;
  }

  const decayHours = hoursOld - WEIGHTS.AGE_GRACE_HOURS;
  const decayRange = WEIGHTS.AGE_FULL_DECAY_HOURS - WEIGHTS.AGE_GRACE_HOURS;
  const decayRatio = Math.min(decayHours / decayRange, 1);

  return Math.round(decayRatio * WEIGHTS.MAX_AGE_PENALTY);
}

/**
 * Calculate the temperature change penalty
 * @param snapshotTemp - Temperature at report time
 * @param currentTemp - Current temperature
 * @returns Temperature penalty (0 to MAX_TEMP_PENALTY)
 */
function calculateTemperaturePenalty(
  snapshotTemp: number | undefined,
  currentTemp: number | undefined
): number {
  if (snapshotTemp === undefined || currentTemp === undefined) {
    return 0;
  }

  const tempDelta = Math.abs(currentTemp - snapshotTemp);
  if (tempDelta <= WEIGHTS.TEMP_THRESHOLD) {
    return 0;
  }

  const excessDelta = tempDelta - WEIGHTS.TEMP_THRESHOLD;
  // Each degree over threshold adds ~2.5 points
  const penalty = Math.min(excessDelta * 2.5, WEIGHTS.MAX_TEMP_PENALTY);
  return Math.round(penalty);
}

/**
 * Calculate the fresh snow delta (bonus or neutral)
 * Positive value = bonus points, negative = penalty
 * @param snapshotSnow - Fresh snow at report time (cm)
 * @param currentSnow - Current fresh snow (cm)
 * @returns Snow delta points (-MAX_SNOW_DELTA to +MAX_SNOW_DELTA)
 */
function calculateFreshSnowDelta(
  snapshotSnow: number | undefined,
  currentSnow: number | undefined
): number {
  if (snapshotSnow === undefined || currentSnow === undefined) {
    return 0;
  }

  const snowDelta = currentSnow - snapshotSnow;

  // Significant new snow since report - conditions have changed, report less relevant
  if (snowDelta > WEIGHTS.SNOW_THRESHOLD) {
    return -Math.min(
      Math.round((snowDelta - WEIGHTS.SNOW_THRESHOLD) * 2),
      WEIGHTS.MAX_SNOW_DELTA
    );
  }

  // Snow melted since report - conditions worse
  if (snowDelta < -WEIGHTS.SNOW_THRESHOLD) {
    return -Math.min(
      Math.round(Math.abs(snowDelta + WEIGHTS.SNOW_THRESHOLD) * 1.5),
      WEIGHTS.MAX_SNOW_DELTA
    );
  }

  // Stable snow conditions - slight bonus
  if (Math.abs(snowDelta) < 2) {
    return 3;
  }

  return 0;
}

/**
 * Calculate the freezing level change penalty
 * @param snapshotLevel - Freezing level at report time (m)
 * @param currentLevel - Current freezing level (m)
 * @returns Freezing level penalty (0 to MAX_FREEZING_PENALTY)
 */
function calculateFreezingLevelPenalty(
  snapshotLevel: number | undefined,
  currentLevel: number | undefined
): number {
  if (snapshotLevel === undefined || currentLevel === undefined) {
    return 0;
  }

  const levelDelta = Math.abs(currentLevel - snapshotLevel);
  if (levelDelta <= WEIGHTS.FREEZING_THRESHOLD) {
    return 0;
  }

  const excessDelta = levelDelta - WEIGHTS.FREEZING_THRESHOLD;
  // Each 100m over threshold adds ~2 points
  const penalty = Math.min(excessDelta * 0.02, WEIGHTS.MAX_FREEZING_PENALTY);
  return Math.round(penalty);
}

/**
 * Calculate penalty for destructive weather events
 * @param currentCondition - Current weather condition
 * @param currentWindSpeed - Current wind speed (km/h)
 * @returns Weather event penalty (0 to MAX_WEATHER_EVENT_PENALTY)
 */
function calculateWeatherEventPenalty(
  currentCondition: WeatherCondition | undefined,
  currentWindSpeed: number | undefined
): number {
  let penalty = 0;

  // Rain destroys snow quality
  if (currentCondition === 'rain') {
    penalty += WEIGHTS.RAIN_PENALTY;
  }

  // High wind creates wind slab, changes conditions
  if (currentWindSpeed !== undefined && currentWindSpeed >= WEIGHTS.HIGH_WIND_THRESHOLD) {
    penalty += WEIGHTS.HIGH_WIND_PENALTY;
  }

  return Math.min(penalty, WEIGHTS.MAX_WEATHER_EVENT_PENALTY);
}

/**
 * Calculate consistency bonus for similar reports
 * @param similarReportCount - Number of similar reports at same location within 24h
 * @returns Consistency bonus (0 to MAX_CONSISTENCY_BONUS)
 */
function calculateConsistencyBonus(similarReportCount: number): number {
  if (similarReportCount < WEIGHTS.MIN_REPORTS_FOR_BONUS) {
    return 0;
  }

  // Each additional report adds 2 points, max 5
  const bonus = (similarReportCount - 1) * 2;
  return Math.min(bonus, WEIGHTS.MAX_CONSISTENCY_BONUS);
}

/**
 * Calculate the complete relevance score for a report
 * @param reportTimestamp - When the report was submitted
 * @param weatherSnapshot - Weather conditions at report time
 * @param currentWeather - Current weather conditions
 * @param similarReportCount - Number of similar reports at location
 * @returns RelevanceFactors with breakdown and final score
 */
export function calculateRelevanceScore(
  reportTimestamp: string,
  weatherSnapshot: WeatherSnapshot | undefined,
  currentWeather: ElevationWeather | undefined,
  similarReportCount: number = 1
): RelevanceFactors {
  // Base score starts at 100
  let score = 100;

  // Calculate age penalty (always applies)
  const agePenalty = calculateAgePenalty(reportTimestamp);
  score -= agePenalty;

  // Calculate weather-related penalties (only if we have snapshot)
  const currentTemp = currentWeather?.summit?.temperature;
  const temperaturePenalty = calculateTemperaturePenalty(
    weatherSnapshot?.temperature,
    currentTemp
  );
  score -= temperaturePenalty;

  const freshSnowDelta = calculateFreshSnowDelta(
    weatherSnapshot?.freshSnow24h,
    currentWeather?.freshSnow24h
  );
  score -= freshSnowDelta; // Negative delta = bonus, positive = penalty

  const freezingLevelPenalty = calculateFreezingLevelPenalty(
    weatherSnapshot?.freezingLevel,
    currentWeather?.freezingLevel
  );
  score -= freezingLevelPenalty;

  const weatherEventPenalty = calculateWeatherEventPenalty(
    currentWeather?.summit?.condition,
    currentWeather?.summit?.windSpeed
  );
  score -= weatherEventPenalty;

  // Calculate consistency bonus
  const consistencyBonus = calculateConsistencyBonus(similarReportCount);
  score += consistencyBonus;

  // Clamp final score to 0-100
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    agePenalty,
    temperaturePenalty,
    freshSnowDelta,
    freezingLevelPenalty,
    weatherEventPenalty,
    consistencyBonus,
    finalScore,
  };
}

/**
 * Calculate a base relevance score for reports without weather snapshots
 * Uses a default base of 60 with age penalty
 * @param reportTimestamp - When the report was submitted
 * @returns RelevanceFactors with limited breakdown
 */
export function calculateBaseRelevanceScore(reportTimestamp: string): RelevanceFactors {
  const agePenalty = calculateAgePenalty(reportTimestamp);

  // Reports without weather data start at 60 (middle ground)
  const baseScore = 60;
  const finalScore = Math.max(0, Math.min(100, baseScore - agePenalty));

  return {
    agePenalty,
    temperaturePenalty: 0,
    freshSnowDelta: 0,
    freezingLevelPenalty: 0,
    weatherEventPenalty: 0,
    consistencyBonus: 0,
    finalScore,
  };
}

/**
 * Get the relevance tier for a score
 * @param score - Relevance score (0-100)
 * @returns RelevanceTier
 */
export function getRelevanceTier(score: number): RelevanceTier {
  if (score >= TIER_THRESHOLDS.excellent) return 'excellent';
  if (score >= TIER_THRESHOLDS.good) return 'good';
  if (score >= TIER_THRESHOLDS.fair) return 'fair';
  if (score >= TIER_THRESHOLDS.stale) return 'stale';
  return 'outdated';
}

/**
 * Get the display color for a relevance tier
 * @param tier - Relevance tier
 * @returns Tailwind color class
 */
export function getRelevanceTierColor(tier: RelevanceTier): string {
  switch (tier) {
    case 'excellent':
      return 'text-green-400';
    case 'good':
      return 'text-blue-400';
    case 'fair':
      return 'text-yellow-400';
    case 'stale':
      return 'text-orange-400';
    case 'outdated':
      return 'text-red-400';
  }
}

/**
 * Get the background color for a relevance tier
 * @param tier - Relevance tier
 * @returns Tailwind background color class
 */
export function getRelevanceTierBgColor(tier: RelevanceTier): string {
  switch (tier) {
    case 'excellent':
      return 'bg-green-500/20';
    case 'good':
      return 'bg-blue-500/20';
    case 'fair':
      return 'bg-yellow-500/20';
    case 'stale':
      return 'bg-orange-500/20';
    case 'outdated':
      return 'bg-red-500/20';
  }
}

/**
 * Create a weather snapshot from current elevation weather
 * @param elevationWeather - Current elevation weather data
 * @returns WeatherSnapshot
 */
export function createWeatherSnapshot(elevationWeather: ElevationWeather): WeatherSnapshot {
  return {
    temperature: elevationWeather.summit.temperature,
    windSpeed: elevationWeather.summit.windSpeed,
    freshSnow24h: elevationWeather.freshSnow24h,
    snowBase: 0, // Not always available from elevation weather
    freezingLevel: elevationWeather.freezingLevel,
    condition: elevationWeather.summit.condition,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Get the age of a report in hours
 * @param timestamp - Report timestamp
 * @returns Age in hours
 */
export function getReportAgeHours(timestamp: string): number {
  const reportTime = new Date(timestamp).getTime();
  const now = Date.now();
  return (now - reportTime) / (1000 * 60 * 60);
}

/**
 * Check if a report is archived (older than 2 weeks)
 * Archived reports should be shown for reference but not included in aggregations
 * @param timestamp - Report timestamp
 * @returns true if report is archived
 */
export function isReportArchived(timestamp: string): boolean {
  return getReportAgeHours(timestamp) >= AGE_CONFIG.ARCHIVE_THRESHOLD_HOURS;
}

/**
 * Calculate the weight of a report based on age (0-1 scale)
 * - First 12 hours: weight = 1.0
 * - 12h to 7 days: linear decay from 1.0 to 0.2
 * - 7 days to 2 weeks: weight = 0.2 (minimum)
 * - After 2 weeks: weight = 0 (archived, excluded from aggregations)
 *
 * @param timestamp - Report timestamp
 * @returns Weight between 0 and 1
 */
export function calculateReportWeight(timestamp: string): number {
  const ageHours = getReportAgeHours(timestamp);

  // Archived reports have no weight in aggregations
  if (ageHours >= AGE_CONFIG.ARCHIVE_THRESHOLD_HOURS) {
    return 0;
  }

  // Full weight during grace period
  if (ageHours <= AGE_CONFIG.FULL_WEIGHT_HOURS) {
    return 1.0;
  }

  // After full decay, minimum weight
  if (ageHours >= AGE_CONFIG.FULL_DECAY_HOURS) {
    return AGE_CONFIG.MIN_WEIGHT;
  }

  // Linear decay between grace period and full decay
  const decayRange = AGE_CONFIG.FULL_DECAY_HOURS - AGE_CONFIG.FULL_WEIGHT_HOURS;
  const decayProgress = (ageHours - AGE_CONFIG.FULL_WEIGHT_HOURS) / decayRange;
  const weightRange = 1.0 - AGE_CONFIG.MIN_WEIGHT;

  return 1.0 - (decayProgress * weightRange);
}

/**
 * Get a human-readable age category for a report
 * @param timestamp - Report timestamp
 * @returns Age category: 'fresh' | 'recent' | 'aging' | 'old' | 'archived'
 */
export function getReportAgeCategory(
  timestamp: string
): 'fresh' | 'recent' | 'aging' | 'old' | 'archived' {
  const ageHours = getReportAgeHours(timestamp);

  if (ageHours >= AGE_CONFIG.ARCHIVE_THRESHOLD_HOURS) return 'archived';
  if (ageHours >= AGE_CONFIG.FULL_DECAY_HOURS) return 'old';
  if (ageHours >= 72) return 'aging'; // 3 days
  if (ageHours >= AGE_CONFIG.FULL_WEIGHT_HOURS) return 'recent';
  return 'fresh';
}
