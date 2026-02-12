/**
 * FB Scrape Process Edge Function
 *
 * Processes completed Apify runs:
 * 1. Fetches posts from Apify dataset
 * 2. Pre-filters (length, comments)
 * 3. LLM relevance filter (cheap Llama 3.1 8B)
 * 4. LLM parsing for relevant posts (Claude 3.5 Sonnet)
 * 5. Deduplication and insertion to admin_reports
 *
 * Can be called via:
 * - Webhook from Apify (after run completes)
 * - Polling from cron job
 * - Manual trigger with job_id
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ApifyPost {
  postId: string;
  groupId?: string;
  text?: string;
  timestamp?: string;
  authorName?: string;
  commentsCount?: number;
  url?: string;
}

interface ParsedReport {
  report_date: string;
  location: string;
  region: string;
  snow_conditions: string;
  hazards: string[];
  safety_rating: number;
  author_name: string | null;
  confidence: number;
}

// Cost tracking constants (per 1K tokens)
const LLM_COSTS = {
  'meta-llama/llama-3.1-8b-instruct': 0.0001,
  'anthropic/claude-3.5-sonnet': 0.003,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!apifyToken || !openrouterKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required API keys' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // === AUTH ===
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Allow service role key or admin user
    if (token !== serviceRoleKey) {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
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
    }

    // === Get job to process ===
    const body = await req.json().catch(() => ({}));
    let jobId = body.job_id;

    // If no job_id provided, find a running job
    if (!jobId) {
      const { data: runningJob } = await supabase
        .from('scrape_jobs')
        .select('id, apify_run_id')
        .eq('status', 'running')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (!runningJob) {
        return new Response(
          JSON.stringify({ message: 'No running jobs to process' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      jobId = runningJob.id;
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('scrape_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!job.apify_run_id || !job.apify_dataset_id) {
      return new Response(
        JSON.stringify({ error: 'Job missing Apify details' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === Check Apify run status ===
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/apify~facebook-groups-scraper/runs/${job.apify_run_id}`,
      {
        headers: { 'Authorization': `Bearer ${apifyToken}` },
      }
    );

    if (!runResponse.ok) {
      throw new Error('Failed to check Apify run status');
    }

    const runData = await runResponse.json();
    const runStatus = runData.data.status;

    console.log(`Apify run ${job.apify_run_id} status: ${runStatus}`);

    if (runStatus === 'RUNNING' || runStatus === 'READY') {
      return new Response(
        JSON.stringify({ message: 'Apify run still in progress', status: runStatus }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (runStatus !== 'SUCCEEDED') {
      await supabase
        .from('scrape_jobs')
        .update({
          status: 'failed',
          error_message: `Apify run failed with status: ${runStatus}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      return new Response(
        JSON.stringify({ error: `Apify run failed: ${runStatus}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update job status
    await supabase
      .from('scrape_jobs')
      .update({ status: 'processing' })
      .eq('id', jobId);

    // === Fetch posts from Apify dataset ===
    const datasetResponse = await fetch(
      `https://api.apify.com/v2/datasets/${job.apify_dataset_id}/items?format=json`,
      {
        headers: { 'Authorization': `Bearer ${apifyToken}` },
      }
    );

    if (!datasetResponse.ok) {
      throw new Error('Failed to fetch Apify dataset');
    }

    const posts: ApifyPost[] = await datasetResponse.json();
    console.log(`Fetched ${posts.length} posts from Apify`);

    // Track costs
    let llmFilterCost = 0;
    let llmParseCost = 0;
    let postsFiltered = 0;
    let postsRelevant = 0;
    let reportsCreated = 0;

    // === Process posts ===
    for (const post of posts) {
      if (!post.postId || !post.text) {
        postsFiltered++;
        continue;
      }

      // Pre-filter: skip very short posts
      if (post.text.length < 50) {
        postsFiltered++;
        continue;
      }

      // Pre-filter: skip posts with 0 comments (often not condition reports)
      // Actually, keep this flexible - some good reports have no comments

      // Check for duplicates
      const { data: existingPost } = await supabase
        .from('scraped_posts')
        .select('id')
        .eq('fb_post_id', post.postId)
        .single();

      if (existingPost) {
        console.log(`Skipping duplicate post: ${post.postId}`);
        postsFiltered++;
        continue;
      }

      // Also check admin_reports for this FB post
      const { data: existingReport } = await supabase
        .from('admin_reports')
        .select('id')
        .eq('fb_post_id', post.postId)
        .single();

      if (existingReport) {
        console.log(`Post already processed: ${post.postId}`);
        postsFiltered++;
        continue;
      }

      // === LLM Relevance Filter (cheap model) ===
      const relevancePrompt = `Czy ten post z Facebooka opisuje aktualne warunki skiturowe/narciarskie (śnieg, trasa, bezpieczeństwo)?
Odpowiedz TYLKO: TAK lub NIE

Post:
${post.text.slice(0, 500)}`;

      const relevanceResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openrouterKey}`,
          'HTTP-Referer': 'https://skitour-scout.pages.dev',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct',
          max_tokens: 10,
          messages: [{ role: 'user', content: relevancePrompt }],
        }),
      });

      if (!relevanceResponse.ok) {
        console.error('Relevance check failed for post:', post.postId);
        continue;
      }

      const relevanceData = await relevanceResponse.json();
      const relevanceAnswer = relevanceData.choices?.[0]?.message?.content?.trim().toUpperCase() || '';

      // Estimate tokens used (~100 tokens for prompt + response)
      llmFilterCost += 0.1 * LLM_COSTS['meta-llama/llama-3.1-8b-instruct'];

      const isRelevant = relevanceAnswer.includes('TAK');

      // Store scraped post
      const { data: scrapedPost, error: insertPostError } = await supabase
        .from('scraped_posts')
        .insert({
          fb_post_id: post.postId,
          fb_group_id: post.groupId,
          post_text: post.text,
          post_date: post.timestamp ? new Date(post.timestamp).toISOString() : null,
          author_name: post.authorName,
          comment_count: post.commentsCount || 0,
          char_count: post.text.length,
          is_relevant: isRelevant,
          relevance_reason: relevanceAnswer,
          processed_at: new Date().toISOString(),
          scrape_job_id: jobId,
        })
        .select()
        .single();

      if (insertPostError) {
        console.error('Failed to insert scraped post:', insertPostError);
        continue;
      }

      if (!isRelevant) {
        postsFiltered++;
        continue;
      }

      postsRelevant++;

      // === Full LLM Parse (Claude 3.5 Sonnet) ===
      const today = new Date().toISOString().split('T')[0];
      const parsePrompt = `You are a JSON extraction API. Extract ski touring condition reports from Polish Facebook posts.

TODAY'S DATE: ${today}

EXTRACTION RULES:
- Relative dates → ISO format: "wczoraj"=yesterday, "3 dni temu"=3 days ago
- If no date mentioned: use today
- Regions: "Beskidy" (Pilsko, Babia Góra, Skrzyczne, Barania Góra, etc.), "Tatry" (Kasprowy, Gąsienicowa, etc.)
- Hazards: kamienie, lód, krzaki, wiatr, mgła, lawiny, przenoski
- safety_rating: 1-5 (1=bardzo niebezpieczne, 3=umiarkowane, 5=bardzo bezpieczne)
- snow_conditions: MUST be in Polish
- confidence: 0-100, how confident you are this is a real ski condition report with accurate data
  - 90-100: Clear location, date, and detailed conditions (e.g., "Wczoraj na Pilsku 40cm puchu, świetne warunki")
  - 70-89: Good info but some ambiguity (e.g., location unclear or conditions vague)
  - 50-69: Partial info, might be asking a question or uncertain
  - <50: Probably not a condition report

OUTPUT FORMAT - RESPOND WITH ONLY THIS JSON:
{"reports":[{"report_date":"YYYY-MM-DD","location":"string","region":"string","snow_conditions":"opis po polsku","hazards":[],"safety_rating":3,"author_name":"string or null","confidence":85}]}

If no valid reports found, return: {"reports":[]}`;

      const parseResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openrouterKey}`,
          'HTTP-Referer': 'https://skitour-scout.pages.dev',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          max_tokens: 1024,
          messages: [
            { role: 'system', content: parsePrompt },
            { role: 'user', content: `Parse this Facebook post:\n\n${post.text}` },
          ],
        }),
      });

      if (!parseResponse.ok) {
        console.error('Parse failed for post:', post.postId);
        continue;
      }

      const parseData = await parseResponse.json();
      const parseContent = parseData.choices?.[0]?.message?.content || '';

      // Estimate tokens (~500 tokens for prompt + response)
      llmParseCost += 0.5 * LLM_COSTS['anthropic/claude-3.5-sonnet'];

      // Extract JSON from response
      let jsonStr = parseContent;
      const codeBlockMatch = parseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      } else {
        const jsonStart = parseContent.indexOf('{');
        if (jsonStart !== -1) {
          let braceCount = 0;
          let jsonEnd = jsonStart;
          for (let i = jsonStart; i < parseContent.length; i++) {
            if (parseContent[i] === '{') braceCount++;
            if (parseContent[i] === '}') braceCount--;
            if (braceCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
          jsonStr = parseContent.slice(jsonStart, jsonEnd);
        }
      }

      let parsed: { reports: ParsedReport[] };
      try {
        parsed = JSON.parse(jsonStr.trim());
      } catch {
        console.error('Failed to parse JSON for post:', post.postId);
        continue;
      }

      if (!parsed.reports || !Array.isArray(parsed.reports) || parsed.reports.length === 0) {
        continue;
      }

      // Get auto-approve threshold from settings
      const AUTO_APPROVE_THRESHOLD = 80; // Default, can be overridden by app_settings

      // Insert reports
      for (const report of parsed.reports) {
        if (!report.report_date || !report.location || !report.region) {
          continue;
        }

        const confidence = report.confidence || 50;
        const reviewStatus = confidence >= AUTO_APPROVE_THRESHOLD ? 'auto_approved' : 'pending_review';

        const { data: adminReport, error: insertError } = await supabase
          .from('admin_reports')
          .insert({
            report_date: report.report_date,
            location: report.location,
            region: report.region,
            snow_conditions: report.snow_conditions || null,
            hazards: report.hazards || [],
            safety_rating: report.safety_rating || 3,
            raw_source: post.text,
            author_name: report.author_name || post.authorName,
            source_type: 'facebook_auto',
            fb_post_id: post.postId,
            scraped_post_id: scrapedPost.id,
            confidence_score: confidence,
            review_status: reviewStatus,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to insert report:', insertError);
          continue;
        }

        // Link scraped post to admin report
        await supabase
          .from('scraped_posts')
          .update({ admin_report_id: adminReport.id, confidence_score: confidence })
          .eq('id', scrapedPost.id);

        reportsCreated++;

        console.log(`Report created: ${report.location} (confidence: ${confidence}%, status: ${reviewStatus})`);
      }
    }

    // Get Apify run cost
    let apifyCost = 0;
    try {
      const usageResponse = await fetch(
        `https://api.apify.com/v2/acts/apify~facebook-groups-scraper/runs/${job.apify_run_id}`,
        { headers: { 'Authorization': `Bearer ${apifyToken}` } }
      );
      const usageData = await usageResponse.json();
      apifyCost = usageData.data?.stats?.computeUnits * 0.04 || 0; // Approx cost per CU
    } catch {
      console.error('Failed to get Apify usage');
    }

    // === Update job as completed ===
    await supabase
      .from('scrape_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        posts_fetched: posts.length,
        posts_filtered: postsFiltered,
        posts_relevant: postsRelevant,
        reports_created: reportsCreated,
        apify_cost_usd: apifyCost,
        llm_filter_cost_usd: llmFilterCost,
        llm_parse_cost_usd: llmParseCost,
      })
      .eq('id', jobId);

    // Update group stats and date coverage
    const postsPerGroup = Math.floor(posts.length / (job.group_ids?.length || 1));
    const reportsPerGroup = Math.floor(reportsCreated / (job.group_ids?.length || 1));

    for (const groupId of job.group_ids || []) {
      // Get current group data
      const { data: groupData } = await supabase
        .from('fb_group_configs')
        .select('earliest_scraped_date, latest_scraped_date, total_posts_scraped, total_reports_created')
        .eq('id', groupId)
        .single();

      // Calculate new date range
      let newEarliest = job.date_from;
      let newLatest = job.date_to;

      if (groupData) {
        if (groupData.earliest_scraped_date) {
          newEarliest = job.date_from && job.date_from < groupData.earliest_scraped_date
            ? job.date_from
            : groupData.earliest_scraped_date;
        }
        if (groupData.latest_scraped_date) {
          newLatest = job.date_to && job.date_to > groupData.latest_scraped_date
            ? job.date_to
            : groupData.latest_scraped_date;
        }
      }

      // Update group with new stats and date range
      await supabase
        .from('fb_group_configs')
        .update({
          last_scraped_at: new Date().toISOString(),
          earliest_scraped_date: newEarliest,
          latest_scraped_date: newLatest,
          total_posts_scraped: (groupData?.total_posts_scraped || 0) + postsPerGroup,
          total_reports_created: (groupData?.total_reports_created || 0) + reportsPerGroup,
        })
        .eq('id', groupId);

      // Record coverage
      if (job.date_from && job.date_to) {
        await supabase
          .from('scrape_coverage')
          .insert({
            group_id: groupId,
            date_from: job.date_from,
            date_to: job.date_to,
            scrape_job_id: jobId,
          })
          .catch(() => {
            // Ignore duplicate coverage entries
          });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        stats: {
          posts_fetched: posts.length,
          posts_filtered: postsFiltered,
          posts_relevant: postsRelevant,
          reports_created: reportsCreated,
          costs: {
            apify_usd: apifyCost.toFixed(4),
            llm_filter_usd: llmFilterCost.toFixed(4),
            llm_parse_usd: llmParseCost.toFixed(4),
            total_usd: (apifyCost + llmFilterCost + llmParseCost).toFixed(4),
          },
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('FB scrape process error:', error);
    return new Response(
      JSON.stringify({ error: 'Server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
