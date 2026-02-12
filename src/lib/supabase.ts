import { createClient } from '@supabase/supabase-js';

// Database types for Supabase
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
        };
      };
      reports: {
        Row: {
          id: string;
          user_id: string;
          type: 'ascent' | 'descent';
          location: string;
          region: string;
          coordinates: { lat: number; lng: number } | null;
          track_status: 'przetarte' | 'zasypane' | 'lod' | null;
          gear_needed: string[] | null;
          snow_condition: 'puch' | 'firn' | 'szren' | 'beton' | 'cukier' | 'kamienie' | 'mokry' | null;
          quality_rating: number | null;
          notes: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'ascent' | 'descent';
          location: string;
          region: string;
          coordinates?: { lat: number; lng: number } | null;
          track_status?: 'przetarte' | 'zasypane' | 'lod' | null;
          gear_needed?: string[] | null;
          snow_condition?: 'puch' | 'firn' | 'szren' | 'beton' | 'cukier' | 'kamienie' | 'mokry' | null;
          quality_rating?: number | null;
          notes?: string | null;
        };
        Update: {
          deleted_at?: string;
          deleted_by?: string;
        };
      };
      rate_limits: {
        Row: {
          user_id: string;
          last_report_at: string;
        };
        Insert: {
          user_id: string;
          last_report_at?: string;
        };
        Update: {
          last_report_at?: string;
        };
      };
      app_settings: {
        Row: {
          key: string;
          value: unknown;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: unknown;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          value?: unknown;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
      admin_reports: {
        Row: {
          id: string;
          created_at: string;
          report_date: string;
          location: string;
          region: string;
          snow_conditions: string | null;
          hazards: string[];
          safety_rating: number;
          raw_source: string | null;
          author_name: string | null;
          source_group: string | null;
          source_type: string;
          ingested_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          fb_post_id: string | null;
          scraped_post_id: string | null;
          confidence_score: number | null;
          review_status: 'auto_approved' | 'pending_review' | 'approved' | 'rejected';
          reviewed_at: string | null;
          reviewed_by: string | null;
        };
        Insert: {
          id?: string;
          report_date: string;
          location: string;
          region: string;
          snow_conditions?: string | null;
          hazards?: string[];
          safety_rating?: number;
          raw_source?: string | null;
          author_name?: string | null;
          source_group?: string | null;
          source_type?: string;
          ingested_by?: string | null;
          fb_post_id?: string | null;
          scraped_post_id?: string | null;
          confidence_score?: number | null;
          review_status?: 'auto_approved' | 'pending_review' | 'approved' | 'rejected';
        };
        Update: {
          deleted_at?: string;
          deleted_by?: string;
          review_status?: 'auto_approved' | 'pending_review' | 'approved' | 'rejected';
          reviewed_at?: string;
          reviewed_by?: string;
          location?: string;
          region?: string;
          snow_conditions?: string | null;
          hazards?: string[];
          safety_rating?: number;
          report_date?: string;
          author_name?: string | null;
        };
      };
      fb_group_configs: {
        Row: {
          id: string;
          created_at: string;
          group_url: string;
          group_name: string;
          region: string;
          is_active: boolean;
          max_posts_per_scrape: number;
          last_scraped_at: string | null;
          total_posts_scraped: number;
          total_reports_created: number;
        };
        Insert: {
          id?: string;
          group_url: string;
          group_name: string;
          region: string;
          is_active?: boolean;
          max_posts_per_scrape?: number;
        };
        Update: {
          group_url?: string;
          group_name?: string;
          region?: string;
          is_active?: boolean;
          max_posts_per_scrape?: number;
          last_scraped_at?: string;
          total_posts_scraped?: number;
          total_reports_created?: number;
        };
      };
      scrape_jobs: {
        Row: {
          id: string;
          created_at: string;
          mode: 'daily' | 'backfill' | 'manual';
          apify_run_id: string | null;
          apify_dataset_id: string | null;
          status: 'pending' | 'running' | 'processing' | 'completed' | 'failed';
          started_at: string | null;
          completed_at: string | null;
          error_message: string | null;
          group_ids: string[];
          posts_fetched: number;
          posts_filtered: number;
          posts_relevant: number;
          reports_created: number;
          apify_cost_usd: number | null;
          llm_filter_cost_usd: number | null;
          llm_parse_cost_usd: number | null;
          triggered_by: string | null;
          trigger_source: 'manual' | 'cron' | 'webhook';
          date_from: string | null;
          date_to: string | null;
        };
        Insert: {
          id?: string;
          mode: 'daily' | 'backfill' | 'manual';
          apify_run_id?: string | null;
          apify_dataset_id?: string | null;
          status?: 'pending' | 'running' | 'processing' | 'completed' | 'failed';
          group_ids?: string[];
          triggered_by?: string | null;
          trigger_source?: 'manual' | 'cron' | 'webhook';
          date_from?: string | null;
          date_to?: string | null;
        };
        Update: {
          apify_run_id?: string | null;
          apify_dataset_id?: string | null;
          status?: 'pending' | 'running' | 'processing' | 'completed' | 'failed';
          started_at?: string | null;
          completed_at?: string | null;
          error_message?: string | null;
          posts_fetched?: number;
          posts_filtered?: number;
          posts_relevant?: number;
          reports_created?: number;
          apify_cost_usd?: number | null;
          llm_filter_cost_usd?: number | null;
          llm_parse_cost_usd?: number | null;
        };
      };
      scraped_posts: {
        Row: {
          id: string;
          created_at: string;
          fb_post_id: string;
          fb_group_id: string | null;
          post_text: string | null;
          post_date: string | null;
          author_name: string | null;
          comment_count: number;
          is_relevant: boolean | null;
          relevance_reason: string | null;
          processed_at: string | null;
          scrape_job_id: string | null;
          admin_report_id: string | null;
          char_count: number | null;
        };
        Insert: {
          id?: string;
          fb_post_id: string;
          fb_group_id?: string | null;
          post_text?: string | null;
          post_date?: string | null;
          author_name?: string | null;
          comment_count?: number;
          is_relevant?: boolean | null;
          relevance_reason?: string | null;
          processed_at?: string | null;
          scrape_job_id?: string | null;
          admin_report_id?: string | null;
          char_count?: number | null;
        };
        Update: {
          is_relevant?: boolean | null;
          relevance_reason?: string | null;
          processed_at?: string | null;
          admin_report_id?: string | null;
        };
      };
    };
    Functions: {
      can_submit_report: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      minutes_until_next_report: {
        Args: { p_user_id: string };
        Returns: number;
      };
    };
  };
}

