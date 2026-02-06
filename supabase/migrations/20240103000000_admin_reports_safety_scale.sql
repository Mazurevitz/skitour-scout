-- Change is_safe boolean to safety_rating scale (1-5, where 1=worst, 5=best)
ALTER TABLE admin_reports
  DROP COLUMN is_safe,
  ADD COLUMN safety_rating INTEGER DEFAULT 3 CHECK (safety_rating >= 1 AND safety_rating <= 5);

-- Add optional source_group for Facebook group name
ALTER TABLE admin_reports
  ADD COLUMN source_group TEXT;

-- Add comment for clarity
COMMENT ON COLUMN admin_reports.safety_rating IS 'Safety scale 1-5: 1=bardzo niebezpieczne, 5=bardzo bezpieczne';
COMMENT ON COLUMN admin_reports.source_group IS 'Facebook group name where the report was found';
