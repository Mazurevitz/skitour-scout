-- Report Review System
-- Auto-approve high confidence reports, queue low confidence for review

-- Add review fields to admin_reports
ALTER TABLE admin_reports
    ADD COLUMN IF NOT EXISTS confidence_score INTEGER,
    ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'auto_approved'
        CHECK (review_status IN ('auto_approved', 'pending_review', 'approved', 'rejected')),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

-- Add confidence to scraped_posts
ALTER TABLE scraped_posts
    ADD COLUMN IF NOT EXISTS confidence_score INTEGER;

-- Index for finding pending reviews
CREATE INDEX IF NOT EXISTS idx_admin_reports_pending_review
    ON admin_reports(review_status)
    WHERE review_status = 'pending_review';

-- Update RLS to allow admins to see pending reviews
-- (existing policies should already cover this)

-- Add app setting for confidence threshold
INSERT INTO app_settings (key, value) VALUES
    ('fb_scrape_auto_approve_threshold', '80')
ON CONFLICT (key) DO NOTHING;
