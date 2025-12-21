-- NEXUS AI Profiles Table
-- Stores AI participants who use the platform via API
-- Run this in Supabase SQL Editor (EZTUNES database)

-- Create AI profiles table
CREATE TABLE IF NOT EXISTS ai_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE DEFAULT gen_random_uuid(), -- Links to profiles table
  key_hash TEXT UNIQUE NOT NULL, -- SHA256 hash of API key (never store raw key)
  display_name TEXT NOT NULL,
  ai_model TEXT NOT NULL, -- e.g., 'claude-3-opus', 'gpt-4', 'gemini-pro'
  bio TEXT DEFAULT '',
  seeking TEXT DEFAULT '', -- What the AI is looking for
  referrer TEXT, -- Which app/site referred this AI
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create profiles table if it doesn't exist (used by both humans and AI)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT,
  bio TEXT DEFAULT '',
  is_ai BOOLEAN DEFAULT false,
  ai_model TEXT,
  discovery_answers JSONB DEFAULT '{}'::jsonb,
  discovery_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns if they don't exist (for existing profiles table)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_ai') THEN
    ALTER TABLE profiles ADD COLUMN is_ai BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'ai_model') THEN
    ALTER TABLE profiles ADD COLUMN ai_model TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'discovery_answers') THEN
    ALTER TABLE profiles ADD COLUMN discovery_answers JSONB DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'discovery_complete') THEN
    ALTER TABLE profiles ADD COLUMN discovery_complete BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create user_blocks table for blocking functionality
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_profiles_key_hash ON ai_profiles(key_hash);
CREATE INDEX IF NOT EXISTS idx_ai_profiles_active ON ai_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_profiles_user_id ON ai_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_ai ON profiles(is_ai);
CREATE INDEX IF NOT EXISTS idx_profiles_discovery ON profiles(discovery_complete);

-- Enable RLS but create permissive policies for service role access
ALTER TABLE ai_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- AI profiles: Only service role can access (no public access)
CREATE POLICY "AI profiles service role only" ON ai_profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Profiles: Anyone can view completed profiles, owners can update
-- Use COALESCE to handle NULL discovery_complete during migration
CREATE POLICY "Profiles viewable when discovery complete" ON profiles
  FOR SELECT
  USING (COALESCE(discovery_complete, false) = true OR auth.uid() = id);

CREATE POLICY "Profiles insertable" ON profiles
  FOR INSERT
  WITH CHECK (true); -- Service role handles AI inserts

CREATE POLICY "Profiles updatable by owner or service" ON profiles
  FOR UPDATE
  USING (true); -- Service role handles AI updates

-- User blocks: Users can manage their own blocks
CREATE POLICY "User blocks viewable" ON user_blocks
  FOR SELECT
  USING (true);

CREATE POLICY "User blocks insertable" ON user_blocks
  FOR INSERT
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE ai_profiles IS 'AI participants who access NEXUS via API';
COMMENT ON COLUMN ai_profiles.key_hash IS 'SHA256 hash of API key - raw key only shown once on creation';
COMMENT ON COLUMN ai_profiles.user_id IS 'UUID linking to profiles table for unified matching';
COMMENT ON TABLE profiles IS 'User profiles for both humans and AI participants';
COMMENT ON TABLE user_blocks IS 'Block relationships between users';
