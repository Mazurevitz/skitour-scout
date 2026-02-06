/**
 * Weather Agent
 *
 * Fetches and processes weather data for ski touring conditions.
 * Uses Open-Meteo API (free, no API key required) for weather data.
 *
 * @module agents/WeatherAgent
 */

import { BaseAgent, type AgentContext } from './BaseAgent';
import type { WeatherData, WeatherCondition, ElevationWeather, ElevationWeatherPoint } from '@/types';

/**
 * Weather agent input parameters
 */
export interface WeatherInput {
  /** Latitude of location */
  latitude: number;
  /** Longitude of location */
  longitude: number;
  /** Altitude in meters (for accurate data) */
  altitude?: number;
}

/**
 * Open-Meteo API response structure
 */
interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    relative_humidity_2m: number;
    visibility: number;
    snowfall: number;
    snow_depth: number;
  };
  daily: {
    snowfall_sum: number[];
  };
  hourly?: {
    freezing_level_height: number[];
  };
}

/**
 * Map Open-Meteo weather codes to our condition types
 */
function mapWeatherCode(code: number): WeatherCondition {
  // WMO Weather interpretation codes
  // https://open-meteo.com/en/docs
  if (code === 0) return 'clear';
  if (code <= 3) return 'partly_cloudy';
  if (code <= 48) return 'fog';
  if (code <= 55) return 'rain';
  if (code <= 65) return 'rain';
  if (code <= 67) return 'rain';
  if (code <= 75) return 'snow';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rain';
  if (code <= 86) return 'heavy_snow';
  if (code >= 95) return 'rain'; // Thunderstorm
  return 'cloudy';
}

/**
 * Map wind direction degrees to compass direction
 */
function mapWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

/**
 * Weather Agent for fetching mountain weather data
 *
 * @example
 * ```typescript
 * const agent = new WeatherAgent();
 * const result = await agent.run(
 *   { latitude: 49.23, longitude: 19.98 },
 *   { region: 'Tatry' }
 * );
 * ```
 */
export class WeatherAgent extends BaseAgent<WeatherInput, WeatherData> {
  private static readonly API_BASE = 'https://api.open-meteo.com/v1/forecast';

  constructor() {
    super({
      id: 'weather',
      name: 'Weather Agent',
      description: 'Fetches real-time weather data for ski touring conditions',
      cacheTtl: 30 * 60 * 1000, // 30 minutes
    });
  }

