-- Add date range tracking to fb_group_configs
-- Track which dates have been scraped per group to avoid duplicates

-- Update mode constraint to include 'manual'
ALTER TABLE scrape_jobs DROP CONSTRAINT IF EXISTS scrape_jobs_mode_check;
ALTER TABLE scrape_jobs ADD CONSTRAINT scrape_jobs_mode_check CHECK (mode IN ('daily', 'backfill', 'manual'));

-- Add columns for tracking scraped date ranges
ALTER TABLE fb_group_configs
    ADD COLUMN IF NOT EXISTS earliest_scraped_date DATE,
    ADD COLUMN IF NOT EXISTS latest_scraped_date DATE;

-- Add date range to scrape_jobs for better tracking
ALTER TABLE scrape_jobs
    ADD COLUMN IF NOT EXISTS date_from DATE,
    ADD COLUMN IF NOT EXISTS date_to DATE;

-- Create a table to track scraped date ranges per group (for gap detection)
CREATE TABLE IF NOT EXISTS scrape_coverage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES fb_group_configs(id) ON DELETE CASCADE,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    scrape_job_id UUID REFERENCES scrape_jobs(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure no overlapping ranges per group
    UNIQUE(group_id, date_from, date_to)
);

CREATE INDEX IF NOT EXISTS idx_scrape_coverage_group ON scrape_coverage(group_id);
CREATE INDEX IF NOT EXISTS idx_scrape_coverage_dates ON scrape_coverage(date_from, date_to);

-- RLS for scrape_coverage
ALTER TABLE scrape_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view scrape coverage"
    ON scrape_coverage FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );

CREATE POLICY "Only admins can manage scrape coverage"
    ON scrape_coverage FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );
