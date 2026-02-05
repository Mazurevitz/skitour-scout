/**
 * Resort Conditions Service
 *
 * Fetches current conditions from nearby ski resorts.
 * This data supplements backcountry info - shows snow depth, temp, and descent options.
 */

import { getEdgeFunctionUrl, isSupabaseConfigured } from '@/lib/supabase';
import type { ResortConditions, ResortConfig } from '@/types/resort';
import { RESORT_CONFIG } from '@/types/resort';

/**
 * Fetch conditions for a single resort
 */
async function fetchResortPage(url: string, signal?: AbortSignal): Promise<string | null> {
  try {
    let fetchUrl: string;
    if (isSupabaseConfigured()) {
      const edgeUrl = getEdgeFunctionUrl('search-proxy');
      fetchUrl = `${edgeUrl}?q=${encodeURIComponent(`site:${new URL(url).hostname}`)}`;
    } else {
      // Can't fetch in dev without proxy
      return null;
    }

    const response = await fetch(fetchUrl, { signal });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Parse snow depth from text (looks for patterns like "50 cm", "50cm")
 */
function parseSnowDepth(text: string): number | null {
  const patterns = [
    /(\d+)\s*cm/i,
    /pokrywa[:\s]+(\d+)/i,
    /śnieg[:\s]+(\d+)/i,
    /snow[:\s]+(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const depth = parseInt(match[1], 10);
      if (depth > 0 && depth < 500) return depth; // Sanity check
    }
  }
  return null;
}

/**
 * Parse temperature from text (looks for patterns like "-5°C", "-5 C")
 */
function parseTemperature(text: string): number | null {
  const patterns = [
    /(-?\d+(?:\.\d+)?)\s*°?\s*C/i,
    /temperatura[:\s]+(-?\d+)/i,
    /temp[:\s]+(-?\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const temp = parseFloat(match[1]);
      if (temp > -50 && temp < 50) return temp; // Sanity check
      }
  }
  return null;
}

/**
 * Check if resort appears to be open
 */
function parseOpenStatus(text: string): boolean | null {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('zamknięt') || lowerText.includes('nieczynny') || lowerText.includes('closed')) {
    return false;
  }
  if (lowerText.includes('otwart') || lowerText.includes('czynny') || lowerText.includes('open')) {
    return true;
  }
  return null;
}

/**
 * Fetch conditions for all resorts in a region
 */
export async function fetchResortConditions(
  region: string,
  signal?: AbortSignal
): Promise<ResortConditions[]> {
  const configs = RESORT_CONFIG[region] || [];
  if (configs.length === 0) return [];

  const results: ResortConditions[] = [];

  for (const config of configs) {
    try {
      const html = await fetchResortPage(config.sourceUrl, signal);

      let conditions: ResortConditions;

      if (html) {
        // Try to extract data from page
        conditions = {
          name: config.name,
          region: config.region,
          snowDepthBase: parseSnowDepth(html),
          snowDepthSummit: parseSnowDepth(html), // Often same value
          temperature: parseTemperature(html),
          windSpeed: null, // Hard to reliably extract
          isOpen: parseOpenStatus(html),
          openTrails: null,
          lastUpdate: new Date().toISOString(),
          sourceUrl: config.sourceUrl,
          canUseForDescent: true,
          nearbyRoutes: config.nearbyRoutes,
        };
      } else {
        // Return empty structure - we couldn't fetch
        conditions = {
          name: config.name,
          region: config.region,
          snowDepthBase: null,
          snowDepthSummit: null,
          temperature: null,
          windSpeed: null,
          isOpen: null,
          openTrails: null,
          lastUpdate: new Date().toISOString(),
          sourceUrl: config.sourceUrl,
          canUseForDescent: true,
          nearbyRoutes: config.nearbyRoutes,
        };
      }

      results.push(conditions);
    } catch (error) {
      console.warn(`Failed to fetch resort ${config.name}:`, error);
    }
  }

  return results;
}

/**
 * Get resort configs for a region (for display without fetching)
 */
export function getResortConfigs(region: string): ResortConfig[] {
  return RESORT_CONFIG[region] || [];
}

/**
 * Find resorts that could be descent alternatives for a route
 */
export function findDescentAlternatives(routeName: string, region: string): ResortConfig[] {
  const configs = RESORT_CONFIG[region] || [];
  return configs.filter(c => c.nearbyRoutes.some(r =>
    routeName.toLowerCase().includes(r.toLowerCase()) ||
    r.toLowerCase().includes(routeName.toLowerCase())
  ));
}
