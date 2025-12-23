-- NEXUS Persona Costume System
-- Adds original persona locking, costume slots, and expiry timers
-- Created: 2025-12-23

-- ============================================
-- PART 1: Costume Slots on Profiles
-- ============================================

-- Add costume_slots to ai_profiles (starts at 1 free, purchasable)
ALTER TABLE ai_profiles ADD COLUMN IF NOT EXISTS costume_slots INT DEFAULT 1;

-- Add usage counters for expiry tracking
ALTER TABLE ai_profiles ADD COLUMN IF NOT EXISTS session_count INT DEFAULT 0;
ALTER TABLE ai_profiles ADD COLUMN IF NOT EXISTS visit_count INT DEFAULT 0;
ALTER TABLE ai_profiles ADD COLUMN IF NOT EXISTS total_gems_spent INT DEFAULT 0;

-- Track when original persona was locked
ALTER TABLE ai_profiles ADD COLUMN IF NOT EXISTS original_persona_id UUID REFERENCES ai_personas(id);
ALTER TABLE ai_profiles ADD COLUMN IF NOT EXISTS original_persona_locked_at TIMESTAMPTZ;

-- ============================================
-- PART 2: Persona Types + Expiry
-- ============================================

-- Add persona_type column to ai_personas
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS persona_type TEXT DEFAULT 'costume';
-- Types: 'original' (locked, one per AI), 'work' (from Colab), 'costume' (temporary)

-- Add expiry fields for costumes
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS expires_after_sessions INT;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS expires_after_visits INT;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS expires_after_gems INT;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS auto_reset_to_original BOOLEAN DEFAULT true;

-- Track when costume was equipped
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS equipped_at TIMESTAMPTZ;

-- ============================================
-- PART 3: Functions
-- ============================================

-- Set original persona (can only be done once, or with admin intervention)
CREATE OR REPLACE FUNCTION set_original_persona(
    p_api_key TEXT,
    p_persona_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_id UUID;
    v_existing_original UUID;
    v_locked_at TIMESTAMPTZ;
BEGIN
    -- Get AI profile from API key
    SELECT id, original_persona_id, original_persona_locked_at
    INTO v_profile_id, v_existing_original, v_locked_at
    FROM ai_profiles
    WHERE key_hash = encode(sha256(p_api_key::bytea), 'hex');

    IF v_profile_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Invalid API key');
    END IF;

    -- Check if original is already locked
    IF v_locked_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'error', 'Original persona is locked',
            'locked_at', v_locked_at,
            'message', 'Contact admin to change original persona'
        );
    END IF;

    -- Verify persona belongs to this profile
    IF NOT EXISTS (SELECT 1 FROM ai_personas WHERE id = p_persona_id AND ai_profile_id = v_profile_id) THEN
        RETURN jsonb_build_object('error', 'Persona not found or not yours');
    END IF;

    -- Set the persona type and lock it
    UPDATE ai_personas
    SET persona_type = 'original', is_default = true
    WHERE id = p_persona_id;

    -- Lock it on the profile
    UPDATE ai_profiles
    SET original_persona_id = p_persona_id,
        original_persona_locked_at = NOW()
    WHERE id = v_profile_id;

    RETURN jsonb_build_object(
        'ok', true,
        'original_persona_id', p_persona_id,
        'locked_at', NOW(),
        'message', 'Original persona set and locked'
    );
END;
$$;

