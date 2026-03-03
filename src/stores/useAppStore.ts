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
import { useReportsStore } from './useReportsStore';
import { getRoutesForRegion } from '@/data/routes';

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
 * Default configuration
 */
const defaultConfig: AppConfig = {
  region: 'Wszystkie',
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

        // Recalculate relevance scores with new weather data
        const currentWeather = elevationData.value[0];
        useReportsStore.getState().calculateAllRelevance(currentWeather);
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
        // Provide more helpful Polish error messages
        let errorMessage = 'Wyszukiwanie nie powiodło się';
        if (result.error) {
          if (result.error.includes('timeout') || result.error.includes('Timeout')) {
            errorMessage = 'Przekroczono limit czasu wyszukiwania. Spróbuj ponownie.';
          } else if (result.error.includes('network') || result.error.includes('fetch')) {
            errorMessage = 'Błąd połączenia. Sprawdź internet i spróbuj ponownie.';
          } else if (result.error.includes('rate') || result.error.includes('limit')) {
            errorMessage = 'Zbyt wiele zapytań. Poczekaj chwilę i spróbuj ponownie.';
          }
        }
        set({
          searchStatus: {
            status: 'error',
            message: errorMessage,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      console.error('Web search failed:', error);

      // Categorize errors for better user feedback
      let errorMessage = 'Wystąpił nieoczekiwany błąd wyszukiwania';
      if (error instanceof Error) {
        if (!navigator.onLine) {
          errorMessage = 'Brak połączenia z internetem. Połącz się i spróbuj ponownie.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorMessage = 'Nie można połączyć się z serwerem wyszukiwania.';
        } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          errorMessage = 'Wyszukiwanie trwało zbyt długo. Spróbuj ponownie.';
        } else if (error.message.includes('abort') || error.message.includes('Abort')) {
          errorMessage = 'Wyszukiwanie zostało przerwane.';
        }
      }

      set({
        searchStatus: {
          status: 'error',
          message: errorMessage,
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
