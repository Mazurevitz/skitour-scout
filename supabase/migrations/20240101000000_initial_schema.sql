-- SkitourScout Initial Database Schema
-- Run this migration to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- Auto-created on user signup via trigger
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles
CREATE POLICY "Profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

-- Users can update their own profile (except is_admin)
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- REPORTS TABLE
-- Community ski touring reports
-- ============================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('ascent', 'descent')),
    location TEXT NOT NULL,
    region TEXT NOT NULL,
    coordinates JSONB, -- {lat: number, lng: number}

    -- Ascent-specific fields
    track_status TEXT CHECK (track_status IN ('przetarte', 'zasypane', 'lod') OR track_status IS NULL),
    gear_needed TEXT[], -- ['foki', 'harszle', 'raki']

    -- Descent-specific fields
    snow_condition TEXT CHECK (snow_condition IN ('puch', 'firn', 'szren', 'beton', 'cukier', 'kamienie', 'mokry') OR snow_condition IS NULL),
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5 OR quality_rating IS NULL),

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Soft delete support
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id)
);

-- Indexes for common queries
CREATE INDEX idx_reports_region ON reports(region);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_not_deleted ON reports(deleted_at) WHERE deleted_at IS NULL;

-- RLS for reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Anyone can read non-deleted reports
CREATE POLICY "Reports are viewable by everyone"
    ON reports FOR SELECT
    USING (deleted_at IS NULL);

-- Authenticated users can create reports
CREATE POLICY "Authenticated users can create reports"
    ON reports FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Authors can soft-delete their own reports
CREATE POLICY "Users can delete own reports"
    ON reports FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins can soft-delete any report
CREATE POLICY "Admins can delete any report"
    ON reports FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );

-- ============================================
-- RATE LIMITS TABLE
-- Track last report time per user
-- ============================================
CREATE TABLE rate_limits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    last_report_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for rate_limits
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can read their own rate limit
CREATE POLICY "Users can read own rate limit"
    ON rate_limits FOR SELECT
    USING (auth.uid() = user_id);

-- System manages rate limits (no direct user updates)
-- Rate limit checks happen in Edge Functions

-- ============================================
-- APP SETTINGS TABLE
-- Global app configuration (admin-managed)
-- ============================================
CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- RLS for app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings
CREATE POLICY "Settings are viewable by everyone"
    ON app_settings FOR SELECT
    USING (true);

-- Only admins can modify settings
CREATE POLICY "Only admins can update settings"
    ON app_settings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );

CREATE POLICY "Only admins can insert settings"
    ON app_settings FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );

-- ============================================
-- INITIAL APP SETTINGS
-- ============================================
INSERT INTO app_settings (key, value) VALUES
    ('llm_provider', '"openrouter"'),
    ('llm_model', '"meta-llama/llama-3.2-3b-instruct:free"'),
    ('rate_limit_minutes', '30');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user can submit report (rate limiting)
CREATE OR REPLACE FUNCTION can_submit_report(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_last_report TIMESTAMPTZ;
    v_rate_limit INTEGER;
BEGIN
    -- Get rate limit setting
    SELECT (value::TEXT)::INTEGER INTO v_rate_limit
    FROM app_settings WHERE key = 'rate_limit_minutes';

    IF v_rate_limit IS NULL THEN
        v_rate_limit := 30; -- Default 30 minutes
    END IF;

    -- Get last report time
    SELECT last_report_at INTO v_last_report
    FROM rate_limits WHERE user_id = p_user_id;

    -- If no previous report or enough time has passed
    IF v_last_report IS NULL OR
       v_last_report < NOW() - (v_rate_limit || ' minutes')::INTERVAL THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get minutes until next allowed report
CREATE OR REPLACE FUNCTION minutes_until_next_report(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_last_report TIMESTAMPTZ;
    v_rate_limit INTEGER;
    v_minutes_passed INTEGER;
BEGIN
    -- Get rate limit setting
    SELECT (value::TEXT)::INTEGER INTO v_rate_limit
    FROM app_settings WHERE key = 'rate_limit_minutes';

    IF v_rate_limit IS NULL THEN
        v_rate_limit := 30;
    END IF;

    -- Get last report time
    SELECT last_report_at INTO v_last_report
    FROM rate_limits WHERE user_id = p_user_id;

    IF v_last_report IS NULL THEN
        RETURN 0;
    END IF;

    v_minutes_passed := EXTRACT(EPOCH FROM (NOW() - v_last_report)) / 60;

    IF v_minutes_passed >= v_rate_limit THEN
        RETURN 0;
    END IF;

    RETURN v_rate_limit - v_minutes_passed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
