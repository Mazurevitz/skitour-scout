/**
 * Base Agent Interface and Abstract Class
 *
 * All agents in SkitourScout extend this base class to ensure
 * consistent behavior, logging, and error handling.
 *
 * @module agents/BaseAgent
 */

import type { AgentResult, AgentInfo, AgentStatus } from '@/types';

/**
 * Configuration options for agent initialization
 */
export interface AgentConfig {
  /** Unique agent identifier */
  id: string;
  /** Display name */
  name: string;
  /** Agent description */
  description: string;
  /** Whether agent is enabled */
  enabled?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  /** Custom configuration */
  options?: Record<string, unknown>;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  /** Target region */
  region: string;
  /** Whether LLM is available */
  llmEnabled?: boolean;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Additional context data */
  metadata?: Record<string, unknown>;
}

/**
 * Abstract base class for all agents
 *
 * @example
 * ```typescript
 * class MyAgent extends BaseAgent<MyInput, MyOutput> {
 *   async execute(input: MyInput, context: AgentContext): Promise<AgentResult<MyOutput>> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export abstract class BaseAgent<TInput = void, TOutput = unknown> {
  protected readonly config: AgentConfig;
  protected status: AgentStatus = 'idle';
  protected lastRun?: string;
  protected lastError?: string;

  constructor(config: AgentConfig) {
    this.config = {
      enabled: true,
      cacheTtl: 5 * 60 * 1000, // 5 minutes default
      ...config,
    };
  }

  /**
   * Get agent information/metadata
   */
  getInfo(): AgentInfo {
    return {
      id: this.config.id,
      name: this.config.name,
      description: this.config.description,
      status: this.status,
      lastRun: this.lastRun,
      lastError: this.lastError,
    };
  }

  /**
   * Check if agent is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled ?? true;
  }

  /**
   * Enable or disable the agent
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.status = 'disabled';
    } else if (this.status === 'disabled') {
      this.status = 'idle';
    }
  }

  /**
   * Execute the agent's main task
   * Subclasses must implement this method
   */
  protected abstract executeInternal(
    input: TInput,
    context: AgentContext
  ): Promise<TOutput>;

  /**
   * Run the agent with error handling and timing
   */
  async run(input: TInput, context: AgentContext): Promise<AgentResult<TOutput>> {
    if (!this.isEnabled()) {
      return {
        success: false,
        error: `Agent ${this.config.id} is disabled`,
        duration: 0,
        timestamp: new Date().toISOString(),
        agentId: this.config.id,
      };
    }

    const startTime = Date.now();
    this.status = 'running';
    this.lastError = undefined;

    try {
      const data = await this.executeInternal(input, context);
      const duration = Date.now() - startTime;

      this.status = 'idle';
      this.lastRun = new Date().toISOString();

      return {
        success: true,
        data,
        duration,
        timestamp: this.lastRun,
        agentId: this.config.id,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.status = 'error';
      this.lastError = errorMessage;
      this.lastRun = new Date().toISOString();

      console.error(`[${this.config.id}] Error:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
        duration,
        timestamp: this.lastRun,
        agentId: this.config.id,
      };
    }
  }

  /**
   * Log a message with agent prefix
   */
  protected log(message: string, ...args: unknown[]): void {
    console.log(`[${this.config.id}] ${message}`, ...args);
  }

  /**
   * Log a warning with agent prefix
   */
  protected warn(message: string, ...args: unknown[]): void {
    console.warn(`[${this.config.id}] ${message}`, ...args);
  }
}

/**
 * Type helper for creating agent result
 */
export function createAgentResult<T>(
  agentId: string,
  data: T,
  startTime: number
): AgentResult<T> {
  return {
    success: true,
    data,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    agentId,
  };
}

/**
 * Type helper for creating error result
 */
export function createErrorResult(
  agentId: string,
  error: string,
  startTime: number
): AgentResult<never> {
  return {
    success: false,
    error,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    agentId,
  };
}
