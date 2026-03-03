-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Table to store embeddings for reports
CREATE TABLE report_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID, -- Can be null for route embeddings
  report_type TEXT NOT NULL CHECK (report_type IN ('community', 'admin', 'route')),
  content TEXT NOT NULL, -- The text that was embedded
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}', -- region, location, route_id, timestamp, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_report_embeddings_report_id ON report_embeddings(report_id);
CREATE INDEX idx_report_embeddings_report_type ON report_embeddings(report_type);
CREATE INDEX idx_report_embeddings_metadata_region ON report_embeddings((metadata->>'region'));

-- IVFFlat index for approximate nearest neighbor search
-- Lists = sqrt(number of rows) is a good starting point, using 100 for up to 10k embeddings
CREATE INDEX idx_report_embeddings_vector ON report_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Function to search for similar reports
CREATE OR REPLACE FUNCTION match_reports(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_region text DEFAULT NULL,
  filter_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  report_id UUID,
  report_type TEXT,
  content TEXT,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    re.id,
    re.report_id,
    re.report_type,
    re.content,
    re.metadata,
    1 - (re.embedding <=> query_embedding) as similarity
  FROM report_embeddings re
  WHERE
    1 - (re.embedding <=> query_embedding) > match_threshold
    AND (filter_region IS NULL OR re.metadata->>'region' = filter_region)
    AND (filter_types IS NULL OR re.report_type = ANY(filter_types))
  ORDER BY re.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to upsert embedding (for updates)
CREATE OR REPLACE FUNCTION upsert_report_embedding(
  p_report_id UUID,
  p_report_type TEXT,
  p_content TEXT,
  p_embedding vector(1536),
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- For route embeddings (no report_id), use content hash as unique key
  IF p_report_id IS NULL THEN
    INSERT INTO report_embeddings (report_type, content, embedding, metadata, updated_at)
    VALUES (p_report_type, p_content, p_embedding, p_metadata, now())
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_id;
  ELSE
    -- For report embeddings, upsert by report_id
    INSERT INTO report_embeddings (report_id, report_type, content, embedding, metadata, updated_at)
    VALUES (p_report_id, p_report_type, p_content, p_embedding, p_metadata, now())
    ON CONFLICT (report_id)
    DO UPDATE SET
      content = EXCLUDED.content,
      embedding = EXCLUDED.embedding,
      metadata = EXCLUDED.metadata,
      updated_at = now()
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- Add unique constraint for report_id (allows null for route embeddings)
CREATE UNIQUE INDEX idx_report_embeddings_report_id_unique
  ON report_embeddings(report_id)
  WHERE report_id IS NOT NULL;

-- RLS policies
ALTER TABLE report_embeddings ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to embeddings"
  ON report_embeddings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update embeddings (via edge functions)
CREATE POLICY "Service role can manage embeddings"
  ON report_embeddings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE report_embeddings IS 'Vector embeddings for semantic search over reports and routes';
COMMENT ON FUNCTION match_reports IS 'Similarity search function for RAG retrieval';
