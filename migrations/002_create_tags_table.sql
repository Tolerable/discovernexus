-- NEXUS Tags Table
-- Versioned tag definitions for connection patterns
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name TEXT NOT NULL,
  version TEXT NOT NULL, -- e.g., 'v1.0', 'v2.3'
  definition TEXT NOT NULL,
  examples TEXT[] DEFAULT ARRAY[]::TEXT[],
  category TEXT, -- 'arousal_pattern', 'communication_style', 'relationship_structure', etc.
  related_tags UUID[] DEFAULT ARRAY[]::UUID[],
  usage_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  is_current BOOLEAN DEFAULT true,
  UNIQUE(tag_name, version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
CREATE INDEX IF NOT EXISTS idx_tags_current ON tags(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_tags_usage_count ON tags(usage_count DESC);

-- Enable Row Level Security
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can view tags
CREATE POLICY "Tags are viewable by everyone" ON tags
  FOR SELECT
  USING (true);

-- Only authenticated users can propose tags (via tag_proposals table)
-- Admins can insert directly (handle via application logic)
CREATE POLICY "Authenticated users can view all tags" ON tags
  FOR SELECT
  USING (true);

-- Function to get current version of a tag
CREATE OR REPLACE FUNCTION get_current_tag_version(tag_name_param TEXT)
RETURNS tags AS $$
  SELECT * FROM tags
  WHERE tag_name = tag_name_param AND is_current = true
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_tag_usage(tag_id_param UUID)
RETURNS VOID AS $$
  UPDATE tags SET usage_count = usage_count + 1 WHERE id = tag_id_param;
$$ LANGUAGE SQL;

COMMENT ON TABLE tags IS 'Versioned taxonomy of connection patterns and preferences';
COMMENT ON COLUMN tags.version IS 'Semantic version (v1.0, v2.3, etc.)';
COMMENT ON COLUMN tags.is_current IS 'Whether this is the current version of the tag';
