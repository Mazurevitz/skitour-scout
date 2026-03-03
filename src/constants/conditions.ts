/**
 * Condition Constants
 *
 * Centralized snow, track, and gear condition configurations.
 */

import { t } from '@/lib/translations';
import type { SnowCondition, TrackStatus, AscentGear } from '@/stores/useReportsStore';

/**
 * Snow condition display configuration
 */
export const SNOW_CONDITIONS: Record<SnowCondition, {
  label: string;
  labelWithEnglish: string;
  emoji: string;
  color: string;
}> = {
  puch: {
    label: t.reports.snow.powder,
    labelWithEnglish: 'puch (powder)',
    emoji: '❄️',
    color: 'text-blue-400',
  },
  firn: {
    label: t.reports.snow.corn,
    labelWithEnglish: 'firn (corn)',
    emoji: '🌞',
    color: 'text-yellow-400',
  },
  cukier: {
    label: t.reports.snow.sugar,
    labelWithEnglish: 'cukier (sugar snow)',
    emoji: '✨',
    color: 'text-cyan-400',
  },
  szren: {
    label: t.reports.snow.crust,
    labelWithEnglish: 'szreń (crust)',
    emoji: '🧊',
    color: 'text-slate-400',
  },
  beton: {
    label: t.reports.snow.hardIcy,
    labelWithEnglish: 'beton (hard/icy)',
    emoji: '🪨',
    color: 'text-gray-400',
  },
  kamienie: {
    label: t.reports.snow.rocks,
    labelWithEnglish: 'kamienie (rocks)',
    emoji: '⚠️',
    color: 'text-red-400',
  },
  mokry: {
    label: 'Mokry',
    labelWithEnglish: 'mokry śnieg (wet)',
    emoji: '💧',
    color: 'text-blue-300',
  },
};

/**
 * Track status display configuration
 */
export const TRACK_STATUS: Record<TrackStatus, {
  label: string;
  labelWithEnglish: string;
  emoji: string;
  color: string;
}> = {
  przetarte: {
    label: t.reports.track.tracked,
    labelWithEnglish: 'przetarte (tracked)',
    emoji: '✅',
    color: 'text-green-400',
  },
  zasypane: {
    label: t.reports.track.covered,
    labelWithEnglish: 'zasypane (fresh)',
    emoji: '❄️',
    color: 'text-blue-400',
  },
  lod: {
    label: t.reports.track.icy,
    labelWithEnglish: 'lód (icy)',
    emoji: '🧊',
    color: 'text-cyan-400',
  },
};

/**
 * Gear display configuration
 */
export const GEAR_OPTIONS: Record<AscentGear, {
  label: string;
  emoji: string;
}> = {
  foki: { label: t.reports.gear.skins, emoji: '🦭' },
  harszle: { label: t.reports.gear.skiCrampons, emoji: '⛓️' },
  raki: { label: t.reports.gear.crampons, emoji: '🦀' },
};

/**
 * Get snow condition config with fallback
 */
export function getSnowConfig(condition: string) {
  return SNOW_CONDITIONS[condition as SnowCondition] || {
    label: condition,
    labelWithEnglish: condition,
    emoji: '❓',
    color: 'text-gray-400',
  };
}

/**
 * Get track status config with fallback
 */
export function getTrackConfig(status: string) {
  return TRACK_STATUS[status as TrackStatus] || {
    label: status,
    labelWithEnglish: status,
    emoji: '❓',
    color: 'text-gray-400',
  };
}

/**
 * Get gear config with fallback
 */
export function getGearConfig(gear: string) {
  return GEAR_OPTIONS[gear as AscentGear] || {
    label: gear,
    emoji: '❓',
  };
}

/**
 * Arrays for form iteration
 */
export const SNOW_CONDITION_OPTIONS = Object.entries(SNOW_CONDITIONS).map(([id, config]) => ({
  id: id as SnowCondition,
  ...config,
}));

export const TRACK_STATUS_OPTIONS = Object.entries(TRACK_STATUS).map(([id, config]) => ({
  id: id as TrackStatus,
  ...config,
}));

export const GEAR_OPTION_LIST = Object.entries(GEAR_OPTIONS).map(([id, config]) => ({
  id: id as AscentGear,
  ...config,
}));
