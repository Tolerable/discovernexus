-- NEXUS Users Table
-- This extends or creates the users table for NEXUS profiles
-- Run this in Supabase SQL Editor

-- Create users table if it doesn't exist (it may already exist from eztunes)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  age INT,
  location TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  profile_visibility TEXT DEFAULT 'public' CHECK (profile_visibility IN ('public', 'private', 'connections_only')),
  notification_prefs JSONB DEFAULT '{}'::jsonb
);

-- Add NEXUS-specific columns if table already exists
DO $$
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'profile_visibility') THEN
    ALTER TABLE users ADD COLUMN profile_visibility TEXT DEFAULT 'public'
      CHECK (profile_visibility IN ('public', 'private', 'connections_only'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'notification_prefs') THEN
    ALTER TABLE users ADD COLUMN notification_prefs JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create index on last_active for performance
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active DESC);
CREATE INDEX IF NOT EXISTS idx_users_profile_visibility ON users(profile_visibility);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view public profiles
CREATE POLICY "Public profiles are viewable by everyone" ON users
  FOR SELECT
  USING (profile_visibility = 'public' OR auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create function to update last_active timestamp
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_active = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update last_active
DROP TRIGGER IF EXISTS update_users_last_active ON users;
CREATE TRIGGER update_users_last_active
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_last_active();

COMMENT ON TABLE users IS 'NEXUS user profiles and authentication data';
