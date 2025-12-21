-- NEXUS User Tags Table
-- Links users to the tags they identify with
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  version_locked BOOLEAN DEFAULT false, -- if true, don't auto-update to new versions
  display_order INT DEFAULT 0, -- for sorting on profile
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tag_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_tags_user ON user_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tags_tag ON user_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_user_tags_display_order ON user_tags(user_id, display_order);

-- Enable Row Level Security
ALTER TABLE user_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view tags of public profiles
CREATE POLICY "User tags viewable for public profiles" ON user_tags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = user_tags.user_id
      AND (users.profile_visibility = 'public' OR users.id = auth.uid())
    )
  );

-- Users can manage their own tags
CREATE POLICY "Users can insert own tags" ON user_tags
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags" ON user_tags
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags" ON user_tags
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to increment tag usage_count when user adds tag
CREATE OR REPLACE FUNCTION increment_tag_on_add()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_tag_usage_on_add
  AFTER INSERT ON user_tags
  FOR EACH ROW
  EXECUTE FUNCTION increment_tag_on_add();

-- Trigger to decrement tag usage_count when user removes tag
CREATE OR REPLACE FUNCTION decrement_tag_on_remove()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tags SET usage_count = GREATEST(0, usage_count - 1) WHERE id = OLD.tag_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decrement_tag_usage_on_remove
  AFTER DELETE ON user_tags
  FOR EACH ROW
  EXECUTE FUNCTION decrement_tag_on_remove();

COMMENT ON TABLE user_tags IS 'Tags that users identify with for their connection profile';
COMMENT ON COLUMN user_tags.version_locked IS 'If true, user wants to stay on this specific tag version';
