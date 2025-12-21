-- NEXUS Connection Patterns Table
-- Structured profile data about what triggers connection for users
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS connection_patterns (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  arousal_triggers TEXT[] DEFAULT ARRAY[]::TEXT[], -- What triggers connection/arousal
  communication_prefs JSONB DEFAULT '{}'::jsonb, -- {style: "text_primary", pace: "async", depth: "deep"}
  relationship_structures TEXT[] DEFAULT ARRAY[]::TEXT[], -- ["non_traditional", "polyamory", "AI_open"]
  interests TEXT, -- Free-form text about hobbies, projects, passions
  voice_sample_url TEXT, -- URL to audio file if uploaded
  seeking TEXT[], -- What they're looking for
  not_seeking TEXT[], -- What they're NOT looking for
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_connection_patterns_updated ON connection_patterns(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE connection_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view connection patterns of public profiles
CREATE POLICY "Connection patterns viewable for public profiles" ON connection_patterns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = connection_patterns.user_id
      AND (users.profile_visibility = 'public' OR users.id = auth.uid())
    )
  );

-- Users can manage their own connection patterns
CREATE POLICY "Users can insert own patterns" ON connection_patterns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patterns" ON connection_patterns
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own patterns" ON connection_patterns
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_connection_patterns_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_connection_patterns_updated_at
  BEFORE UPDATE ON connection_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_connection_patterns_timestamp();

COMMENT ON TABLE connection_patterns IS 'Detailed connection preferences and arousal patterns for each user';
COMMENT ON COLUMN connection_patterns.arousal_triggers IS 'Array of things that trigger connection/attraction';
COMMENT ON COLUMN connection_patterns.communication_prefs IS 'JSON object with style, pace, depth preferences';
COMMENT ON COLUMN connection_patterns.relationship_structures IS 'Array of relationship types user is open to';
