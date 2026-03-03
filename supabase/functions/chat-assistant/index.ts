import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  region?: string;
  currentConditions?: {
    avalancheLevel?: number;
    temperature?: number;
    snowDepth?: number;
    weather?: string;
  };
}

interface RetrievedContext {
  content: string;
  type: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

/**
 * Generate embedding for the query
 */
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embeddings error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Retrieve relevant context from vector store
 */
async function retrieveContext(
  supabase: ReturnType<typeof createClient>,
  queryEmbedding: number[],
  region?: string
): Promise<RetrievedContext[]> {
  const { data, error } = await supabase.rpc('match_reports', {
    query_embedding: queryEmbedding,
    match_threshold: 0.5, // Lower threshold for more results
    match_count: 8,
    filter_region: region || null,
    filter_types: null, // Include all types
  });

  if (error) {
    console.error('Vector search error:', error);
    return [];
  }

  return (data || []).map((row: {
    content: string;
    report_type: string;
    similarity: number;
    metadata: Record<string, unknown>;
  }) => ({
    content: row.content,
    type: row.report_type,
    similarity: row.similarity,
    metadata: row.metadata || {},
  }));
}

/**
 * Build the system prompt with RAG context
 */
function buildSystemPrompt(
  context: RetrievedContext[],
  currentConditions?: ChatRequest['currentConditions']
): string {
  const basePrompt = `Jesteś asystentem planowania wycieczek skiturowych w polskich górach.
Odpowiadaj krótko i konkretnie po polsku. Bazuj na podanym kontekście z raportów społeczności i danych o trasach.
Zawsze podaj: trasę (jeśli możliwe), warunki śniegowe, zagrożenia, zalecany sprzęt.
Jeśli nie masz wystarczających informacji, powiedz o tym szczerze.
Bądź ostrożny - bezpieczeństwo jest najważniejsze.`;

  let conditionsSection = '';
  if (currentConditions) {
    const parts: string[] = [];
    if (currentConditions.avalancheLevel !== undefined) {
      parts.push(`Stopień zagrożenia lawinowego: ${currentConditions.avalancheLevel}/5`);
    }
    if (currentConditions.temperature !== undefined) {
      parts.push(`Temperatura: ${currentConditions.temperature}°C`);
    }
    if (currentConditions.snowDepth !== undefined) {
      parts.push(`Pokrywa śnieżna: ${currentConditions.snowDepth}cm`);
    }
    if (currentConditions.weather) {
      parts.push(`Pogoda: ${currentConditions.weather}`);
    }

    if (parts.length > 0) {
      conditionsSection = `\n\n## Aktualne warunki:\n${parts.join('\n')}`;
    }
  }

  let contextSection = '';
  if (context.length > 0) {
    const contextItems = context.map((c, i) => {
      const typeLabel =
        c.type === 'community' ? 'Raport społeczności' :
        c.type === 'admin' ? 'Raport zweryfikowany' :
        'Informacja o trasie';

      const date = c.metadata.timestamp
        ? new Date(c.metadata.timestamp as string).toLocaleDateString('pl-PL')
        : '';

      return `${i + 1}. [${typeLabel}${date ? ` z ${date}` : ''}] ${c.content}`;
    });

    contextSection = `\n\n## Kontekst z raportów:\n${contextItems.join('\n\n')}`;
  }

  return `${basePrompt}${conditionsSection}${contextSection}`;
}

/**
 * Call LLM for chat completion
 */
async function generateResponse(
  systemPrompt: string,
  userMessage: string,
  history: ChatMessage[],
  openrouterKey: string
): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })), // Keep last 6 messages
    { role: 'user', content: userMessage },
  ];

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://skitour-scout.app',
      'X-Title': 'SkitourScout',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct',
      messages,
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenRouter error:', error);

    if (response.status === 429) {
      throw new Error('Przekroczono limit zapytań. Spróbuj ponownie za chwilę.');
    }

    throw new Error(`LLM API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'Przepraszam, nie udało się wygenerować odpowiedzi.';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (!openrouterApiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ChatRequest = await req.json();

    if (!body.message || body.message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userMessage = body.message.trim();
    const history = body.history || [];

    // 1. Generate embedding for the query
    const queryEmbedding = await generateEmbedding(userMessage, openaiApiKey);

    // 2. Retrieve relevant context
    const context = await retrieveContext(supabase, queryEmbedding, body.region);

    // 3. Build system prompt with context
    const systemPrompt = buildSystemPrompt(context, body.currentConditions);

    // 4. Generate LLM response
    const response = await generateResponse(
      systemPrompt,
      userMessage,
      history,
      openrouterApiKey
    );

    return new Response(
      JSON.stringify({
        message: response,
        contextUsed: context.length,
        sources: context.map((c) => ({
          type: c.type,
          location: c.metadata.location,
          date: c.metadata.timestamp,
          similarity: Math.round(c.similarity * 100) / 100,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Chat assistant error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Wystąpił błąd';
    const isUserError = errorMessage.includes('Przekroczono') || errorMessage.includes('required');

    return new Response(
      JSON.stringify({
        error: errorMessage,
        message: isUserError ? errorMessage : 'Przepraszam, wystąpił problem. Spróbuj ponownie.',
      }),
      {
        status: isUserError ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
