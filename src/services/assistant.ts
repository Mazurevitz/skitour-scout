/**
 * Assistant Service
 *
 * Client-side API wrapper for the chat-assistant edge function.
 *
 * @module services/assistant
 */

import { callEdgeFunction, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Chat message type
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: ChatSource[];
}

/**
 * Source information for a response
 */
export interface ChatSource {
  type: 'community' | 'admin' | 'route';
  location?: string;
  date?: string;
  similarity?: number;
}

/**
 * Current conditions context
 */
export interface CurrentConditions {
  avalancheLevel?: number;
  temperature?: number;
  snowDepth?: number;
  weather?: string;
}

/**
 * Chat response from the API
 */
interface ChatResponse {
  message: string;
  contextUsed: number;
  sources: ChatSource[];
  error?: string;
}

/**
 * Send a message to the chat assistant
 */
export async function sendMessage(
  message: string,
  history: ChatMessage[],
  options?: {
    region?: string;
    currentConditions?: CurrentConditions;
  }
): Promise<{
  response: ChatMessage | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured()) {
    return {
      response: null,
      error: 'Supabase nie jest skonfigurowane',
    };
  }

  // Convert history to API format (without timestamps)
  const apiHistory = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const { data, error } = await callEdgeFunction<ChatResponse>('chat-assistant', {
    message,
    history: apiHistory,
    region: options?.region,
    currentConditions: options?.currentConditions,
  });

  if (error) {
    return {
      response: null,
      error: error,
    };
  }

  if (!data) {
    return {
      response: null,
      error: 'Brak odpowiedzi od serwera',
    };
  }

  if (data.error) {
    return {
      response: null,
      error: data.error,
    };
  }

  return {
    response: {
      role: 'assistant',
      content: data.message,
      timestamp: new Date(),
      sources: data.sources,
    },
    error: null,
  };
}

/**
 * Pre-built suggestion queries
 */
export const SUGGESTION_QUERIES = [
  {
    id: 'easy-weekend',
    label: 'Łatwa trasa na weekend',
    query: 'Znajdź mi łatwą trasę na weekend z dobrym śniegiem',
  },
  {
    id: 'best-powder',
    label: 'Gdzie najlepszy puch?',
    query: 'Gdzie teraz znajdę najlepszy puch do jazdy?',
  },
  {
    id: 'safe-level3',
    label: 'Bezpieczna przy stopniu 3',
    query: 'Jaka trasa będzie bezpieczna przy stopniu lawinowym 3?',
  },
  {
    id: 'conditions-today',
    label: 'Aktualne warunki',
    query: 'Jakie są aktualne warunki śniegowe w regionie?',
  },
] as const;

/**
 * Welcome message for the assistant
 */
export const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: `Cześć! Jestem asystentem skiturowym. Pomogę Ci znaleźć trasę dopasowaną do warunków i Twoich umiejętności.

Możesz zapytać mnie o:
• Trasy odpowiednie na dany dzień
• Aktualne warunki śniegowe
• Bezpieczeństwo przy danym stopniu lawinowym
• Rekomendacje sprzętu

Wybierz jedno z poniższych pytań lub napisz własne.`,
  timestamp: new Date(),
};
