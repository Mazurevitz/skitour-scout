# SkitourScout Architecture

## Overview

SkitourScout is a macOS Menu Bar application built with Tauri 2.0 that provides ski touring route recommendations based on real-time data analysis. The application uses a modular agent architecture to gather, process, and present data from multiple sources.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SkitourScout                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │   Tauri Shell    │    │         React Frontend           │  │
│  │   (Rust/Native)  │◄──►│     (TypeScript + Tailwind)      │  │
│  │                  │    │                                  │  │
│  │  - Menu Bar Tray │    │  ┌────────────────────────────┐  │  │
│  │  - Window Mgmt   │    │  │       Dashboard UI         │  │  │
│  │  - Native APIs   │    │  │  - Avalanche Indicator     │  │  │
│  │  - Local Storage │    │  │  - Weather Card            │  │  │
│  └──────────────────┘    │  │  - Route List              │  │  │
│                          │  │  - Social Feed             │  │  │
│                          │  └────────────────────────────┘  │  │
│                          │                                  │  │
│                          │  ┌────────────────────────────┐  │  │
│                          │  │      Zustand Store         │  │  │
│                          │  │  - App State               │  │  │
│                          │  │  - Configuration           │  │  │
│                          │  │  - Cache Management        │  │  │
│                          │  └────────────────────────────┘  │  │
│                          └──────────────────────────────────┘  │
│                                          │                      │
│  ┌───────────────────────────────────────▼──────────────────┐  │
│  │                    Agent System                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │                   Orchestrator                       │ │  │
│  │  │  - Coordinates all agents                           │ │  │
│  │  │  - Parallel execution                               │ │  │
│  │  │  - Result aggregation                               │ │  │
│  │  │  - Route evaluation                                 │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │          │              │              │                  │  │
│  │          ▼              ▼              ▼                  │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │  │
│  │  │ Weather     │ │ Safety      │ │ Social      │        │  │
│  │  │ Agent       │ │ Agent       │ │ Agent       │        │  │
│  │  │             │ │             │ │             │        │  │
│  │  │ Open-Meteo  │ │ TOPR/GOPR   │ │ FB/IG       │        │  │
│  │  │ API         │ │ Integration │ │ Scraping    │        │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    MCP Bridge (Optional)                  │  │
│  │  - Playwright MCP for scraping                           │  │
│  │  - Fetch MCP for enhanced HTTP                           │  │
│  │  - Custom tool integration                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
skitour-scout/
├── src/                    # Frontend source code
│   ├── agents/             # Agent system
│   │   ├── BaseAgent.ts    # Abstract base class
│   │   ├── Orchestrator.ts # Task coordinator
│   │   ├── WeatherAgent.ts # Weather data fetching
│   │   ├── SafetyAgent.ts  # Avalanche reports
│   │   ├── SocialAgent.ts  # Social media scraping
│   │   └── index.ts        # Exports
│   │
│   ├── components/         # React UI components
│   │   ├── Dashboard.tsx   # Main view
│   │   ├── AvalancheIndicator.tsx
│   │   ├── WeatherCard.tsx
│   │   ├── RouteCard.tsx
│   │   ├── SocialFeed.tsx
│   │   ├── Settings.tsx
│   │   └── index.ts
│   │
│   ├── config/             # Configuration
│   │   ├── mcp.ts          # MCP server configs
│   │   └── index.ts
│   │
│   ├── stores/             # State management
│   │   ├── useAppStore.ts  # Zustand store
│   │   └── index.ts
│   │
│   ├── types/              # TypeScript types
│   │   └── index.ts
│   │
│   ├── App.tsx             # Root component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
│
├── src-tauri/              # Tauri/Rust backend
│   ├── src/
│   │   ├── lib.rs          # Main library
│   │   └── main.rs         # Entry point
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
│
├── public/                 # Static assets
├── ARCHITECTURE.md         # This file
├── CONTRIBUTING.md         # Contribution guide
└── package.json            # Node dependencies
```

## Agent System

### Design Philosophy

The agent system follows these principles:

1. **Single Responsibility**: Each agent handles one data source
2. **Consistent Interface**: All agents extend `BaseAgent` with uniform methods
3. **Error Isolation**: Agent failures don't crash the entire system
4. **Parallel Execution**: Independent agents run concurrently
5. **Caching Support**: Built-in TTL-based caching

### BaseAgent Abstract Class

```typescript
abstract class BaseAgent<TInput, TOutput> {
  // Configuration
  protected config: AgentConfig;
  protected status: AgentStatus;

  // Core methods
  abstract executeInternal(input: TInput, context: AgentContext): Promise<TOutput>;
  run(input: TInput, context: AgentContext): Promise<AgentResult<TOutput>>;

