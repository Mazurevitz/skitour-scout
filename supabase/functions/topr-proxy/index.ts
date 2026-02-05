import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Proxy to TOPR avalanche data
    const toprUrl = 'https://lawiny.topr.pl/';

    const response = await fetch(toprUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SkitourScout/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`TOPR returned ${response.status}`);
    }

    const html = await response.text();

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('TOPR proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'TOPR fetch failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
