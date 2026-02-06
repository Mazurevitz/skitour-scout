import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ParsedReport {
  report_date: string;
  location: string;
  region: string;
  snow_conditions: string;
  hazards: string[];
  safety_rating: number;
  author_name: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // === AUTH: Verify user is admin ===
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify token and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
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
    const systemPrompt = `You are a JSON extraction API. Extract ski touring condition reports from Polish Facebook posts/comments.

TODAY'S DATE: ${currentDate}

EXTRACTION RULES:
- Extract MULTIPLE reports if the text contains several different condition reports
- SKIP: questions, jokes, outdated reports (author says "nieaktualne"), off-topic comments
- Relative dates → ISO format: "wczoraj"=yesterday, "3 dni temu"=3 days ago, "w sobotę"=last Saturday, "we wtorek"=last Tuesday
- If no date mentioned: use today
- Regions: "Beskid Śląski" (Skrzyczne, Barania Góra, Klimczok, Błatnia), "Beskid Żywiecki" (Pilsko, Babia Góra, Romanka, Rycerzowa, Lipowska), "Tatry" (Kasprowy, Kondratowa, Gąsienicowa)
- Hazards: kamienie, lód, krzaki, wiatr, mgła, lawiny, przenoski
- safety_rating: 1-5 (1=bardzo niebezpieczne, 3=umiarkowane, 5=bardzo bezpieczne)
- snow_conditions: MUST be in Polish, summarize the actual conditions described
- author_name: extract if clearly stated (e.g. "Mateusz Bujniewicz")
- Merge comments about the same location/date from same author into one report

OUTPUT FORMAT - RESPOND WITH ONLY THIS JSON ARRAY:
{"reports":[{"report_date":"YYYY-MM-DD","location":"string","region":"string","snow_conditions":"opis po polsku","hazards":[],"safety_rating":3,"author_name":"string or null"}]}

If no valid reports found, return: {"reports":[]}

CRITICAL: Output raw JSON only. No markdown. No explanations.`;

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

    // Extract JSON from response
    let jsonStr = content;

    // Handle markdown code blocks
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    } else {
      // Extract JSON object by finding matching braces
      const jsonStart = content.indexOf('{');
      if (jsonStart !== -1) {
        let braceCount = 0;
        let jsonEnd = jsonStart;
        for (let i = jsonStart; i < content.length; i++) {
          if (content[i] === '{') braceCount++;
          if (content[i] === '}') braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
        jsonStr = content.slice(jsonStart, jsonEnd);
      }
    }

    let parsed: { reports: ParsedReport[] };
    try {
      parsed = JSON.parse(jsonStr.trim());
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: 'Failed to parse AI response as JSON',
          raw_response: content,
          extracted: jsonStr
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate structure
    if (!parsed.reports || !Array.isArray(parsed.reports)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid response structure - expected {reports: [...]}',
          parsed
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter out invalid reports
    const validReports = parsed.reports.filter(
      r => r.report_date && r.location && r.region
    );

    return new Response(
      JSON.stringify({
        success: true,
        reports: validReports,
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