  // Utilities
  getInfo(): AgentInfo;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
}
```

### Agent Context

Every agent receives an `AgentContext` containing:

- `region`: Target geographic region
- `anthropicApiKey`: Optional API key for LLM calls
- `signal`: AbortSignal for cancellation
- `metadata`: Additional context data

### Orchestrator Flow

```
User Trigger (Click/Timer)
         │
         ▼
  ┌──────────────┐
  │ Orchestrator │
  │    .run()    │
  └──────┬───────┘
         │
    ┌────┴────┬─────────────┐
    │         │             │
    ▼         ▼             ▼
┌───────┐ ┌───────┐   ┌───────────┐
│Weather│ │Safety │   │  Social   │
│ Agent │ │ Agent │   │   Agent   │
└───┬───┘ └───┬───┘   └─────┬─────┘
    │         │             │
    ▼         ▼             ▼
┌───────┐ ┌───────┐   ┌───────────┐
│ Fetch │ │ Fetch │   │  Scrape   │
│ Meteo │ │ TOPR  │   │  FB/IG    │
└───┬───┘ └───┬───┘   └─────┬─────┘
    │         │             │
    └────┬────┴─────────────┘
         │
         ▼
  ┌──────────────┐
  │    Route     │
  │  Evaluation  │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │   Aggregate  │
  │   Results    │
  └──────┬───────┘
         │
         ▼
    Update Store
         │
         ▼
     UI Updates
```

## Route Evaluation Algorithm

Routes are scored (0-100) based on four factors:

### 1. Weather Score (25%)
- Clear conditions: +20 points
- Low wind (<20 km/h): +10 points
- Good visibility (>10km): +10 points
- Precipitation: -20 points

### 2. Avalanche Score (25%)
- Base: 100 - (danger_level - 1) * 25
- Problem aspect match: -20 points
- Altitude in danger range: -15 points

### 3. Snow Conditions Score (25%)
- Fresh snow 1-30cm: +30 points
- Good base depth: +10 points
- Too much fresh snow: risk indicator

### 4. Crowding Score (25%)
- Based on social media activity
- More posts = potentially more crowded
- Recent reports = better intel

## Data Flow

### Weather Data
```
Open-Meteo API → WeatherAgent → Transform → Store → WeatherCard
```

### Avalanche Data
```
TOPR/GOPR (mock) → SafetyAgent → Transform → Store → AvalancheIndicator
```

### Social Intel
```
Facebook/Instagram → SocialAgent → Summarize → Store → SocialFeed
       ↑
  (via MCP/Playwright)
```

## MCP Integration

The app is designed for Model Context Protocol integration:

### Supported Servers

1. **playwright-mcp**: Web scraping for social media
2. **fetch-mcp**: Enhanced HTTP requests

### Configuration

MCP servers are configured in `src/config/mcp.ts`:

```typescript
const config: MCPServerConfig = {
  id: 'playwright-mcp',
  name: 'Playwright MCP',
  endpoint: 'npx @anthropic-ai/playwright-mcp',
  type: 'stdio',
  enabled: false,
};
```

## State Management

Using Zustand for lightweight state management:

```typescript
interface AppState {
  // Data
  weather: WeatherData | null;
  avalancheReport: AvalancheReport | null;
  routes: EvaluatedRoute[];
  socialIntel: SocialIntel[];

  // UI State
  loading: LoadingState;
  lastRefresh: string | null;

  // Config
  config: AppConfig;
}
```

## Caching Strategy

### Local Cache (via Tauri Store)
- Weather data: 30 minutes TTL
- Avalanche reports: 1 hour TTL
- Social intel: 15 minutes TTL
- Routes: Until next evaluation

### Cache Keys
```
weather:{lat}:{lng}:{timestamp}
avalanche:{region}:{date}
social:{region}:{timestamp}
```

## Security Considerations

1. **API Keys**: Stored locally via Tauri Store, never transmitted
2. **CSP**: Content Security Policy configured in tauri.conf.json
3. **Sandboxing**: Tauri's built-in security sandbox
4. **No Secrets in Code**: Configuration via environment or settings

## Performance Optimizations

1. **Parallel Agent Execution**: All agents run concurrently
2. **Request Deduplication**: Prevents duplicate API calls
3. **Lazy Loading**: Components load data on demand
4. **Memoization**: React memo for expensive renders
5. **Efficient Re-renders**: Zustand selectors for granular updates

## Future Considerations

### Planned Agents
- **WebcamAgent**: Ski resort webcam analysis
- **TrailReportAgent**: Official trail condition reports
- **GPSAgent**: Track recording and analysis

### Planned Features
- Offline mode with cached data
- Push notifications for conditions
- Route planning and GPS export
- Historical data analysis
