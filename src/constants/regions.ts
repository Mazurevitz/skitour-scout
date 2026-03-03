/**
 * Region Constants
 *
 * Centralized region data for the Polish mountains.
 */

export const REGION_GROUPS = {
  BESKIDY: ['Beskid Śląski', 'Beskid Żywiecki', 'Beskid Sądecki', 'Gorce', 'Pieniny'] as const,
  TATRY: ['Tatry'] as const,
  SUDETY: ['Karkonosze'] as const,
} as const;

export const ALL_REGIONS = [
  ...REGION_GROUPS.BESKIDY,
  ...REGION_GROUPS.TATRY,
  ...REGION_GROUPS.SUDETY,
] as const;

export type RegionName = typeof ALL_REGIONS[number] | 'Wszystkie';

/**
 * Region center coordinates and zoom levels for map display
 */
export const REGION_COORDS: Record<string, { center: [number, number]; zoom: number }> = {
  'Wszystkie': { center: [49.5, 19.5], zoom: 8 },
  'Beskidy': { center: [49.55, 19.5], zoom: 9 },
  'Beskid Śląski': { center: [49.68, 19.0], zoom: 11 },
  'Beskid Żywiecki': { center: [49.57, 19.35], zoom: 11 },
  'Beskid Sądecki': { center: [49.45, 20.6], zoom: 11 },
  'Tatry': { center: [49.23, 20.0], zoom: 11 },
  'Gorce': { center: [49.55, 20.1], zoom: 11 },
  'Pieniny': { center: [49.42, 20.4], zoom: 12 },
  'Karkonosze': { center: [50.75, 15.7], zoom: 11 },
};

/**
 * Popular locations for quick report selection, grouped by region
 */
export const LOCATIONS_BY_REGION: Record<string, string[]> = {
  'Beskid Śląski': ['Skrzyczne', 'Pilsko', 'Rycerzowa', 'Barania Góra', 'Klimczok', 'Szczyrk'],
  'Beskid Żywiecki': ['Babia Góra', 'Pilsko', 'Romanka', 'Hala Miziowa'],
  'Beskid Sądecki': ['Jaworzyna Krynicka', 'Pusta Wielka', 'Radziejowa'],
  'Tatry': ['Kasprowy Wierch', 'Rysy', 'Świnica', 'Morskie Oko', 'Hala Gąsienicowa'],
  'Gorce': ['Turbacz', 'Gorc', 'Jaworzyna Kamienicka'],
  'Pieniny': ['Trzy Korony', 'Sokolica'],
  'Karkonosze': ['Śnieżka', 'Szrenica', 'Kopa'],
};

/**
 * Get locations for a region, with fallback
 */
export function getLocationsForRegion(region: string): string[] {
  return LOCATIONS_BY_REGION[region] || LOCATIONS_BY_REGION['Beskid Śląski'];
}
