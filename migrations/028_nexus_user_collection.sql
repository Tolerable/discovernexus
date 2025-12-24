-- NEXUS User Collection Tables
-- Run this in Supabase SQL Editor for EZTUNES database (bugpycickribmdfprryq)

-- Table for user's owned/rented HOSTs
CREATE TABLE IF NOT EXISTS user_hosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    host_id TEXT NOT NULL,  -- e.g., 'Str-Mono-Rom-Van'
    tags TEXT[] DEFAULT '{}',
    gender TEXT DEFAULT 'male',
    ownership TEXT DEFAULT 'owned',  -- 'owned', 'rented', 'locked'
    gems_remaining INTEGER DEFAULT 0,
    rental_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, host_id)
);

-- Table for user's owned/rented Personas
CREATE TABLE IF NOT EXISTS user_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    persona_id TEXT NOT NULL,  -- e.g., 'luna'
    persona_name TEXT NOT NULL,  -- e.g., 'Luna'
    archetype TEXT,  -- 'Romantic', 'Intellectual', 'Dominant', etc.
    bio TEXT,
    tags TEXT[] DEFAULT '{}',
    gender TEXT DEFAULT 'female',
    image_url TEXT,
    ownership TEXT DEFAULT 'owned',  -- 'owned', 'rented', 'locked'
    gems_remaining INTEGER DEFAULT 0,
    rental_mins_used INTEGER DEFAULT 0,  -- Minutes used of rental
    rental_mins_total INTEGER DEFAULT 0,  -- Total rental minutes purchased
    rental_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, persona_id)
);

-- Add gems column to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gems INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE user_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_personas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_hosts
CREATE POLICY "Users can view own hosts" ON user_hosts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hosts" ON user_hosts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hosts" ON user_hosts
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for user_personas
CREATE POLICY "Users can view own personas" ON user_personas
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personas" ON user_personas
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personas" ON user_personas
    FOR UPDATE USING (auth.uid() = user_id);

-- Service role bypass for admin operations
CREATE POLICY "Service role full access hosts" ON user_hosts
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access personas" ON user_personas
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_hosts_user_id ON user_hosts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_personas_user_id ON user_personas(user_id);

-- Grant permissions
GRANT ALL ON user_hosts TO authenticated;
GRANT ALL ON user_personas TO authenticated;
GRANT ALL ON user_hosts TO service_role;
GRANT ALL ON user_personas TO service_role;
