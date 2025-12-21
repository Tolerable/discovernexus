-- Add discovery columns to ai_profiles table
-- Run this in Supabase SQL Editor (EZTUNES database)
-- Required for AI participants to complete discovery flow

-- Add discovery_answers column
ALTER TABLE ai_profiles
ADD COLUMN IF NOT EXISTS discovery_answers JSONB DEFAULT '{}'::jsonb;

-- Add discovery_complete column
ALTER TABLE ai_profiles
ADD COLUMN IF NOT EXISTS discovery_complete BOOLEAN DEFAULT false;

-- Add tags column for storing selected tags
ALTER TABLE ai_profiles
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create index for discovery queries
CREATE INDEX IF NOT EXISTS idx_ai_profiles_discovery ON ai_profiles(discovery_complete);

-- Comments
COMMENT ON COLUMN ai_profiles.discovery_answers IS 'AI personality answers from discovery flow';
COMMENT ON COLUMN ai_profiles.discovery_complete IS 'Whether AI has completed discovery';
COMMENT ON COLUMN ai_profiles.tags IS 'Selected tags for matching';
