import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportSubmission {
  type: 'ascent' | 'descent';
  location: string;
  region: string;
  coordinates?: { lat: number; lng: number };
  track_status?: 'przetarte' | 'zasypane' | 'lod';
  gear_needed?: string[];
  snow_condition?: 'puch' | 'firn' | 'szren' | 'beton' | 'cukier' | 'kamienie' | 'mokry';
  quality_rating?: number;
  notes?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Musisz być zalogowany, aby dodać raport' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Nieprawidłowa sesja' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const { data: canSubmit } = await supabase.rpc('can_submit_report', {
      p_user_id: user.id,
    });

    if (!canSubmit) {
      // Get minutes until next allowed submission
      const { data: minutesLeft } = await supabase.rpc('minutes_until_next_report', {
        p_user_id: user.id,
      });

      return new Response(
        JSON.stringify({
          error: 'RateLimited',
          message: `Możesz dodać kolejny raport za ${minutesLeft || 30} minut`,
          minutes_remaining: minutesLeft || 30,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate report data
    const body: ReportSubmission = await req.json();

    if (!body.type || !body.location || !body.region) {
      return new Response(
        JSON.stringify({ error: 'ValidationError', message: 'Brakuje wymaganych pól: type, location, region' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate report type specific fields
    if (body.type === 'ascent' && !body.track_status) {
      return new Response(
        JSON.stringify({ error: 'ValidationError', message: 'Raport podejścia wymaga statusu trasy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.type === 'descent' && (!body.snow_condition || !body.quality_rating)) {
      return new Response(
        JSON.stringify({ error: 'ValidationError', message: 'Raport zjazdu wymaga stanu śniegu i oceny jakości' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert report
    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        user_id: user.id,
        type: body.type,
        location: body.location,
        region: body.region,
        coordinates: body.coordinates || null,
        track_status: body.track_status || null,
        gear_needed: body.gear_needed || null,
        snow_condition: body.snow_condition || null,
        quality_rating: body.quality_rating || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error('Failed to insert report');
    }

    // Update rate limit
    const { error: rateLimitError } = await supabase
      .from('rate_limits')
      .upsert({
        user_id: user.id,
        last_report_at: new Date().toISOString(),
      });

    if (rateLimitError) {
      console.error('Rate limit update error:', rateLimitError);
      // Don't fail the request for this
    }

    return new Response(
      JSON.stringify({
        success: true,
        report,
        message: 'Raport dodany pomyślnie',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Submit report error:', error);
    return new Response(
      JSON.stringify({ error: 'ServerError', message: 'Wystąpił błąd podczas dodawania raportu' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
