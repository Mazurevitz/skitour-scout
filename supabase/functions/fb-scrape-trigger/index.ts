/**
 * FB Scrape Trigger Edge Function
 *
 * Starts an Apify run to scrape Facebook groups for ski condition posts.
 * Requires admin auth or service role key (for cron triggers).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function errorResponse(message: string, details?: string, status = 400) {
  console.error(`Error: ${message}`, details || '');
  return new Response(
    JSON.stringify({
      error: message,
      details: details || null,
      help: getHelpText(message),
    }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function getHelpText(error: string): string | null {
  if (error.includes('APIFY_API_TOKEN')) {
    return 'Set the APIFY_API_TOKEN secret in Supabase: supabase secrets set APIFY_API_TOKEN=apify_api_xxx';
  }
  if (error.includes('No active groups')) {
    return 'Add FB groups in Admin panel → Scraping → "Dodaj grupę"';
  }
  if (error.includes('disabled')) {
    return 'Enable scraping in app_settings: UPDATE app_settings SET value = true WHERE key = \'fb_scrape_enabled\'';
  }
  return null;
}

interface ApifyRunResponse {
  data: {
    id: string;
    defaultDatasetId: string;
    status: string;
  };
}

interface FBGroupConfig {
  id: string;
  group_url: string;
  group_name: string;
  region: string | null;
  is_active: boolean;
  max_posts_per_scrape: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // === Check environment variables ===
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const apifyToken = Deno.env.get('APIFY_API_TOKEN');

    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      hasApifyToken: !!apifyToken,
      apifyTokenPrefix: apifyToken ? apifyToken.substring(0, 10) + '...' : 'NOT SET',
    });

    if (!supabaseUrl || !serviceRoleKey) {
      return errorResponse(
        'Missing Supabase configuration',
        'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set',
        500
      );
    }

    if (!apifyToken) {
      return errorResponse(
        'APIFY_API_TOKEN not configured',
        'The Apify API token is required to scrape Facebook groups',
        500
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // === AUTH ===
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    let triggerSource: 'manual' | 'cron' = 'manual';

    if (!authHeader) {
      return errorResponse('Authorization required', 'Missing Authorization header', 401);
    }

    const token = authHeader.replace('Bearer ', '');

    if (token === serviceRoleKey) {
      triggerSource = 'cron';
      console.log('Auth: Service role key (cron trigger)');
    } else {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        return errorResponse(
          'Invalid or expired token',
          userError?.message || 'Could not verify user token',
          401
        );
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (profileError) {
        return errorResponse(
          'Could not verify admin status',
          profileError.message,
          500
        );
      }

      if (!profile?.is_admin) {
        return errorResponse('Admin access required', 'Your account is not an admin', 403);
      }

      userId = user.id;
      console.log('Auth: Admin user', user.email);
    }

    // === Parse request body ===
    let body: { mode?: string; group_ids?: string[]; date_from?: string; date_to?: string } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 'Could not parse request body');
    }

    const { mode = 'daily', group_ids, date_from, date_to } = body;

    console.log('Request:', { mode, group_ids, date_from, date_to });

    if (!['daily', 'backfill', 'manual'].includes(mode)) {
      return errorResponse(
        'Invalid mode',
        `mode must be "daily", "backfill", or "manual", got "${mode}"`
      );
    }

    if (mode === 'manual' && (!date_from || !date_to)) {
      return errorResponse(
        'Date range required',
        'Manual mode requires date_from and date_to parameters'
      );
    }

    // === Check if scraping is enabled ===
    const { data: enabledSetting, error: settingError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'fb_scrape_enabled')
      .single();

    if (settingError) {
      console.log('Could not check fb_scrape_enabled setting:', settingError.message);
      // Continue anyway, assume enabled
    } else if (enabledSetting?.value === false || enabledSetting?.value === 'false') {
      return errorResponse('FB scraping is disabled', 'Set fb_scrape_enabled to true in app_settings');
    }

    // === Get active groups ===
    let groupsQuery = supabase
      .from('fb_group_configs')
      .select('*')
      .eq('is_active', true);

    if (group_ids && group_ids.length > 0) {
      groupsQuery = groupsQuery.in('id', group_ids);
    }

    const { data: groups, error: groupsError } = await groupsQuery;

    if (groupsError) {
      return errorResponse(
        'Failed to fetch groups',
        groupsError.message,
        500
      );
    }

    console.log('Groups found:', groups?.length || 0);

    if (!groups || groups.length === 0) {
      return errorResponse(
        'No active groups to scrape',
        group_ids?.length
          ? `None of the ${group_ids.length} specified groups are active`
          : 'No groups configured. Add groups in Admin panel.'
      );
    }

    // === Get settings ===
    const { data: maxPostsSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'fb_scrape_max_posts_per_group')
      .single();

    const maxPosts = Number(maxPostsSetting?.value) || 50;

    // Calculate days for Apify's onlyPostsNewerThan parameter
    const now = new Date();
    let scrapeDays: number;

    if (mode === 'manual' && date_from) {
      // Calculate days from date_from to now
      const fromDate = new Date(date_from);
      const diffMs = now.getTime() - fromDate.getTime();
      scrapeDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      // Ensure at least 1 day
      scrapeDays = Math.max(1, scrapeDays);
    } else if (mode === 'backfill') {
      const { data: backfillDaysSetting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'fb_scrape_backfill_days')
        .single();
      scrapeDays = Number(backfillDaysSetting?.value) || 30;
    } else {
      // Daily: scrape last 3 days
      scrapeDays = 3;
    }

    // Calculate date range for job record
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - scrapeDays);
    const jobDateFrom = mode === 'manual' ? date_from : pastDate.toISOString().split('T')[0];
    const jobDateTo = mode === 'manual' ? date_to : now.toISOString().split('T')[0];

    // === Create job record ===
    const { data: job, error: jobError } = await supabase
      .from('scrape_jobs')
      .insert({
        mode,
        status: 'pending',
        group_ids: (groups as FBGroupConfig[]).map(g => g.id),
        triggered_by: userId,
        trigger_source: triggerSource,
        date_from: jobDateFrom,
        date_to: jobDateTo,
      })
      .select()
      .single();

    if (jobError) {
      return errorResponse(
        'Failed to create job record',
        jobError.message,
        500
      );
    }

    console.log('Job created:', job.id);

    // === Start Apify run ===
    const startUrls = (groups as FBGroupConfig[]).map(g => ({ url: g.group_url }));

    // Use correct Apify parameter names:
    // - resultsLimit: max posts to return
    // - onlyPostsNewerThan: relative time filter (e.g., "7 days")
    const apifyInput = {
      startUrls,
      resultsLimit: maxPosts * groups.length,
      onlyPostsNewerThan: `${scrapeDays} days`,
      viewOption: 'CHRONOLOGICAL',
    };

    console.log('Starting Apify run:', {
      urls: startUrls.map(u => u.url),
      resultsLimit: apifyInput.resultsLimit,
      onlyPostsNewerThan: apifyInput.onlyPostsNewerThan,
    });

    const apifyResponse = await fetch(
      'https://api.apify.com/v2/acts/apify~facebook-groups-scraper/runs?waitForFinish=0',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apifyToken}`,
        },
        body: JSON.stringify(apifyInput),
      }
    );

    const apifyResponseText = await apifyResponse.text();
    console.log('Apify response status:', apifyResponse.status);

    if (!apifyResponse.ok) {
      // Update job as failed
      await supabase
        .from('scrape_jobs')
        .update({
          status: 'failed',
          error_message: `Apify API error (${apifyResponse.status}): ${apifyResponseText.slice(0, 200)}`
        })
        .eq('id', job.id);

      // Parse Apify error for better message
      let apifyError = 'Unknown Apify error';
      try {
        const parsed = JSON.parse(apifyResponseText);
        apifyError = parsed.error?.message || parsed.message || apifyResponseText.slice(0, 200);
      } catch {
        apifyError = apifyResponseText.slice(0, 200);
      }

      return errorResponse(
        'Apify API error',
        apifyError,
        500
      );
    }

    let apifyData: ApifyRunResponse;
    try {
      apifyData = JSON.parse(apifyResponseText);
    } catch {
      return errorResponse(
        'Invalid Apify response',
        'Could not parse Apify API response',
        500
      );
    }

    const runId = apifyData.data?.id;
    const datasetId = apifyData.data?.defaultDatasetId;

    if (!runId || !datasetId) {
      return errorResponse(
        'Missing Apify run details',
        'Response missing run ID or dataset ID',
        500
      );
    }

    // === Update job with Apify details ===
    await supabase
      .from('scrape_jobs')
      .update({
        apify_run_id: runId,
        apify_dataset_id: datasetId,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    console.log(`Apify run started: ${runId}`);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        apify_run_id: runId,
        apify_dataset_id: datasetId,
        groups_count: groups.length,
        groups: (groups as FBGroupConfig[]).map(g => g.group_name),
        date_range: { from: jobDateFrom, to: jobDateTo },
        mode,
        message: `Scrape started for ${groups.length} group(s): ${(groups as FBGroupConfig[]).map(g => g.group_name).join(', ')}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Unexpected server error',
        details: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
