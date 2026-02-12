/**
 * Import FB Reports - One-time utility to import parsed FB reports
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify admin
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();
        if (!profile?.is_admin) {
          return new Response(JSON.stringify({ error: 'Admin required' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const { reports } = await req.json();

    if (!reports || !Array.isArray(reports)) {
      return new Response(JSON.stringify({ error: 'reports array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Importing ${reports.length} reports...`);

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const r of reports) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('admin_reports')
        .select('id')
        .eq('fb_post_id', r.id)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from('admin_reports')
        .insert({
          report_date: r.date,
          location: r.location,
          region: r.region,
          snow_conditions: r.snow_conditions,
          hazards: r.hazards || [],
          safety_rating: r.safety_rating,
          author_name: r.author,
          source_type: 'facebook',
          fb_post_id: r.id,
          review_status: 'auto_approved',
          confidence_score: 85,
        });

      if (error) {
        errors.push(`${r.location}: ${error.message}`);
        skipped++;
      } else {
        inserted++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted,
        skipped,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
