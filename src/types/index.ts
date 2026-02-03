/**
 * Core type definitions for SkitourScout
 * @module types
 */

// Re-export confidence types
export * from './confidence';

/** Avalanche danger levels (European scale 1-5) */
export type AvalancheLevel = 1 | 2 | 3 | 4 | 5;

/** Weather condition types */
export type WeatherCondition =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'snow'
  | 'heavy_snow'
  | 'rain'
  | 'fog'
  | 'wind';

/** Route difficulty grades */
export type RouteDifficulty = 'easy' | 'moderate' | 'difficult' | 'expert';

/** Aspect/exposure of slopes */
export type Aspect = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/**
 * Weather data structure
 */
export interface WeatherData {
  /** Temperature in Celsius */
  temperature: number;
  /** Feels-like temperature */
  feelsLike: number;
  /** Weather condition */
  condition: WeatherCondition;
  /** Wind speed in km/h */
  windSpeed: number;
  /** Wind direction */
  windDirection: string;
  /** Humidity percentage */
  humidity: number;
  /** Visibility in km */
  visibility: number;
  /** Fresh snow in last 24h (cm) */
  freshSnow24h: number;
  /** Snow base depth (cm) */
  snowBase: number;
  /** Freezing level (m) */
  freezingLevel: number;
  /** Timestamp of data */
  timestamp: string;
  /** Data source */
  source: string;
}

/**
 * Avalanche report data
 */
export interface AvalancheReport {
  /** Current danger level */
  level: AvalancheLevel;
  /** Danger level trend */
  trend: 'increasing' | 'stable' | 'decreasing';
  /** Problem aspects */
  problemAspects: Aspect[];
  /** Altitude range where danger applies */
  altitudeRange: {
    from: number;
    to: number;
  };
  /** Main avalanche problems */
  problems: string[];
  /** Report validity period */
  validUntil: string;
  /** When the report was issued */
  issuedAt?: string;
  /** Source organization */
  source: string;
  /** Full report URL */
  reportUrl?: string;
}

/**
 * Ski touring route definition
 */
export interface Route {
  /** Unique identifier */
  id: string;
  /** Route name */
  name: string;
  /** Region/area */
  region: string;
  /** Starting point coordinates */
  startPoint: {
    lat: number;
    lng: number;
    altitude: number;
  };
  /** Summit/endpoint coordinates */
  summit: {
    lat: number;
    lng: number;
    altitude: number;
  };
  /** Vertical gain in meters */
  elevation: number;
  /** Distance in km */
  distance: number;
  /** Difficulty grade */
  difficulty: RouteDifficulty;
  /** Main aspects of the route */
  aspects: Aspect[];
  /** Estimated duration in hours */
  duration: number;
  /** Route description */
  description?: string;
}

/**
 * Evaluated route with condition scoring
 */
export interface EvaluatedRoute extends Route {
  /** Overall condition score (0-100) */
  conditionScore: number;
  /** Score breakdown */
  scoreBreakdown: {
    weather: number;
    avalanche: number;
    snowConditions: number;
    crowding: number;
  };
  /** AI-generated recommendation */
  recommendation: string;
  /** Risk factors identified */
  riskFactors: string[];
  /** Best time to go */
  optimalTime?: string;
  /** Last evaluation timestamp */
  evaluatedAt: string;
}

/**
 * Social media post/intel
 */
export interface SocialIntel {
  /** Unique identifier */
  id: string;
  /** Source platform */
  platform: 'facebook' | 'instagram' | 'twitter' | 'strava';
  /** Author name/handle */
  author: string;
  /** Post content (summarized) */
  content: string;
  /** Original post URL */
  url?: string;
  /** Related route if identified */
  relatedRouteId?: string;
  /** Mentioned location */
  location?: string;
  /** Post timestamp */
  postedAt: string;
  /** Scraped timestamp */
  scrapedAt: string;
  /** Sentiment analysis */
  sentiment: 'positive' | 'neutral' | 'negative';
  /** Key conditions mentioned */
  conditions?: string[];
}

/**
 * Agent execution result
 */
export interface AgentResult<T = unknown> {
  /** Whether execution was successful */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Execution duration in ms */
  duration: number;
  /** Timestamp */
  timestamp: string;
  /** Agent that produced the result */
  agentId: string;
}

/**
 * Agent status
 */
export type AgentStatus = 'idle' | 'running' | 'error' | 'disabled';

/**
 * Agent metadata
 */
export interface AgentInfo {
  /** Unique agent identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of agent purpose */
  description: string;
  /** Current status */
  status: AgentStatus;
  /** Last run timestamp */
  lastRun?: string;
  /** Last error if any */
  lastError?: string;
}

/** LLM provider type */
export type LLMProvider = 'ollama' | 'openrouter';

/**
 * Application configuration
 */
export interface AppConfig {
  /** Preferred region */
  region: string;
  /** Refresh interval in minutes */
  refreshInterval: number;
  /** Enabled agents */
  enabledAgents: string[];
  /** MCP server configurations */
  mcpServers: MCPServerConfig[];
  /** LLM provider to use */
  llmProvider: LLMProvider;
  /** Ollama base URL */
  ollamaUrl: string;
  /** Ollama model name */
  ollamaModel: string;
  /** OpenRouter API key */
  openrouterApiKey?: string;
  /** OpenRouter model */
  openrouterModel: string;
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  /** Server identifier */
  id: string;
  /** Server name */
  name: string;
  /** Server URL or command */
  endpoint: string;
  /** Server type */
  type: 'stdio' | 'http' | 'websocket';
  /** Whether server is enabled */
  enabled: boolean;
  /** Additional server options */
  options?: Record<string, unknown>;
}

/**
 * Dashboard state
 */
export interface DashboardState {
  /** Current avalanche report */
  avalancheReport: AvalancheReport | null;
  /** Current weather data */
  weather: WeatherData | null;
  /** Evaluated routes */
  routes: EvaluatedRoute[];
  /** Loading states */
  loading: {
    weather: boolean;
    avalanche: boolean;
    routes: boolean;
    social: boolean;
  };
  /** Last refresh timestamp */
  lastRefresh: string | null;
}

/**
 * Cache entry for local storage
 */
export interface CacheEntry<T> {
  /** Cached data */
  data: T;
  /** Cache timestamp */
  cachedAt: string;
  /** Expiry timestamp */
  expiresAt: string;
  /** Cache key */
  key: string;
}
