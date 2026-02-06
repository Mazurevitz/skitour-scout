/**
 * LLM Service
 *
 * Abstraction layer for LLM via Supabase Edge Function.
 * All API calls are proxied through the backend to keep API keys secure.
 *
 * @module services/llm
 */

import { getEdgeFunctionUrl, getAuthHeaders, isSupabaseConfigured } from '../lib/supabase';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
}

// Using paid model - free models are often rate-limited upstream
const DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct';

/**
 * LLM Service class
 *
 * @example
 * ```typescript
 * const llm = new LLMService();
 * const response = await llm.complete([
 *   { role: 'user', content: 'Summarize this ski report...' }
 * ]);
 * ```
 */
export class LLMService {
  private model: string;

  constructor(model?: string) {
    this.model = model ?? DEFAULT_MODEL;
  }

  /**
   * Check if LLM service is available
   */
  isAvailable(): boolean {
    return isSupabaseConfigured();
  }

  /**
   * Complete a conversation
   */
  async complete(
    messages: LLMMessage[],
    options?: { signal?: AbortSignal; temperature?: number; max_tokens?: number }
  ): Promise<LLMResponse> {
    const edgeFunctionUrl = getEdgeFunctionUrl('llm-proxy');

    if (!edgeFunctionUrl) {
      throw new Error('LLM service not configured');
    }

    const headers = await getAuthHeaders();

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages,
        model: this.model,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens ?? 1024,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `LLM request failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model: data.model || this.model,
    };
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
   * Set model to use
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.model;
  }
}

/**
 * Available models on OpenRouter (configured server-side)
 */
export const AVAILABLE_MODELS = [
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B (Free)', free: true },
  { id: 'meta-llama/llama-3.2-1b-instruct:free', name: 'Llama 3.2 1B (Free)', free: true },
  { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)', free: true },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)', free: true },
  { id: 'qwen/qwen-2-7b-instruct:free', name: 'Qwen 2 7B (Free)', free: true },
  { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', free: false },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', free: false },
];

/**
 * Create a singleton LLM service instance
 */
let llmInstance: LLMService | null = null;

export function getLLMService(model?: string): LLMService {
  if (!llmInstance) {
    llmInstance = new LLMService(model);
  } else if (model) {
    llmInstance.setModel(model);
  }
  return llmInstance;
}
