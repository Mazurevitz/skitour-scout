# Contributing to SkitourScout

Thank you for your interest in contributing to SkitourScout! This guide will help you understand the codebase and how to add new features.

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Rust (latest stable)
- Tauri CLI: `cargo install tauri-cli`
- macOS (for menu bar functionality)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd skitour-scout

# Install dependencies
npm install

# Run in development mode
npm run tauri:dev
```

### Project Structure

```
src/
├── agents/         # Data fetching agents
├── components/     # React UI components
├── config/         # Configuration files
├── stores/         # Zustand state stores
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Adding a New Agent

Agents are the core data-fetching components of SkitourScout. Here's how to create a new one.

### Step 1: Create the Agent File

Create a new file in `src/agents/`:

```typescript
// src/agents/MyNewAgent.ts

import { BaseAgent, type AgentContext } from './BaseAgent';

/**
 * Input parameters for MyNewAgent
 */
export interface MyNewInput {
  // Define your input parameters
  param1: string;
  param2?: number;
}

/**
 * Output data structure
 */
export interface MyNewOutput {
  // Define your output structure
  data: string;
  timestamp: string;
}

/**
 * MyNewAgent - Description of what this agent does
 *
 * @example
 * ```typescript
 * const agent = new MyNewAgent();
 * const result = await agent.run({ param1: 'value' }, context);
 * ```
 */
export class MyNewAgent extends BaseAgent<MyNewInput, MyNewOutput> {
  constructor() {
    super({
      id: 'mynew',              // Unique identifier
      name: 'My New Agent',     // Display name
      description: 'Fetches...',// What it does
      cacheTtl: 30 * 60 * 1000, // Cache duration (30 min)
    });
  }

  /**
   * Main execution logic
   */
  protected async executeInternal(
    input: MyNewInput,
    context: AgentContext
  ): Promise<MyNewOutput> {
    this.log(`Processing with param: ${input.param1}`);

    // Check for cancellation
    if (context.signal?.aborted) {
      throw new Error('Request aborted');
    }

    // Your data fetching logic here
    const response = await fetch('https://api.example.com/data');
    const data = await response.json();

    // Transform and return
    return {
      data: data.result,
      timestamp: new Date().toISOString(),
    };
  }
}
```

### Step 2: Export the Agent

Add the export to `src/agents/index.ts`:

```typescript
export { MyNewAgent, type MyNewInput, type MyNewOutput } from './MyNewAgent';
```

### Step 3: Integrate with Orchestrator

Update `src/agents/Orchestrator.ts` to include your agent:

```typescript
import { MyNewAgent, type MyNewInput } from './MyNewAgent';

export class Orchestrator extends BaseAgent<OrchestratorInput, OrchestratorOutput> {
  private myNewAgent: MyNewAgent;

  constructor() {
    super({...});
    this.myNewAgent = new MyNewAgent();
  }

  protected async executeInternal(input, context): Promise<OrchestratorOutput> {
    // Add to parallel tasks
    if (input.fetchMyNew) {
      tasks.push(
        this.myNewAgent.run(input.myNewParams, context).then(result => {
          myNewResult = result;
        })
      );
    }
    // ...
  }
}
```

### Step 4: Add Types

If your agent introduces new data types, add them to `src/types/index.ts`:

```typescript
export interface MyNewData {
  // Your type definition
}
```

### Step 5: Update Store

Add state and actions to `src/stores/useAppStore.ts`:

```typescript
interface AppState {
  myNewData: MyNewOutput | null;
  // ...
}

// In the store
myNewData: null,

refreshMyNew: async () => {
  const agent = new MyNewAgent();
  const result = await agent.run({...}, context);
  if (result.success) {
    set({ myNewData: result.data });
  }
},
```

### Step 6: Create UI Component

Create a component to display the data in `src/components/`:

```typescript
// src/components/MyNewCard.tsx

import type { MyNewOutput } from '@/agents';

interface MyNewCardProps {
  data: MyNewOutput | null;
  loading?: boolean;
}

export function MyNewCard({ data, loading }: MyNewCardProps) {
  if (loading) {
    return <div className="animate-pulse">...</div>;
  }

  if (!data) {
    return <div>No data available</div>;
  }

  return (
    <div className="bg-mountain-dark rounded-lg p-4">
      {/* Your UI here */}
    </div>
  );
}
```

## Adding a New Data Source

If you're adding a new external API or data source:

### 1. Document the API