// Profile type for easier use
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Report = Database['public']['Tables']['reports']['Row'];
export type ReportInsert = Database['public']['Tables']['reports']['Insert'];
export type AppSetting = Database['public']['Tables']['app_settings']['Row'];
export type AdminReport = Database['public']['Tables']['admin_reports']['Row'];
export type AdminReportInsert = Database['public']['Tables']['admin_reports']['Insert'];
export type FBGroupConfig = Database['public']['Tables']['fb_group_configs']['Row'];
export type ScrapeJob = Database['public']['Tables']['scrape_jobs']['Row'];
export type ScrapedPost = Database['public']['Tables']['scraped_posts']['Row'];

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Some features will be unavailable.');
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

// Check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

// Get the Edge Function URL base
export const getEdgeFunctionUrl = (functionName: string) => {
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/functions/v1/${functionName}`;
};

// Helper to get auth headers for Edge Function calls
export const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey || '',
    ...(session?.access_token && {
      'Authorization': `Bearer ${session.access_token}`,
    }),
  };
};

// Helper to call Edge Functions with proper auth
export const callEdgeFunction = async <T = unknown>(
  functionName: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> => {
  try {
    console.log('[callEdgeFunction] Calling:', functionName, body);

    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    console.log('[callEdgeFunction] Response:', { data, error: error?.message });

    if (error) {
      // Try to parse error context for better messages
      let errorMsg = error.message;
      if (data?.error) errorMsg = data.error;
      if (data?.details) errorMsg += `: ${data.details}`;
      if (data?.help) errorMsg += `\n\n${data.help}`;
      return { data: null, error: errorMsg };
    }

    return { data: data as T, error: null };
  } catch (err) {
    console.error('[callEdgeFunction] Error:', err);
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
};
