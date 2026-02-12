-- Simplify regions: merge Beskidy, make group region optional
-- Groups can contain posts about ANY region - LLM detects region per post

-- Make region nullable in fb_group_configs
ALTER TABLE fb_group_configs ALTER COLUMN region DROP NOT NULL;

-- Update existing groups to remove region (it's per-post, not per-group)
UPDATE fb_group_configs SET region = NULL;

-- Update any existing reports to use simplified regions
UPDATE admin_reports SET region = 'Beskidy' WHERE region IN ('Beskid Śląski', 'Beskid Żywiecki');
