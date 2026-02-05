import { create } from 'zustand';
import type { User, AuthError, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase, Profile, isSupabaseConfigured } from '../lib/supabase';

export type AuthProvider = 'google' | 'facebook';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  initialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  signInWithProvider: (provider: AuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isAdmin: false,
  loading: false,
  error: null,
  initialized: false,

  initialize: async () => {
    if (!isSupabaseConfigured()) {
      set({ initialized: true, loading: false });
      return;
    }

    set({ loading: true });

    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (session?.user) {
        // Fetch profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error fetching profile:', profileError);
        }

        const profileData = profile as Profile | null;
        set({
          user: session.user,
          profile: profileData,
          isAdmin: profileData?.is_admin || false,
        });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Fetch profile on sign in
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          const profileData = profile as Profile | null;
          set({
            user: session.user,
            profile: profileData,
            isAdmin: profileData?.is_admin || false,
            error: null,
          });
        } else if (event === 'SIGNED_OUT') {
          set({
            user: null,
            profile: null,
            isAdmin: false,
          });
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          set({ user: session.user });
        }
      });
    } catch (error) {
      const authError = error as AuthError;
      console.error('Auth initialization error:', authError);
      set({ error: authError.message });
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  signInWithProvider: async (provider: AuthProvider) => {
    if (!isSupabaseConfigured()) {
      set({ error: 'Supabase is not configured' });
      return;
    }

    set({ loading: true, error: null });

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      const authError = error as AuthError;
      console.error('Sign in error:', authError);
      set({ error: authError.message, loading: false });
    }
  },

  signOut: async () => {
    if (!isSupabaseConfigured()) {
      return;
    }

    set({ loading: true, error: null });

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      set({
        user: null,
        profile: null,
        isAdmin: false,
      });
    } catch (error) {
      const authError = error as AuthError;
      console.error('Sign out error:', authError);
      set({ error: authError.message });
    } finally {
      set({ loading: false });
    }
  },

  refreshProfile: async () => {
    const { user } = get();

    if (!user || !isSupabaseConfigured()) {
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        throw error;
      }

      const profileData = profile as Profile | null;
      set({
        profile: profileData,
        isAdmin: profileData?.is_admin || false,
      });
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
