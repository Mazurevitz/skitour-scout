/**
 * MCP (Model Context Protocol) Configuration
 *
 * Configuration for MCP server integration.
 * MCP allows connecting to external tools like Playwright for scraping.
 *
 * @module config/mcp
 */

import type { MCPServerConfig } from '@/types';

/**
 * Default MCP server configurations
 *
 * These are pre-configured servers that can be enabled for
 * enhanced functionality (scraping, fetching, etc.)
 */
export const defaultMCPServers: MCPServerConfig[] = [
  {
    id: 'playwright-mcp',
    name: 'Playwright MCP',
    endpoint: 'npx @anthropic-ai/playwright-mcp',
    type: 'stdio',
    enabled: false,
    options: {
      headless: true,
      timeout: 30000,
    },
  },
  {
    id: 'fetch-mcp',
    name: 'Fetch MCP',
    endpoint: 'npx @anthropic-ai/fetch-mcp',
    type: 'stdio',
    enabled: false,
    options: {
      maxResponseSize: '5mb',
    },
  },
];

/**
 * MCP Client interface
 *
 * Bridge for communicating with MCP servers.
 * This is a placeholder for actual MCP SDK integration.
 */
export interface MCPClient {
  /** Connect to an MCP server */
  connect(config: MCPServerConfig): Promise<void>;
  /** Disconnect from an MCP server */
  disconnect(serverId: string): Promise<void>;
  /** Call a tool on an MCP server */
  callTool(serverId: string, toolName: string, args: unknown): Promise<unknown>;
  /** List available tools from a server */
  listTools(serverId: string): Promise<string[]>;
}

/**
 * MCP Client stub implementation
 *
 * Placeholder implementation that will be replaced with
 * actual MCP SDK integration.
 */
export class MCPClientStub implements MCPClient {
  private connectedServers: Set<string> = new Set();

  async connect(config: MCPServerConfig): Promise<void> {
    console.log(`[MCP] Connecting to ${config.name}...`);
    // In production, this would:
    // 1. Spawn the MCP server process
    // 2. Establish stdio/http/websocket connection
    // 3. Perform capability negotiation
    this.connectedServers.add(config.id);
    console.log(`[MCP] Connected to ${config.name}`);
  }

  async disconnect(serverId: string): Promise<void> {
    console.log(`[MCP] Disconnecting from ${serverId}...`);
    this.connectedServers.delete(serverId);
  }

  async callTool(serverId: string, toolName: string, args: unknown): Promise<unknown> {
    if (!this.connectedServers.has(serverId)) {
      throw new Error(`Not connected to server: ${serverId}`);
    }

    console.log(`[MCP] Calling ${toolName} on ${serverId}`, args);

    // Placeholder response
    return {
      success: true,
      message: `Tool ${toolName} called successfully (stub)`,
    };
  }

  async listTools(serverId: string): Promise<string[]> {
    if (!this.connectedServers.has(serverId)) {
      throw new Error(`Not connected to server: ${serverId}`);
    }

    // Return placeholder tools based on server type
    if (serverId === 'playwright-mcp') {
      return ['navigate', 'click', 'fill', 'screenshot', 'extract_text'];
    }
    if (serverId === 'fetch-mcp') {
      return ['fetch', 'fetch_html', 'fetch_json'];
    }
    return [];
  }
}

/**
 * MCP configuration file format
 *
 * This matches the format used by Claude Desktop and other MCP clients.
 */
export interface MCPConfigFile {
  mcpServers: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
}

/**
 * Generate MCP config file content
 *
 * Generates a configuration file that can be used with
 * MCP-compatible clients.
 */
export function generateMCPConfig(servers: MCPServerConfig[]): MCPConfigFile {
  const mcpServers: MCPConfigFile['mcpServers'] = {};

  for (const server of servers.filter((s) => s.enabled)) {
    const [command, ...args] = server.endpoint.split(' ');
    mcpServers[server.id] = {
      command,
      args: args.length > 0 ? args : undefined,
      env: server.options?.env as Record<string, string> | undefined,
    };
  }

  return { mcpServers };
}

/**
 * Example MCP config for SkitourScout
 *
 * Save this to ~/.config/skitourscout/mcp.json
 */
export const exampleMCPConfig: MCPConfigFile = {
  mcpServers: {
    'playwright-mcp': {
      command: 'npx',
      args: ['@anthropic-ai/playwright-mcp'],
    },
    'fetch-mcp': {
      command: 'npx',
      args: ['@anthropic-ai/fetch-mcp'],
    },
  },
};