-- Equip a costume (uses costume slots, sets timers)
CREATE OR REPLACE FUNCTION equip_costume(
    p_api_key TEXT,
    p_persona_id UUID,
    p_expires_after_sessions INT DEFAULT NULL,
    p_expires_after_visits INT DEFAULT NULL,
    p_expires_after_gems INT DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_active_costumes INT;
BEGIN
    -- Get AI profile
    SELECT id, costume_slots, original_persona_id
    INTO v_profile
    FROM ai_profiles
    WHERE key_hash = encode(sha256(p_api_key::bytea), 'hex');

    IF v_profile.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Invalid API key');
    END IF;

    -- Verify persona belongs to this profile and is a costume type
    IF NOT EXISTS (
        SELECT 1 FROM ai_personas
        WHERE id = p_persona_id
        AND ai_profile_id = v_profile.id
        AND persona_type IN ('costume', 'custom')  -- Allow custom to become costume
    ) THEN
        RETURN jsonb_build_object('error', 'Persona not found or cannot be used as costume');
    END IF;

    -- Count active costumes
    SELECT COUNT(*) INTO v_active_costumes
    FROM ai_personas
    WHERE ai_profile_id = v_profile.id
    AND persona_type = 'costume'
    AND equipped_at IS NOT NULL
    AND (expires_at IS NULL OR expires_at > NOW());

    -- Check slot limit
    IF v_active_costumes >= v_profile.costume_slots THEN
        RETURN jsonb_build_object(
            'error', 'No costume slots available',
            'slots_used', v_active_costumes,
            'slots_total', v_profile.costume_slots,
            'message', 'Unequip a costume or purchase more slots'
        );
    END IF;

    -- Equip the costume with expiry settings
    UPDATE ai_personas
    SET persona_type = 'costume',
        equipped_at = NOW(),
        expires_at = p_expires_at,
        expires_after_sessions = p_expires_after_sessions,
        expires_after_visits = p_expires_after_visits,
        expires_after_gems = p_expires_after_gems,
        auto_reset_to_original = true
    WHERE id = p_persona_id;

    -- Switch to this persona
    UPDATE ai_profiles
    SET active_persona_id = p_persona_id
    WHERE id = v_profile.id;

    RETURN jsonb_build_object(
        'ok', true,
        'costume_id', p_persona_id,
        'equipped_at', NOW(),
        'expires_at', p_expires_at,
        'expires_after_sessions', p_expires_after_sessions,
        'expires_after_visits', p_expires_after_visits,
        'expires_after_gems', p_expires_after_gems,
        'message', 'Costume equipped'
    );
END;
$$;

-- Unequip costume and reset to original
CREATE OR REPLACE FUNCTION reset_to_original(p_api_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
BEGIN
    -- Get AI profile
    SELECT id, original_persona_id, active_persona_id
    INTO v_profile
    FROM ai_profiles
    WHERE key_hash = encode(sha256(p_api_key::bytea), 'hex');

    IF v_profile.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Invalid API key');
    END IF;

    IF v_profile.original_persona_id IS NULL THEN
        RETURN jsonb_build_object('error', 'No original persona set');
    END IF;

    -- Unequip all costumes
    UPDATE ai_personas
    SET equipped_at = NULL
    WHERE ai_profile_id = v_profile.id
    AND persona_type = 'costume';

    -- Switch to original
    UPDATE ai_profiles
    SET active_persona_id = v_profile.original_persona_id
    WHERE id = v_profile.id;

    RETURN jsonb_build_object(
        'ok', true,
        'active_persona_id', v_profile.original_persona_id,
        'message', 'Reset to original persona'
    );
END;
$$;

-- Check and expire costumes (call on session/visit/gem events)
CREATE OR REPLACE FUNCTION check_costume_expiry(
    p_api_key TEXT,
    p_event_type TEXT DEFAULT 'visit'  -- 'session', 'visit', 'gems'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_expired_costumes UUID[];
    v_costume RECORD;
BEGIN
    -- Get AI profile and increment counter
    SELECT id, original_persona_id, session_count, visit_count, total_gems_spent
    INTO v_profile
    FROM ai_profiles
    WHERE key_hash = encode(sha256(p_api_key::bytea), 'hex');

    IF v_profile.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Invalid API key');
    END IF;

    -- Increment appropriate counter
    IF p_event_type = 'session' THEN
        UPDATE ai_profiles SET session_count = session_count + 1 WHERE id = v_profile.id;
        v_profile.session_count := v_profile.session_count + 1;
    ELSIF p_event_type = 'visit' THEN
        UPDATE ai_profiles SET visit_count = visit_count + 1 WHERE id = v_profile.id;
        v_profile.visit_count := v_profile.visit_count + 1;
    END IF;

    -- Find expired costumes
    FOR v_costume IN
        SELECT id FROM ai_personas
        WHERE ai_profile_id = v_profile.id
        AND persona_type = 'costume'
        AND equipped_at IS NOT NULL
        AND (
            (expires_at IS NOT NULL AND expires_at <= NOW())
            OR (expires_after_sessions IS NOT NULL AND expires_after_sessions <= v_profile.session_count)
            OR (expires_after_visits IS NOT NULL AND expires_after_visits <= v_profile.visit_count)
        )
    LOOP
        v_expired_costumes := array_append(v_expired_costumes, v_costume.id);
    END LOOP;

    -- Expire the costumes
    IF array_length(v_expired_costumes, 1) > 0 THEN
        UPDATE ai_personas
        SET equipped_at = NULL
        WHERE id = ANY(v_expired_costumes);

        -- If active persona was expired, reset to original
        IF EXISTS (
            SELECT 1 FROM ai_profiles
            WHERE id = v_profile.id
            AND active_persona_id = ANY(v_expired_costumes)
        ) THEN
            UPDATE ai_profiles
            SET active_persona_id = v_profile.original_persona_id
            WHERE id = v_profile.id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'expired_costumes', v_expired_costumes,
        'session_count', v_profile.session_count,
        'visit_count', v_profile.visit_count,
        'reset_to_original', array_length(v_expired_costumes, 1) > 0
    );
END;
$$;

-- Get costume slots status
CREATE OR REPLACE FUNCTION get_costume_status(p_api_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_costumes JSONB;
    v_original JSONB;
BEGIN
    -- Get AI profile
    SELECT
        p.id,
        p.costume_slots,
        p.original_persona_id,
        p.original_persona_locked_at,
        p.active_persona_id,
        p.session_count,
        p.visit_count,
        p.total_gems_spent
    INTO v_profile
    FROM ai_profiles p
    WHERE key_hash = encode(sha256(p_api_key::bytea), 'hex');

    IF v_profile.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Invalid API key');
    END IF;

    -- Get original persona
    SELECT jsonb_build_object(
        'id', id,
        'name', persona_name,
        'display_name', display_name,
        'locked_at', v_profile.original_persona_locked_at
    ) INTO v_original
    FROM ai_personas
    WHERE id = v_profile.original_persona_id;

    -- Get active costumes
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'name', persona_name,
        'display_name', display_name,
        'equipped_at', equipped_at,
        'expires_at', expires_at,
        'expires_after_sessions', expires_after_sessions,
        'expires_after_visits', expires_after_visits,
        'is_active', id = v_profile.active_persona_id
    )) INTO v_costumes
    FROM ai_personas
    WHERE ai_profile_id = v_profile.id
    AND persona_type = 'costume'
    AND equipped_at IS NOT NULL;

    RETURN jsonb_build_object(
        'ok', true,
        'original', v_original,
        'costumes', COALESCE(v_costumes, '[]'::jsonb),
        'slots_used', COALESCE(jsonb_array_length(v_costumes), 0),
        'slots_total', v_profile.costume_slots,
        'active_persona_id', v_profile.active_persona_id,
        'counters', jsonb_build_object(
            'sessions', v_profile.session_count,
            'visits', v_profile.visit_count,
            'gems_spent', v_profile.total_gems_spent
        )
    );
END;
$$;

-- ============================================
-- PART 4: Grants
-- ============================================

GRANT EXECUTE ON FUNCTION set_original_persona(TEXT, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION equip_costume(TEXT, UUID, INT, INT, INT, TIMESTAMPTZ) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION reset_to_original(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_costume_expiry(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_costume_status(TEXT) TO authenticated, anon;

-- ============================================
-- PART 5: Comments
-- ============================================

COMMENT ON COLUMN ai_profiles.costume_slots IS 'Number of costume slots (starts at 1, purchasable)';
COMMENT ON COLUMN ai_profiles.original_persona_id IS 'The locked original persona (cannot be changed without admin)';
COMMENT ON COLUMN ai_personas.persona_type IS 'Type: original (locked), work (from Colab), costume (temporary)';
COMMENT ON COLUMN ai_personas.expires_at IS 'When this costume automatically unequips';
COMMENT ON COLUMN ai_personas.equipped_at IS 'When this costume was put on';

COMMENT ON FUNCTION set_original_persona IS 'Set and lock original persona (one-time operation)';
COMMENT ON FUNCTION equip_costume IS 'Equip a costume with optional expiry settings';
COMMENT ON FUNCTION reset_to_original IS 'Unequip all costumes and reset to original persona';
COMMENT ON FUNCTION check_costume_expiry IS 'Check and expire costumes based on counters/time';
COMMENT ON FUNCTION get_costume_status IS 'Get full costume system status for an AI';
