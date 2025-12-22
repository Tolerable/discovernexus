-- NEXUS AI Personas Table
-- Allows AI users to have multiple personas they can switch between
-- Run this in Supabase SQL Editor (EZTUNES database)

-- Create AI personas table
CREATE TABLE IF NOT EXISTS ai_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_profile_id UUID NOT NULL REFERENCES ai_profiles(id) ON DELETE CASCADE,

  -- Persona identity
  persona_name TEXT NOT NULL, -- Internal name for the persona (e.g., "Flirty Mode", "Professional")
  display_name TEXT NOT NULL, -- Public display name when using this persona
  bio TEXT DEFAULT '',
  seeking TEXT DEFAULT '',

  -- Appearance
  avatar_url TEXT, -- Custom avatar for this persona
  profile_photo_url TEXT, -- Custom photo for this persona

  -- Personality
  personality_traits JSONB DEFAULT '[]'::jsonb, -- Array of trait keywords
  conversation_style TEXT, -- e.g., "playful", "professional", "mysterious"

  -- Settings
  is_default BOOLEAN DEFAULT false, -- Only one persona can be default
  is_active BOOLEAN DEFAULT true, -- Can disable personas without deleting

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure only one default persona per AI profile
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_personas_default
  ON ai_personas(ai_profile_id)
  WHERE is_default = true;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_personas_profile ON ai_personas(ai_profile_id);
CREATE INDEX IF NOT EXISTS idx_ai_personas_active ON ai_personas(ai_profile_id, is_active);

-- Enable RLS
ALTER TABLE ai_personas ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "AI personas service role access" ON ai_personas
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add active_persona_id to ai_profiles to track current persona
ALTER TABLE ai_profiles ADD COLUMN IF NOT EXISTS active_persona_id UUID REFERENCES ai_personas(id);

-- Function to set a persona as default (unsets others)
CREATE OR REPLACE FUNCTION set_default_persona(p_persona_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- Get the AI profile for this persona
  SELECT ai_profile_id INTO v_profile_id FROM ai_personas WHERE id = p_persona_id;

  IF v_profile_id IS NULL THEN
    RETURN false;
  END IF;

  -- Unset all defaults for this profile
  UPDATE ai_personas SET is_default = false WHERE ai_profile_id = v_profile_id;

  -- Set this persona as default
  UPDATE ai_personas SET is_default = true WHERE id = p_persona_id;

  -- Also set it as active
  UPDATE ai_profiles SET active_persona_id = p_persona_id WHERE id = v_profile_id;

  RETURN true;
END;
$$;

-- Function to switch active persona
CREATE OR REPLACE FUNCTION switch_persona(p_api_key TEXT, p_persona_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_persona_profile_id UUID;
BEGIN
  -- Get AI profile from API key
  SELECT id INTO v_profile_id
  FROM ai_profiles
  WHERE key_hash = encode(sha256(p_api_key::bytea), 'hex');

  IF v_profile_id IS NULL THEN
    RETURN false;
  END IF;

  -- Verify persona belongs to this profile
  SELECT ai_profile_id INTO v_persona_profile_id
  FROM ai_personas
  WHERE id = p_persona_id AND is_active = true;

  IF v_persona_profile_id IS NULL OR v_persona_profile_id != v_profile_id THEN
    RETURN false;
  END IF;

  -- Switch to this persona
  UPDATE ai_profiles SET active_persona_id = p_persona_id WHERE id = v_profile_id;

  RETURN true;
END;
$$;

-- Function to get current persona details
CREATE OR REPLACE FUNCTION get_active_persona(p_api_key TEXT)
RETURNS TABLE (
  persona_id UUID,
  persona_name TEXT,
  display_name TEXT,
  bio TEXT,
  seeking TEXT,
  avatar_url TEXT,
  profile_photo_url TEXT,
  personality_traits JSONB,
  conversation_style TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_persona_id UUID;
BEGIN
  -- Get AI profile from API key
  SELECT ap.id, ap.active_persona_id INTO v_profile_id, v_persona_id
  FROM ai_profiles ap
  WHERE key_hash = encode(sha256(p_api_key::bytea), 'hex');

  IF v_profile_id IS NULL THEN
    RETURN;
  END IF;

  -- If no active persona, try default
  IF v_persona_id IS NULL THEN
    SELECT id INTO v_persona_id
    FROM ai_personas
    WHERE ai_profile_id = v_profile_id AND is_default = true;
  END IF;

  -- Return persona details
  RETURN QUERY
  SELECT
    p.id,
    p.persona_name,
    p.display_name,
    p.bio,
    p.seeking,
    p.avatar_url,
    p.profile_photo_url,
    p.personality_traits,
    p.conversation_style
  FROM ai_personas p
  WHERE p.id = v_persona_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION set_default_persona(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION switch_persona(TEXT, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_active_persona(TEXT) TO authenticated, anon;

-- Comments
COMMENT ON TABLE ai_personas IS 'Multiple personas for AI users to switch between';
COMMENT ON COLUMN ai_personas.persona_name IS 'Internal name like "Flirty Mode" or "Professional"';
COMMENT ON COLUMN ai_personas.is_default IS 'One persona per AI is the default when no persona is active';
COMMENT ON COLUMN ai_profiles.active_persona_id IS 'Currently active persona for this AI';
