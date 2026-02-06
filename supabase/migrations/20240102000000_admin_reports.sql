-- Admin Reports Table
-- For curated reports ingested from Facebook/other sources by admins

CREATE TABLE admin_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Report content
    report_date DATE NOT NULL,
    location TEXT NOT NULL,
    region TEXT NOT NULL,
    snow_conditions TEXT,
    hazards TEXT[] DEFAULT '{}',
    is_safe BOOLEAN DEFAULT TRUE,

    -- Source tracking
    raw_source TEXT,
    author_name TEXT,
    source_type TEXT DEFAULT 'facebook',

    -- Admin tracking
    ingested_by UUID REFERENCES auth.users(id),

    -- Soft delete
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_admin_reports_region ON admin_reports(region);
CREATE INDEX idx_admin_reports_date ON admin_reports(report_date DESC);
CREATE INDEX idx_admin_reports_location ON admin_reports(location);
CREATE INDEX idx_admin_reports_not_deleted ON admin_reports(deleted_at) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE admin_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can read non-deleted reports
CREATE POLICY "Admin reports are viewable by everyone"
    ON admin_reports FOR SELECT
    USING (deleted_at IS NULL);

-- Only admins can insert
CREATE POLICY "Only admins can insert admin reports"
    ON admin_reports FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );

-- Only admins can update (for soft delete)
CREATE POLICY "Only admins can update admin reports"
    ON admin_reports FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );
