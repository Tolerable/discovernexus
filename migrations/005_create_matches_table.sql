-- NEXUS Matches Table
-- Connections between users
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  compatibility_score FLOAT CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  initiated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id <> user2_id) -- Can't match with yourself
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_matches_user1 ON matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2 ON matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_created ON matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(compatibility_score DESC);

-- Enable Row Level Security
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view matches they're involved in
CREATE POLICY "Users can view own matches" ON matches
  FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Users can create match requests
CREATE POLICY "Users can create match requests" ON matches
  FOR INSERT
  WITH CHECK (auth.uid() = initiated_by AND (auth.uid() = user1_id OR auth.uid() = user2_id));

-- Users can update matches they're involved in (to accept/decline)
CREATE POLICY "Users can update own matches" ON matches
  FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Users can delete matches they're involved in
CREATE POLICY "Users can delete own matches" ON matches
  FOR DELETE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_matches_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_matches_timestamp();

-- Function to get user's matches
CREATE OR REPLACE FUNCTION get_user_matches(user_id_param UUID, status_filter TEXT DEFAULT NULL)
RETURNS SETOF matches AS $$
  SELECT * FROM matches
  WHERE (user1_id = user_id_param OR user2_id = user_id_param)
  AND (status_filter IS NULL OR status = status_filter)
  ORDER BY created_at DESC;
$$ LANGUAGE SQL STABLE;

COMMENT ON TABLE matches IS 'Connection requests and matches between users';
COMMENT ON COLUMN matches.compatibility_score IS 'AI-calculated compatibility percentage (0-100)';
COMMENT ON COLUMN matches.status IS 'Current status of the match request';
