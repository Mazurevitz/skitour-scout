/**
 * Resort condition types
 */

export interface ResortConditions {
  /** Resort name */
  name: string;
  /** Region this resort is in */
  region: string;
  /** Snow depth at base in cm */
  snowDepthBase: number | null;
  /** Snow depth at summit in cm */
  snowDepthSummit: number | null;
  /** Current temperature at summit in °C */
  temperature: number | null;
  /** Wind speed in km/h */
  windSpeed: number | null;
  /** Is resort open for skiing */
  isOpen: boolean | null;
  /** Number of open trails/lifts */
  openTrails: number | null;
  /** Last update timestamp */
  lastUpdate: string;
  /** Source URL */
  sourceUrl: string;
  /** Can be used as alternative descent */
  canUseForDescent: boolean;
  /** Nearby ski touring routes that could use this for descent */
  nearbyRoutes: string[];
}

export interface ResortConfig {
  id: string;
  name: string;
  region: string;
  sourceUrl: string;
  nearbyRoutes: string[];
}

/**
 * Resort configurations by region
 */
export const RESORT_CONFIG: Record<string, ResortConfig[]> = {
  'Beskid Śląski': [
    {
      id: 'szczyrk-cos',
      name: 'Szczyrk COS',
      region: 'Beskid Śląski',
      sourceUrl: 'https://www.cos.pl/osrodek-przygotowania-olimpijskiego-szczyrk/',
      nearbyRoutes: ['Skrzyczne', 'Klimczok'],
    },
    {
      id: 'szczyrk-bsa',
      name: 'Szczyrk Mountain Resort',
      region: 'Beskid Śląski',
      sourceUrl: 'https://beskidsportarena.pl/pogoda-szczyrk',
      nearbyRoutes: ['Skrzyczne', 'Barania Góra'],
    },
  ],
  'Beskid Żywiecki': [
    {
      id: 'pilsko-korbielow',
      name: 'Pilsko Korbielów',
      region: 'Beskid Żywiecki',
      sourceUrl: 'https://www.pilsko.net/',
      nearbyRoutes: ['Pilsko', 'Hala Miziowa'],
    },
  ],
  'Tatry': [
    {
      id: 'kasprowy',
      name: 'Kasprowy Wierch PKL',
      region: 'Tatry',
      sourceUrl: 'https://pkl.pl/kasprowy-wierch/',
      nearbyRoutes: ['Kasprowy Wierch', 'Hala Gąsienicowa'],
    },
  ],
};