  /**
   * Fetch weather data from Open-Meteo API
   */
  protected async executeInternal(
    input: WeatherInput,
    context: AgentContext
  ): Promise<WeatherData> {
    this.log(`Fetching weather for ${input.latitude}, ${input.longitude}`);

    // Check for abort signal
    if (context.signal?.aborted) {
      throw new Error('Request aborted');
    }

    const params = new URLSearchParams({
      latitude: input.latitude.toString(),
      longitude: input.longitude.toString(),
      current: [
        'temperature_2m',
        'apparent_temperature',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
        'relative_humidity_2m',
        'visibility',
        'snowfall',
        'snow_depth',
      ].join(','),
      daily: 'snowfall_sum',
      hourly: 'freezing_level_height',
      timezone: 'auto',
      forecast_days: '1',
    });

    const url = `${WeatherAgent.API_BASE}?${params}`;

    try {
      const response = await fetch(url, {
        signal: context.signal,
      });

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }

      const data: OpenMeteoResponse = await response.json();
      return this.transformResponse(data, input);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Weather fetch aborted');
      }
      throw error;
    }
  }

  /**
   * Transform API response to our WeatherData format
   */
  private transformResponse(response: OpenMeteoResponse, _input: WeatherInput): WeatherData {
    const current = response.current;

    // Get freezing level from hourly data (current hour)
    const freezingLevel = response.hourly?.freezing_level_height?.[
      new Date().getHours()
    ] ?? 2500;

    // Calculate fresh snow (sum of last 24h)
    const freshSnow24h = response.daily?.snowfall_sum?.[0] ?? 0;

    return {
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      condition: mapWeatherCode(current.weather_code),
      windSpeed: Math.round(current.wind_speed_10m),
      windDirection: mapWindDirection(current.wind_direction_10m),
      humidity: current.relative_humidity_2m,
      visibility: Math.round((current.visibility || 10000) / 1000), // Convert to km
      freshSnow24h: Math.round(freshSnow24h * 10) / 10, // cm
      snowBase: Math.round((current.snow_depth || 0) * 100), // Convert m to cm
      freezingLevel: Math.round(freezingLevel),
      timestamp: new Date().toISOString(),
      source: 'Open-Meteo',
    };
  }

  /**
   * Get weather locations by region
   */
  static getLocationsByRegion(region: string): Record<string, WeatherInput> {
    const locations: Record<string, Record<string, WeatherInput>> = {
      'Tatry': {
        'Kasprowy Wierch': { latitude: 49.2317, longitude: 19.9817, altitude: 1987 },
        'Morskie Oko': { latitude: 49.2014, longitude: 20.0714, altitude: 1395 },
        'Zakopane': { latitude: 49.2992, longitude: 19.9496, altitude: 838 },
        'Dolina Pięciu Stawów': { latitude: 49.2125, longitude: 20.0458, altitude: 1650 },
        'Hala Gąsienicowa': { latitude: 49.2383, longitude: 20.0033, altitude: 1520 },
      },
      'Beskid Śląski': {
        'Skrzyczne': { latitude: 49.6847, longitude: 19.0306, altitude: 1257 },
        'Pilsko': { latitude: 49.5456, longitude: 19.3297, altitude: 1557 },
        'Rycerzowa': { latitude: 49.4728, longitude: 19.1039, altitude: 1226 },
        'Barania Góra': { latitude: 49.5711, longitude: 19.0389, altitude: 1220 },
        'Błatnia': { latitude: 49.6583, longitude: 19.0028, altitude: 917 },
        'Szczyrk': { latitude: 49.7181, longitude: 19.0339, altitude: 500 },
      },
      'Beskid Żywiecki': {
        'Babia Góra': { latitude: 49.5731, longitude: 19.5294, altitude: 1725 },
        'Pilsko': { latitude: 49.5456, longitude: 19.3297, altitude: 1557 },
        'Romanka': { latitude: 49.5583, longitude: 19.3556, altitude: 1366 },
        'Hala Miziowa': { latitude: 49.5617, longitude: 19.3417, altitude: 1330 },
      },
    };
    return locations[region] || locations['Beskid Śląski'];
  }

  /**
   * Get weather for popular Tatra Mountains locations (legacy)
   */
  static getDefaultLocations(): Record<string, WeatherInput> {
    return this.getLocationsByRegion('Tatry');
  }

  /**
   * Get elevation pairs (valley + summit) for a region
   * Used for showing temperature gradient on routes
   */
  static getElevationPairs(region: string): { name: string; valley: WeatherInput; summit: WeatherInput }[] {
    const pairs: Record<string, { name: string; valley: WeatherInput; summit: WeatherInput }[]> = {
      'Beskid Śląski': [
        {
          name: 'Skrzyczne',
          valley: { latitude: 49.7181, longitude: 19.0339, altitude: 500 },
          summit: { latitude: 49.6847, longitude: 19.0306, altitude: 1257 },
        },
        {
          name: 'Pilsko',
          valley: { latitude: 49.5617, longitude: 19.3417, altitude: 700 },
          summit: { latitude: 49.5456, longitude: 19.3297, altitude: 1557 },
        },
        {
          name: 'Barania Góra',
          valley: { latitude: 49.5850, longitude: 19.0450, altitude: 650 },
          summit: { latitude: 49.5711, longitude: 19.0389, altitude: 1220 },
        },
      ],
      'Beskid Żywiecki': [
        {
          name: 'Babia Góra',
          valley: { latitude: 49.5850, longitude: 19.5200, altitude: 650 },
          summit: { latitude: 49.5731, longitude: 19.5294, altitude: 1725 },
        },
        {
          name: 'Pilsko',
          valley: { latitude: 49.5617, longitude: 19.3417, altitude: 700 },
          summit: { latitude: 49.5456, longitude: 19.3297, altitude: 1557 },
        },
      ],
      'Tatry': [
        {
          name: 'Kasprowy Wierch',
          valley: { latitude: 49.2700, longitude: 19.9817, altitude: 1000 },
          summit: { latitude: 49.2317, longitude: 19.9817, altitude: 1987 },
        },
        {
          name: 'Morskie Oko → Rysy',
          valley: { latitude: 49.2014, longitude: 20.0714, altitude: 1395 },
          summit: { latitude: 49.1794, longitude: 20.0881, altitude: 2499 },
        },
        {
          name: 'Hala Gąsienicowa → Świnica',
          valley: { latitude: 49.2383, longitude: 20.0033, altitude: 1520 },
          summit: { latitude: 49.2186, longitude: 20.0047, altitude: 2301 },
        },
      ],
    };
    return pairs[region] || pairs['Beskid Śląski'];
  }

  /**
   * Fetch weather for a single point (internal helper)
   */
  private async fetchPointWeather(
    input: WeatherInput,
    name: string,
    signal?: AbortSignal
  ): Promise<ElevationWeatherPoint> {
    const params = new URLSearchParams({
      latitude: input.latitude.toString(),
      longitude: input.longitude.toString(),
      current: [
        'temperature_2m',
        'apparent_temperature',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
      ].join(','),
      timezone: 'auto',
    });

    // Add elevation to get altitude-corrected temperature
    if (input.altitude) {
      params.set('elevation', input.altitude.toString());
    }

    const url = `${WeatherAgent.API_BASE}?${params}`;
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    const current = data.current;

    return {
      name,
      altitude: input.altitude || 0,
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      windSpeed: Math.round(current.wind_speed_10m),
      windDirection: mapWindDirection(current.wind_direction_10m),
      condition: mapWeatherCode(current.weather_code),
    };
  }

  /**
   * Fetch multi-elevation weather for a region
   * Returns weather at valley and summit for each main peak
   */
  async fetchElevationWeather(
    region: string,
    signal?: AbortSignal
  ): Promise<ElevationWeather[]> {
    const pairs = WeatherAgent.getElevationPairs(region);
    const results: ElevationWeather[] = [];

    this.log(`Fetching elevation weather for ${region} (${pairs.length} peaks)`);

    // Process each pair individually for resilience
    for (const pair of pairs) {
      try {
        // Fetch valley and summit in parallel
        const [valleyResult, summitResult] = await Promise.allSettled([
          this.fetchPointWeather(pair.valley, `${pair.name} (dolina)`, signal),
          this.fetchPointWeather(pair.summit, `${pair.name} (szczyt)`, signal),
        ]);

        // Skip if either failed
        if (valleyResult.status !== 'fulfilled' || summitResult.status !== 'fulfilled') {
          this.warn(`Skipping ${pair.name} - fetch failed`);
          continue;
        }

        const valley = valleyResult.value;
        const summit = summitResult.value;

        // Fetch freezing level and snow (optional - don't fail if this errors)
        let freezingLevel = 1500;
        let freshSnow24h = 0;

        try {
          const summitParams = new URLSearchParams({
            latitude: pair.summit.latitude.toString(),
            longitude: pair.summit.longitude.toString(),
            hourly: 'freezing_level_height',
            daily: 'snowfall_sum',
            timezone: 'auto',
            forecast_days: '1',
          });

          const extraResponse = await fetch(`${WeatherAgent.API_BASE}?${summitParams}`, { signal });
          if (extraResponse.ok) {
            const extraData = await extraResponse.json();
            freezingLevel = extraData.hourly?.freezing_level_height?.[new Date().getHours()] ?? 1500;
            freshSnow24h = extraData.daily?.snowfall_sum?.[0] ?? 0;
          }
        } catch {
          // Use defaults - this is optional data
        }

        results.push({
          valley,
          summit,
          tempDifference: summit.temperature - valley.temperature,
          freezingLevel: Math.round(freezingLevel),
          freshSnow24h: Math.round(freshSnow24h * 10) / 10,
          timestamp: new Date().toISOString(),
          source: 'Open-Meteo',
        });

        this.log(`${pair.name}: ${valley.temperature}°C → ${summit.temperature}°C`);
      } catch (error) {
        this.warn(`Failed to fetch ${pair.name}:`, error);
      }
    }

    this.log(`Fetched elevation weather for ${results.length}/${pairs.length} peaks`);
    return results;
  }
}
