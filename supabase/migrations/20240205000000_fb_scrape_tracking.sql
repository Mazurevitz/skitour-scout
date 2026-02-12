-- Facebook Scrape Tracking Tables
-- For automated ingestion from FB groups via Apify

-- ============================================
-- FB Group Configurations
-- ============================================
CREATE TABLE fb_group_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Group details
    group_url TEXT NOT NULL UNIQUE,
    group_name TEXT NOT NULL,
    region TEXT NOT NULL,

    -- Settings
    is_active BOOLEAN DEFAULT TRUE,
    max_posts_per_scrape INTEGER DEFAULT 50,

    -- Stats
    last_scraped_at TIMESTAMPTZ,
    total_posts_scraped INTEGER DEFAULT 0,
    total_reports_created INTEGER DEFAULT 0
);

-- Initial FB groups
INSERT INTO fb_group_configs (group_url, group_name, region) VALUES
    ('https://facebook.com/groups/skituring.polska', 'Skituring Polska', 'Tatry'),
    ('https://facebook.com/groups/skituring.beskidy', 'Skituring Beskidy', 'Beskid Żywiecki');

-- ============================================
-- Scrape Jobs
-- ============================================
CREATE TABLE scrape_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Job type
    mode TEXT NOT NULL CHECK (mode IN ('daily', 'backfill', 'manual')),

    -- Apify run details
    apify_run_id TEXT,
    apify_dataset_id TEXT,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'processing', 'completed', 'failed')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,

    -- Groups being scraped
    group_ids UUID[] DEFAULT '{}',

    -- Stats
    posts_fetched INTEGER DEFAULT 0,
    posts_filtered INTEGER DEFAULT 0,
    posts_relevant INTEGER DEFAULT 0,
    reports_created INTEGER DEFAULT 0,

    -- Cost tracking
    apify_cost_usd NUMERIC(10, 4),
    llm_filter_cost_usd NUMERIC(10, 4),
    llm_parse_cost_usd NUMERIC(10, 4),

    -- Who triggered
    triggered_by UUID REFERENCES auth.users(id),
    trigger_source TEXT DEFAULT 'manual' CHECK (trigger_source IN ('manual', 'cron', 'webhook'))
);

-- Index for finding running/recent jobs
CREATE INDEX idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX idx_scrape_jobs_created ON scrape_jobs(created_at DESC);

-- ============================================
-- Scraped Posts (for deduplication)
-- ============================================
CREATE TABLE scraped_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- FB identifiers
    fb_post_id TEXT NOT NULL UNIQUE,
    fb_group_id TEXT,

    -- Post content
    post_text TEXT,
    post_date TIMESTAMPTZ,
    author_name TEXT,
    comment_count INTEGER DEFAULT 0,

    -- Processing status
    is_relevant BOOLEAN,
    relevance_reason TEXT,
    processed_at TIMESTAMPTZ,

    -- Link to job and report
    scrape_job_id UUID REFERENCES scrape_jobs(id),
    admin_report_id UUID REFERENCES admin_reports(id),

    -- Stats
    char_count INTEGER
);

-- Indexes for deduplication and processing
CREATE INDEX idx_scraped_posts_fb_id ON scraped_posts(fb_post_id);
CREATE INDEX idx_scraped_posts_job ON scraped_posts(scrape_job_id);
CREATE INDEX idx_scraped_posts_unprocessed ON scraped_posts(is_relevant) WHERE is_relevant IS NULL;

-- ============================================
-- Modify admin_reports for FB source tracking
-- ============================================
ALTER TABLE admin_reports ADD COLUMN IF NOT EXISTS fb_post_id TEXT;
ALTER TABLE admin_reports ADD COLUMN IF NOT EXISTS scraped_post_id UUID REFERENCES scraped_posts(id);
ALTER TABLE admin_reports ADD COLUMN IF NOT EXISTS source_group TEXT;

-- Index for FB deduplication
CREATE INDEX IF NOT EXISTS idx_admin_reports_fb_post ON admin_reports(fb_post_id) WHERE fb_post_id IS NOT NULL;

-- ============================================
-- RLS Policies
-- ============================================

-- FB Group Configs: Anyone can read, only admins can modify
ALTER TABLE fb_group_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FB groups are viewable by everyone"
    ON fb_group_configs FOR SELECT
    USING (true);

CREATE POLICY "Only admins can modify FB groups"
    ON fb_group_configs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );

-- Scrape Jobs: Only admins can view and manage
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view scrape jobs"
    ON scrape_jobs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );

CREATE POLICY "Only admins can manage scrape jobs"
    ON scrape_jobs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );

-- Scraped Posts: Only admins can view
ALTER TABLE scraped_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view scraped posts"
    ON scraped_posts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );

CREATE POLICY "Only admins can manage scraped posts"
    ON scraped_posts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );

-- ============================================
-- App Settings for FB Scraping
-- ============================================
INSERT INTO app_settings (key, value) VALUES
    ('fb_scrape_enabled', 'true'),
    ('fb_scrape_max_posts_per_group', '50'),
    ('fb_scrape_backfill_days', '30'),
    ('fb_scrape_daily_groups_limit', '3')
ON CONFLICT (key) DO NOTHING;
