/**
 * Main Application Store
 *
 * Zustand store for managing application state including
 * weather data, routes, social intel, and configuration.
 *
 * @module stores/useAppStore
 */

import { create } from 'zustand';
import type {
  DashboardState,
  Route,
  Aspect,
  ElevationWeather,
} from '@/types';
import {
  Orchestrator,
  WeatherAgent,
  WebSearchAgent,
  type AgentContext,
  type ConditionReport,
} from '@/agents';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * Simplified app configuration (LLM config moved to server-side)
 */
export interface AppConfig {
  region: string;
  refreshInterval: number;
  enabledAgents: string[];
}

/**
 * Search status for feedback
 */
interface SearchStatus {
  status: 'idle' | 'success' | 'error' | 'no_results';
  message?: string;
  timestamp?: string;
}

/**
 * Error state for user feedback
 */
interface AppError {
  type: 'weather' | 'avalanche' | 'routes' | 'general';
  message: string;
  timestamp: string;
}

/**
 * Application store state
 */
interface AppState extends DashboardState {
  config: AppConfig;
  initialized: boolean;
  orchestrator: Orchestrator;
  webReports: ConditionReport[];
  searchingWeb: boolean;
  searchStatus: SearchStatus;
  /** Multi-elevation weather data */
  elevationWeather: ElevationWeather[];
  /** Error state for user feedback */
  error: AppError | null;
}

/**
 * Application store actions
 */
interface AppActions {
  initialize: () => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshWeather: () => Promise<void>;
  searchWeb: (location?: string) => Promise<void>;
  clearData: () => void;
  updateConfig: (config: Partial<AppConfig>) => void;
  clearError: () => void;
}

/**
 * Routes organized by region
 */
