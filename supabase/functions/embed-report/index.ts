import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmbedRequest {
  report_id?: string;
  report_type: 'community' | 'admin' | 'route';
  content: string;
  metadata?: {
    region?: string;
    location?: string;
    route_id?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

interface EmbedBatchRequest {
  reports: EmbedRequest[];
}

/**
 * Generate embedding using OpenAI text-embedding-3-small
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
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Prepare content for embedding - combines relevant fields into searchable text
 */
function prepareContent(report: EmbedRequest): string {
  // For routes, the content is already prepared
  if (report.report_type === 'route') {
    return report.content;
  }

  // For reports, enhance with metadata context
  const parts: string[] = [];

  if (report.metadata?.location) {
    parts.push(`Lokalizacja: ${report.metadata.location}`);
  }

  if (report.metadata?.region) {
    parts.push(`Region: ${report.metadata.region}`);
  }

  parts.push(report.content);

  return parts.join('. ');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    // Handle batch requests
    const reports: EmbedRequest[] = body.reports || [body];

    if (!reports.length) {
      return new Response(
        JSON.stringify({ error: 'No reports provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const report of reports) {
      try {
        // Validate required fields
        if (!report.report_type || !report.content) {
          results.push({
            id: report.report_id || 'unknown',
            success: false,
            error: 'Missing required fields: report_type and content',
          });
          continue;
        }

        // Prepare and generate embedding
        const content = prepareContent(report);
        const embedding = await generateEmbedding(content, openaiApiKey);

        // Store in database using upsert function
        const { data, error } = await supabase.rpc('upsert_report_embedding', {
          p_report_id: report.report_id || null,
          p_report_type: report.report_type,
          p_content: content,
          p_embedding: embedding,
          p_metadata: report.metadata || {},
        });

        if (error) {
          console.error('Database error:', error);
          results.push({
            id: report.report_id || 'unknown',
            success: false,
            error: error.message,
          });
        } else {
          results.push({
            id: data || report.report_id || 'created',
            success: true,
          });
        }
      } catch (err) {
        console.error('Error processing report:', err);
        results.push({
          id: report.report_id || 'unknown',
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return new Response(
      JSON.stringify({
        processed: results.length,
        successful: successCount,
        failed: results.length - successCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Embed report error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process embedding request',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
