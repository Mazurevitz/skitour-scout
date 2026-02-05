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
    ...(session?.access_token && {
      'Authorization': `Bearer ${session.access_token}`,
    }),
  };
};
