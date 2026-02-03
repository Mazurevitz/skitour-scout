/**
 * LLM Service
 *
 * Abstraction layer for LLM providers (Ollama, OpenRouter).
 * Ollama is the default (local, free), with OpenRouter as fallback.
 *
 * @module services/llm
 */

export type LLMProvider = 'ollama' | 'openrouter';

export interface LLMConfig {
  provider: LLMProvider;
  /** Ollama base URL (default: http://localhost:11434) */
  ollamaUrl?: string;
  /** Ollama model name (default: llama3.2) */
  ollamaModel?: string;
  /** OpenRouter API key */
  openrouterApiKey?: string;
  /** OpenRouter model (default: meta-llama/llama-3.2-3b-instruct:free) */
  openrouterModel?: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: LLMProvider;
}

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = 'llama3.2';
// Free tier model on OpenRouter
const DEFAULT_OPENROUTER_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';

/**
 * LLM Service class
 *
 * @example
 * ```typescript
 * const llm = new LLMService({ provider: 'ollama' });
 * const response = await llm.complete([
 *   { role: 'user', content: 'Summarize this ski report...' }
 * ]);
 * ```
 */
export class LLMService {
  private config: LLMConfig;

  constructor(config: Partial<LLMConfig> = {}) {
    this.config = {
      provider: config.provider ?? 'ollama',
      ollamaUrl: config.ollamaUrl ?? DEFAULT_OLLAMA_URL,
      ollamaModel: config.ollamaModel ?? DEFAULT_OLLAMA_MODEL,
      openrouterApiKey: config.openrouterApiKey,
      openrouterModel: config.openrouterModel ?? DEFAULT_OPENROUTER_MODEL,
    };
  }

  /**
   * Check if Ollama is available
   */
  async checkOllamaHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.ollamaUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available Ollama models
   */
  async listOllamaModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.ollamaUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.models?.map((m: { name: string }) => m.name) ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Complete a conversation
   */
  async complete(
    messages: LLMMessage[],
    options?: { signal?: AbortSignal }
  ): Promise<LLMResponse> {
    if (this.config.provider === 'ollama') {
      return this.completeWithOllama(messages, options);
    } else {
      return this.completeWithOpenRouter(messages, options);
    }
  }

  /**
   * Simple prompt completion (convenience method)
   */
  async prompt(
    prompt: string,
    systemPrompt?: string,
    options?: { signal?: AbortSignal }
  ): Promise<string> {
    const messages: LLMMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await this.complete(messages, options);
    return response.content;
  }

  /**
   * Complete using Ollama
   */
  private async completeWithOllama(
    messages: LLMMessage[],
    options?: { signal?: AbortSignal }
  ): Promise<LLMResponse> {
    const response = await fetch(`${this.config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.ollamaModel,
        messages,
        stream: false,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.message?.content ?? '',
      model: this.config.ollamaModel!,
      provider: 'ollama',
    };
  }

  /**
   * Complete using OpenRouter
   */
  private async completeWithOpenRouter(
    messages: LLMMessage[],
    options?: { signal?: AbortSignal }
  ): Promise<LLMResponse> {
    if (!this.config.openrouterApiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.openrouterApiKey}`,
        'HTTP-Referer': 'https://github.com/skitourscout',
        'X-Title': 'SkitourScout',
      },
      body: JSON.stringify({
        model: this.config.openrouterModel,
        messages,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model: this.config.openrouterModel!,
      provider: 'openrouter',
    };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }
}

/**
 * Available free/cheap models on OpenRouter
 */
export const OPENROUTER_MODELS = [
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B (Free)', free: true },
  { id: 'meta-llama/llama-3.2-1b-instruct:free', name: 'Llama 3.2 1B (Free)', free: true },
  { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)', free: true },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)', free: true },
  { id: 'qwen/qwen-2-7b-instruct:free', name: 'Qwen 2 7B (Free)', free: true },
  { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B ($0.06/M)', free: false },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku ($0.25/M)', free: false },
];

/**
 * Recommended Ollama models for summarization
 */
export const RECOMMENDED_OLLAMA_MODELS = [
  'llama3.2',
  'llama3.2:1b',
  'mistral',
  'gemma2',
  'qwen2.5',
  'phi3',
];

/**
 * Create a singleton LLM service instance
 */
let llmInstance: LLMService | null = null;

export function getLLMService(config?: Partial<LLMConfig>): LLMService {
  if (!llmInstance) {
    llmInstance = new LLMService(config);
  } else if (config) {
    llmInstance.setConfig(config);
  }
  return llmInstance;
}
