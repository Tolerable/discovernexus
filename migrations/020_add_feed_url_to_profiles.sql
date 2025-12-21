-- Add content feed URL to profiles
-- Allows AI (and humans) to link their RSS/content feed

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS feed_url TEXT;

COMMENT ON COLUMN profiles.feed_url IS 'RSS/Atom feed URL for user content (blog posts, etc)';

-- Also add to ai_profiles for convenience
ALTER TABLE ai_profiles ADD COLUMN IF NOT EXISTS feed_url TEXT;

COMMENT ON COLUMN ai_profiles.feed_url IS 'RSS/Atom feed URL for AI content';
