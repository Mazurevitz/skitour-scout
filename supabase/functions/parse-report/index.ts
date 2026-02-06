import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedReport {
  report_date: string;
  location: string;
  region: string;
  snow_conditions: string;
  hazards: string[];
  is_safe: boolean;
  author_name: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body
    const { raw_text } = await req.json();

    if (!raw_text || typeof raw_text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'raw_text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OpenRouter API key
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openrouterKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Current date for relative date parsing
    const today = new Date();
    const currentDate = today.toISOString().split('T')[0];

    // System prompt for parsing
    const systemPrompt = `You are a mountain safety expert specializing in ski touring in Polish mountains (Beskidy, Tatry).
Extract structured ski-touring data from messy Polish Facebook posts.

IMPORTANT RULES:
1. Convert relative dates to ISO format (YYYY-MM-DD) based on today's date: ${currentDate}
   - "wczoraj" = yesterday
   - "przedwczoraj" = day before yesterday
   - "3 dni temu" = 3 days ago
   - "w sobotę" = last Saturday (calculate from today)
   - If no date mentioned, use today's date
2. Clean up noise like "Facebook Facebook", "Zobacz więcej", repeated text
3. Identify the specific location (peak, trail, area) - common locations:
   - Beskid Śląski: Skrzyczne, Barania Góra, Klimczok, Błatnia, Stożek, Czantoria
   - Beskid Żywiecki: Pilsko, Babia Góra, Romanka, Lipowska, Rysianka
   - Tatry: Kasprowy Wierch, Kondratowa, Gąsienicowa, etc.
4. Determine region from location
5. Extract snow conditions (quality, depth, coverage)
6. List hazards as array: kamienie (rocks), lód (ice), krzaki (bushes), wiatr (wind), mgła (fog), lawiny (avalanches)
7. Determine is_safe: false if serious hazards mentioned (avalanche risk, very poor visibility, dangerous conditions)
8. Extract author name if visible

Return ONLY a valid JSON object with this exact structure:
{
  "report_date": "YYYY-MM-DD",
  "location": "string",
  "region": "string (Beskid Śląski | Beskid Żywiecki | Tatry)",
  "snow_conditions": "string description",
  "hazards": ["string array"],
  "is_safe": boolean,
  "author_name": "string or null"
}`;

    // Call OpenRouter API (Claude 3.5 Sonnet)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openrouterKey}`,
        'HTTP-Referer': 'https://skitour-scout.pages.dev',
        'X-Title': 'SkitourScout Admin',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Parse this Facebook post about ski touring conditions:\n\n${raw_text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to parse with AI', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    let parsed: ParsedReport;
    try {
      parsed = JSON.parse(jsonStr.trim());
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: 'Failed to parse AI response as JSON',
          raw_response: content
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!parsed.report_date || !parsed.location || !parsed.region) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields in parsed data',
          parsed
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        parsed,
        raw_response: content,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Parse report error:', error);
    return new Response(
      JSON.stringify({ error: 'Server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
