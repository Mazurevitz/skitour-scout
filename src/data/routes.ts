/**
 * Route Data
 *
 * Ski touring routes organized by region.
 */

import type { Route, Aspect } from '@/types';

/**
 * Routes organized by region
 */
export const ROUTES_BY_REGION: Record<string, Route[]> = {
  'Beskid Śląski': [
    {
      id: 'skrzyczne-cyl',
      name: 'Skrzyczne via COS',
      region: 'Beskid Śląski',
      startPoint: { lat: 49.7181, lng: 19.0339, altitude: 500 },
      summit: { lat: 49.6847, lng: 19.0306, altitude: 1257 },
      elevation: 757,
      distance: 5.5,
      difficulty: 'moderate',
      aspects: ['N', 'NE'] as Aspect[],
      duration: 3,
      description: 'Popular route from Szczyrk to highest peak of Beskid Śląski',
    },
    {
      id: 'skrzyczne-malinowska',
      name: 'Skrzyczne - Malinowska Skała',
      region: 'Beskid Śląski',
      startPoint: { lat: 49.6847, lng: 19.0306, altitude: 1257 },
      summit: { lat: 49.6733, lng: 19.0458, altitude: 1152 },
      elevation: 300,
      distance: 4.2,
      difficulty: 'easy',
      aspects: ['E', 'SE'] as Aspect[],
      duration: 2,
      description: 'Ridge traverse with great views, gentle terrain',
    },
    {
      id: 'pilsko-north',
      name: 'Pilsko - North Couloir',
      region: 'Beskid Śląski',
      startPoint: { lat: 49.5617, lng: 19.3417, altitude: 1330 },
      summit: { lat: 49.5456, lng: 19.3297, altitude: 1557 },
      elevation: 600,
      distance: 4.8,
      difficulty: 'difficult',
      aspects: ['N', 'NW'] as Aspect[],
      duration: 3.5,
      description: 'Steeper north-facing route, best powder conditions',
    },
    {
      id: 'pilsko-hala',
      name: 'Pilsko from Hala Miziowa',
      region: 'Beskid Śląski',
      startPoint: { lat: 49.5617, lng: 19.3417, altitude: 1330 },
      summit: { lat: 49.5456, lng: 19.3297, altitude: 1557 },
      elevation: 450,
      distance: 3.5,
      difficulty: 'easy',
      aspects: ['S', 'SW'] as Aspect[],
      duration: 2.5,
      description: 'Classic approach, wide open slopes',
    },
    {
      id: 'rycerzowa-main',
      name: 'Rycerzowa Main Ridge',
      region: 'Beskid Śląski',
      startPoint: { lat: 49.4850, lng: 19.0950, altitude: 750 },
      summit: { lat: 49.4728, lng: 19.1039, altitude: 1226 },
      elevation: 476,
      distance: 5.0,
      difficulty: 'moderate',
      aspects: ['N', 'W'] as Aspect[],
      duration: 3,
      description: 'Less crowded, beautiful forest approach',
    },
    {
      id: 'barania-gora',
      name: 'Barania Góra Classic',
      region: 'Beskid Śląski',
      startPoint: { lat: 49.5850, lng: 19.0450, altitude: 650 },
      summit: { lat: 49.5711, lng: 19.0389, altitude: 1220 },
      elevation: 570,
      distance: 6.0,
      difficulty: 'moderate',
      aspects: ['NE', 'E'] as Aspect[],
      duration: 3.5,
      description: 'Source of Vistula river, scenic route',
    },
  ],
  'Tatry': [
    {
      id: 'kasprowy-goryczkowa',
      name: 'Kasprowy - Goryczkowa',
      region: 'Tatry',
      startPoint: { lat: 49.2317, lng: 19.9817, altitude: 1987 },
      summit: { lat: 49.2317, lng: 19.9817, altitude: 1987 },
      elevation: 950,
      distance: 6.5,
      difficulty: 'moderate',
      aspects: ['N', 'NW'] as Aspect[],
      duration: 4,
      description: 'Classic ski touring descent from Kasprowy Wierch',
    },
    {
      id: 'rysy-north',
      name: 'Rysy - North Face',
      region: 'Tatry',
      startPoint: { lat: 49.2014, lng: 20.0714, altitude: 1395 },
      summit: { lat: 49.1794, lng: 20.0881, altitude: 2499 },
      elevation: 1104,
      distance: 8.2,
      difficulty: 'expert',
      aspects: ['N', 'NE'] as Aspect[],
      duration: 7,
      description: 'Challenging route to the highest peak in Poland',
    },
    {
      id: 'swinica-classic',
      name: 'Świnica Classic',
      region: 'Tatry',
      startPoint: { lat: 49.2383, lng: 20.0033, altitude: 1520 },
      summit: { lat: 49.2186, lng: 20.0047, altitude: 2301 },
      elevation: 781,
      distance: 5.8,
      difficulty: 'difficult',
      aspects: ['E', 'SE'] as Aspect[],
      duration: 5,
      description: 'Popular route with stunning views',
    },
    {
      id: 'koscielec-direct',
      name: 'Kościelec Direct',
      region: 'Tatry',
      startPoint: { lat: 49.2383, lng: 20.0033, altitude: 1520 },
      summit: { lat: 49.2264, lng: 20.0042, altitude: 2155 },
      elevation: 635,
      distance: 4.2,
      difficulty: 'moderate',
      aspects: ['N', 'NE'] as Aspect[],
      duration: 3.5,
      description: 'Accessible peak with reliable snow',
    },
    {
      id: 'zawrat-traverse',
      name: 'Zawrat Traverse',
      region: 'Tatry',
      startPoint: { lat: 49.2125, lng: 20.0458, altitude: 1650 },
      summit: { lat: 49.2153, lng: 20.0169, altitude: 2159 },
      elevation: 509,
      distance: 7.5,
      difficulty: 'difficult',
      aspects: ['W', 'NW'] as Aspect[],
      duration: 6,
      description: 'Scenic traverse between valleys',
    },
  ],
  'Beskid Żywiecki': [
    {
      id: 'babia-gora-north',
      name: 'Babia Góra - Perć Akademików',
      region: 'Beskid Żywiecki',
      startPoint: { lat: 49.5850, lng: 19.5200, altitude: 850 },
      summit: { lat: 49.5731, lng: 19.5294, altitude: 1725 },
      elevation: 875,
      distance: 6.5,
      difficulty: 'expert',
      aspects: ['N', 'NE'] as Aspect[],
      duration: 5,
      description: 'Steep north face of the Queen of Beskids',
    },
    {
      id: 'babia-gora-south',
      name: 'Babia Góra - South Ridge',
      region: 'Beskid Żywiecki',
      startPoint: { lat: 49.5600, lng: 19.5350, altitude: 950 },
      summit: { lat: 49.5731, lng: 19.5294, altitude: 1725 },
      elevation: 775,
      distance: 5.0,
      difficulty: 'moderate',
      aspects: ['S', 'SW'] as Aspect[],
      duration: 4,
      description: 'Gentler approach, good for spring corn snow',
    },
  ],
};

/**
 * Get routes for a region (returns empty array if no routes defined)
 */
export function getRoutesForRegion(region: string): Route[] {
  // For "Beskidy" group, combine all Beskidy routes
  if (region === 'Beskidy') {
    return [
      ...(ROUTES_BY_REGION['Beskid Śląski'] || []),
      ...(ROUTES_BY_REGION['Beskid Żywiecki'] || []),
      ...(ROUTES_BY_REGION['Beskid Sądecki'] || []),
      ...(ROUTES_BY_REGION['Gorce'] || []),
      ...(ROUTES_BY_REGION['Pieniny'] || []),
    ];
  }

  // For "Wszystkie", combine all routes
  if (region === 'Wszystkie') {
    return Object.values(ROUTES_BY_REGION).flat();
  }

  return ROUTES_BY_REGION[region] || [];
}