Add documentation about the API in the agent file:

```typescript
/**
 * API Documentation
 *
 * Endpoint: https://api.example.com/v1
 * Auth: API key in header (X-API-Key)
 * Rate limit: 100 requests/minute
 *
 * @see https://docs.example.com/api
 */
```

### 2. Handle Errors Gracefully

Always handle potential errors:

```typescript
try {
  const response = await fetch(url, {
    headers: { 'X-API-Key': apiKey },
    signal: context.signal,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
} catch (error) {
  if (error.name === 'AbortError') {
    throw new Error('Request cancelled');
  }
  throw error;
}
```

### 3. Implement Caching

Use the built-in cache TTL or implement custom caching:

```typescript
constructor() {
  super({
    // ...
    cacheTtl: 60 * 60 * 1000, // 1 hour
  });
}
```

## MCP Integration

To integrate with Model Context Protocol:

### 1. Define the MCP Server Config

Add to `src/config/mcp.ts`:

```typescript
export const myMCPServer: MCPServerConfig = {
  id: 'my-mcp-server',
  name: 'My MCP Server',
  endpoint: 'npx @my/mcp-server',
  type: 'stdio',
  enabled: false,
  options: {
    // Server-specific options
  },
};
```

### 2. Use MCP Tools in Agent

```typescript
protected async executeInternal(input, context): Promise<Output> {
  // Check if MCP is available
  const mcpClient = context.metadata?.mcpClient as MCPClient;

  if (mcpClient) {
    // Use MCP tool
    const result = await mcpClient.callTool(
      'my-mcp-server',
      'fetch_data',
      { url: input.url }
    );
    return this.transformMCPResult(result);
  }

  // Fallback to direct fetch
  return this.directFetch(input);
}
```

## Code Style Guidelines

### TypeScript

- Use strict TypeScript (`strict: true`)
- Export types alongside implementations
- Use JSDoc comments for public APIs
- Prefer interfaces over type aliases for objects

### React Components

- Use functional components with hooks
- Keep components small and focused
- Use Tailwind CSS for styling
- Implement loading and error states

### Naming Conventions

- **Files**: PascalCase for components, camelCase for utilities
- **Components**: PascalCase (`WeatherCard`)
- **Hooks**: camelCase with `use` prefix (`useAppStore`)
- **Types**: PascalCase (`WeatherData`)
- **Constants**: SCREAMING_SNAKE_CASE

## Testing

### Unit Tests

```typescript
// src/agents/__tests__/WeatherAgent.test.ts
import { WeatherAgent } from '../WeatherAgent';

describe('WeatherAgent', () => {
  it('should fetch weather data', async () => {
    const agent = new WeatherAgent();
    const result = await agent.run(
      { latitude: 49.23, longitude: 19.98 },
      { region: 'Tatry' }
    );

    expect(result.success).toBe(true);
    expect(result.data?.temperature).toBeDefined();
  });
});
```

### Integration Tests

Test the full orchestration flow:

```typescript
describe('Orchestrator', () => {
  it('should aggregate all data sources', async () => {
    const orchestrator = new Orchestrator();
    const result = await orchestrator.run(
      { fetchAvalanche: true, fetchSocial: true },
      { region: 'Tatry' }
    );

    expect(result.data?.weather).toBeDefined();
    expect(result.data?.avalanche).toBeDefined();
  });
});
```

## Pull Request Process

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-new-agent`
3. **Commit** your changes with clear messages
4. **Test** your changes thoroughly
5. **Update** documentation if needed
6. **Submit** a pull request with:
   - Clear description of changes
   - Screenshots for UI changes
   - Test results

## Common Patterns

### Error Handling in Agents

```typescript
protected async executeInternal(input, context): Promise<Output> {
  try {
    // Main logic
  } catch (error) {
    // Log for debugging
    this.warn('Failed to fetch:', error);

    // Re-throw with context
    throw new Error(`${this.config.name}: ${error.message}`);
  }
}
```

### Conditional Data Fetching

```typescript
// Only fetch if enabled in config
if (config.enabledAgents.includes('myagent')) {
  await fetchMyData();
}
```

### Real-time Updates

```typescript
// In component
useEffect(() => {
  const interval = setInterval(() => {
    refreshData();
  }, config.refreshInterval * 60 * 1000);

  return () => clearInterval(interval);
}, [config.refreshInterval]);
```

## Questions?

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Use discussions for general questions