const routesByRegion: Record<string, Route[]> = {
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
 * Get routes for a region
 */
function getRoutesForRegion(region: string): Route[] {
  return routesByRegion[region] || routesByRegion['Beskid Śląski'];
}

/**
 * Default configuration
 */
const defaultConfig: AppConfig = {
  region: 'Beskid Śląski',
  refreshInterval: 30,
  enabledAgents: ['weather', 'safety', 'social'],
};

/**
 * Initial dashboard state
 */
const initialDashboardState: DashboardState = {
  avalancheReport: null,
  weather: null,
  routes: [],
  loading: {
    weather: false,
    avalanche: false,
    routes: false,
    social: false,
  },
  lastRefresh: null,
};

/**
 * Application store
 */
export const useAppStore = create<AppState & AppActions>((set, get) => ({
  webReports: [],
  searchingWeb: false,
  searchStatus: { status: 'idle' },
  elevationWeather: [],
  error: null,
  ...initialDashboardState,
  config: defaultConfig,
  initialized: false,
  orchestrator: new Orchestrator(),

  initialize: async () => {
    const { refreshAll } = get();

    // Try to load saved config from localStorage (region, refresh interval only)
    try {
      const savedConfig = localStorage.getItem('app_config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        set((state) => ({
          config: {
            ...state.config,
            region: parsed.region || state.config.region,
            refreshInterval: parsed.refreshInterval || state.config.refreshInterval,
          },
        }));
      }
    } catch {
      // localStorage not available or invalid JSON
    }

    set({ initialized: true });

    // Initial data fetch
    await refreshAll();
  },

  refreshAll: async () => {
    const { orchestrator, config } = get();

    set({
      loading: {
        weather: true,
        avalanche: true,
        routes: true,
        social: true,
      },
    });

    const regionLocations = WeatherAgent.getLocationsByRegion(config.region);
    const locationNames = Object.keys(regionLocations);
    const primaryLocation = regionLocations[locationNames[0]];
    const regionRoutes = getRoutesForRegion(config.region);

    // LLM is enabled if Supabase is configured (server handles the API key)
    const context: AgentContext = {
      region: config.region,
      llmEnabled: isSupabaseConfigured(),
    };

    try {
      // Fetch orchestrator data and elevation weather in parallel
      const weatherAgent = new WeatherAgent();

      const [result, elevationData] = await Promise.allSettled([
        orchestrator.run(
          {
            location: primaryLocation,
            fetchAvalanche: true,
            routes: regionRoutes,
          },
          context
        ),
        weatherAgent.fetchElevationWeather(config.region),
      ]);

      // Handle orchestrator result
      if (result.status === 'fulfilled' && result.value.success && result.value.data) {
        set({
          weather: result.value.data.weather ?? null,
          avalancheReport: result.value.data.avalanche ?? null,
          routes: result.value.data.routes ?? [],
          lastRefresh: new Date().toISOString(),
          error: null, // Clear any previous error on success
        });
      } else if (result.status === 'rejected') {
        console.error('Orchestrator failed:', result.reason);
        set({
          error: {
            type: 'general',
            message: 'Nie udało się pobrać danych pogodowych. Sprawdź połączenie.',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Handle elevation weather result
      if (elevationData.status === 'fulfilled') {
        set({ elevationWeather: elevationData.value });
      } else {
        console.error('Elevation weather failed:', elevationData.reason);
        // Don't overwrite more critical errors
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
      set({
        error: {
          type: 'general',
          message: error instanceof Error ? error.message : 'Wystąpił błąd podczas odświeżania',
          timestamp: new Date().toISOString(),
        },
      });
    } finally {
      set({
        loading: {
          weather: false,
          avalanche: false,
          routes: false,
          social: false,
        },
      });
    }
  },

  refreshWeather: async () => {
    const { config } = get();

    set((state) => ({
      loading: { ...state.loading, weather: true },
    }));

    const weatherAgent = new WeatherAgent();
    const defaultLocation = WeatherAgent.getDefaultLocations()['Kasprowy Wierch'];

    try {
      const result = await weatherAgent.run(defaultLocation, {
        region: config.region,
      });

      if (result.success && result.data) {
        set({ weather: result.data });
      }
    } finally {
      set((state) => ({
        loading: { ...state.loading, weather: false },
      }));
    }
  },

  searchWeb: async (specificLocation?: string) => {
    const { config } = get();

    set({ searchingWeb: true, searchStatus: { status: 'idle' } });

    const searchAgent = new WebSearchAgent();
    const regionLocations = WeatherAgent.getLocationsByRegion(config.region);
    const locationNames = Object.keys(regionLocations);

    const searchLocations = specificLocation ? [specificLocation] : locationNames;
    const searchRegion = specificLocation || config.region;

    const context: AgentContext = {
      region: config.region,
      llmEnabled: isSupabaseConfigured(),
    };

    try {
      const result = await searchAgent.run(
        {
          region: searchRegion,
          locations: searchLocations,
          limit: 5,
        },
        context
      );

      if (result.success && result.data) {
        const reports = result.data.data;
        const notes = result.data.confidence?.notes || '';
        if (reports.length > 0) {
          set({
            webReports: reports,
            searchStatus: {
              status: 'success',
              message: notes || `Found ${reports.length} report${reports.length > 1 ? 's' : ''}`,
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          set({
            searchStatus: {
              status: 'no_results',
              message: notes || 'No recent reports found for this region',
              timestamp: new Date().toISOString(),
            },
          });
        }
      } else {
        set({
          searchStatus: {
            status: 'error',
            message: result.error || 'Search failed',
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      console.error('Web search failed:', error);
      set({
        searchStatus: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Search failed unexpectedly',
          timestamp: new Date().toISOString(),
        },
      });
    } finally {
      set({ searchingWeb: false });
    }
  },

  clearData: () => {
    set({ ...initialDashboardState, webReports: [] });
  },

  updateConfig: (newConfig: Partial<AppConfig>) => {
    set((state) => {
      const updated = { ...state.config, ...newConfig };

      // Save to localStorage
      try {
        localStorage.setItem('app_config', JSON.stringify({
          region: updated.region,
          refreshInterval: updated.refreshInterval,
        }));
      } catch {
        // localStorage not available
      }

      return { config: updated };
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
