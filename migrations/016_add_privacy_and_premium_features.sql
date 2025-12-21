-- Migration: Add privacy controls, premium features, and blocking system
-- Safe to run multiple times - checks if columns/tables exist first

-- =====================================================
-- 1. ADD NEW USER COLUMNS FOR PRIVACY & PREMIUM
-- =====================================================

-- Add gender column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'gender'
  ) THEN
    ALTER TABLE users ADD COLUMN gender TEXT;
    COMMENT ON COLUMN users.gender IS 'User gender: male, female, non-binary, other, prefer_not_to_say';
  END IF;
END $$;

-- Add show_gender column (privacy toggle for gender display)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'show_gender'
  ) THEN
    ALTER TABLE users ADD COLUMN show_gender BOOLEAN DEFAULT true;
    COMMENT ON COLUMN users.show_gender IS 'Whether to show gender on public profile';
  END IF;
END $$;

-- Add messaging_preference column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'messaging_preference'
  ) THEN
    ALTER TABLE users ADD COLUMN messaging_preference TEXT DEFAULT 'connections_only';
    COMMENT ON COLUMN users.messaging_preference IS 'Who can message: connections_only (default), allow_requests, open';
  END IF;
END $$;

-- Add show_in_explore column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'show_in_explore'
  ) THEN
    ALTER TABLE users ADD COLUMN show_in_explore BOOLEAN DEFAULT true;
    COMMENT ON COLUMN users.show_in_explore IS 'Whether to show profile in Explore/browse';
  END IF;
END $$;

-- Add incognito_mode column (premium feature)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'incognito_mode'
  ) THEN
    ALTER TABLE users ADD COLUMN incognito_mode BOOLEAN DEFAULT false;
    COMMENT ON COLUMN users.incognito_mode IS 'Premium: Browse without appearing in profile views';
  END IF;
END $$;

-- Add subscription tier columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
    ALTER TABLE users ADD COLUMN subscription_expires_at TIMESTAMPTZ;
    COMMENT ON COLUMN users.subscription_tier IS 'Subscription: free, premium, vip';
    COMMENT ON COLUMN users.subscription_expires_at IS 'When subscription expires (NULL for free tier)';
  END IF;
END $$;

-- Add daily request limits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'daily_requests_remaining'
  ) THEN
    ALTER TABLE users ADD COLUMN daily_requests_remaining INTEGER DEFAULT 5;
    ALTER TABLE users ADD COLUMN daily_requests_reset_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN users.daily_requests_remaining IS 'Connection requests remaining today (free tier: 5/day)';
    COMMENT ON COLUMN users.daily_requests_reset_at IS 'When daily limit resets (midnight UTC)';
  END IF;
END $$;

-- Add women_message_first preference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'women_message_first'
  ) THEN
    ALTER TABLE users ADD COLUMN women_message_first BOOLEAN DEFAULT false;
    COMMENT ON COLUMN users.women_message_first IS 'For female users: require them to send first message after match';
  END IF;
END $$;

-- =====================================================
-- 2. CREATE USER_BLOCKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Add constraint to prevent self-blocking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_blocks_no_self_block'
  ) THEN
    ALTER TABLE user_blocks ADD CONSTRAINT user_blocks_no_self_block
      CHECK (blocker_id <> blocked_id);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

-- RLS for user_blocks
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_blocks_select ON user_blocks;
CREATE POLICY user_blocks_select ON user_blocks
  FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS user_blocks_insert ON user_blocks;
CREATE POLICY user_blocks_insert ON user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS user_blocks_delete ON user_blocks;
CREATE POLICY user_blocks_delete ON user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);

COMMENT ON TABLE user_blocks IS 'Tracks blocked users. Blocked users cannot message, connect, or see blocker profile.';

-- =====================================================
-- 3. CREATE MESSAGE_REQUESTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS message_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preview_text TEXT, -- First 100 chars shown before accepting
  status TEXT DEFAULT 'pending', -- pending, accepted, declined
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT message_requests_no_self CHECK (sender_id <> recipient_id),
  CONSTRAINT message_requests_unique UNIQUE (sender_id, recipient_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_message_requests_sender ON message_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_requests_recipient ON message_requests(recipient_id);
CREATE INDEX IF NOT EXISTS idx_message_requests_status ON message_requests(status);

-- RLS for message_requests
ALTER TABLE message_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_requests_select ON message_requests;
CREATE POLICY message_requests_select ON message_requests
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS message_requests_insert ON message_requests;
CREATE POLICY message_requests_insert ON message_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS message_requests_update ON message_requests;
CREATE POLICY message_requests_update ON message_requests
  FOR UPDATE USING (auth.uid() = recipient_id);

COMMENT ON TABLE message_requests IS 'Message requests from non-connected users. Recipient must approve before messages flow.';

-- =====================================================
-- 4. CREATE PROFILE_VIEWS TABLE (Premium Feature)
-- =====================================================

CREATE TABLE IF NOT EXISTS profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  is_incognito BOOLEAN DEFAULT false,
  CONSTRAINT profile_views_no_self CHECK (viewer_id <> viewed_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer ON profile_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed ON profile_views(viewed_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_time ON profile_views(viewed_at DESC);

-- RLS for profile_views
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_views_select ON profile_views;
CREATE POLICY profile_views_select ON profile_views
  FOR SELECT USING (
    auth.uid() = viewer_id
    OR (auth.uid() = viewed_id AND is_incognito = false)
  );

DROP POLICY IF EXISTS profile_views_insert ON profile_views;
CREATE POLICY profile_views_insert ON profile_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

COMMENT ON TABLE profile_views IS 'Tracks who viewed whose profile. Premium users can see who viewed them.';

-- =====================================================
-- 5. ADD MATCH EXPIRATION FOR WOMEN-FIRST MESSAGING
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE matches ADD COLUMN expires_at TIMESTAMPTZ;
    ALTER TABLE matches ADD COLUMN first_message_sent BOOLEAN DEFAULT false;
    COMMENT ON COLUMN matches.expires_at IS 'When match expires if no first message (women-first mode)';
    COMMENT ON COLUMN matches.first_message_sent IS 'Whether first message has been sent after match';
  END IF;
END $$;

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function to check if user A is blocked by user B
CREATE OR REPLACE FUNCTION is_blocked(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = user_b AND blocked_id = user_a)
       OR (blocker_id = user_a AND blocked_id = user_b)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if two users are connected (match accepted)
CREATE OR REPLACE FUNCTION are_connected(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM matches
    WHERE ((user1_id = user_a AND user2_id = user_b)
        OR (user1_id = user_b AND user2_id = user_a))
      AND status = 'accepted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can message another
CREATE OR REPLACE FUNCTION can_message(sender UUID, recipient UUID)
RETURNS BOOLEAN AS $$
DECLARE
  recipient_pref TEXT;
  is_connected BOOLEAN;
  is_blocked BOOLEAN;
  has_request BOOLEAN;
BEGIN
  -- Can't message yourself
  IF sender = recipient THEN
    RETURN false;
  END IF;

  -- Check if blocked
  SELECT EXISTS (
    SELECT 1 FROM user_blocks
    WHERE blocker_id = recipient AND blocked_id = sender
  ) INTO is_blocked;

  IF is_blocked THEN
    RETURN false;
  END IF;

  -- Check messaging preference
  SELECT messaging_preference INTO recipient_pref
  FROM users WHERE id = recipient;

  -- If open messaging, allow
  IF recipient_pref = 'open' THEN
    RETURN true;
  END IF;

  -- Check if connected
  SELECT EXISTS (
    SELECT 1 FROM matches
    WHERE ((user1_id = sender AND user2_id = recipient)
        OR (user1_id = recipient AND user2_id = sender))
      AND status = 'accepted'
  ) INTO is_connected;

  IF is_connected THEN
    RETURN true;
  END IF;

  -- If connections_only, must be connected
  IF recipient_pref = 'connections_only' THEN
    RETURN false;
  END IF;

  -- If allow_requests, check for approved request
  IF recipient_pref = 'allow_requests' THEN
    SELECT EXISTS (
      SELECT 1 FROM message_requests
      WHERE sender_id = sender
        AND recipient_id = recipient
        AND status = 'accepted'
    ) INTO has_request;
    RETURN has_request;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset daily limits (call via cron or check on request)
CREATE OR REPLACE FUNCTION reset_daily_limits_if_needed(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  current_remaining INTEGER;
  reset_time TIMESTAMPTZ;
  user_tier TEXT;
BEGIN
  SELECT daily_requests_remaining, daily_requests_reset_at, subscription_tier
  INTO current_remaining, reset_time, user_tier
  FROM users WHERE id = user_uuid;

  -- If reset time has passed, reset the counter
  IF reset_time < NOW() THEN
    -- Premium/VIP get unlimited (represented as 999)
    IF user_tier IN ('premium', 'vip') THEN
      UPDATE users
      SET daily_requests_remaining = 999,
          daily_requests_reset_at = NOW() + INTERVAL '1 day'
      WHERE id = user_uuid
      RETURNING daily_requests_remaining INTO current_remaining;
    ELSE
      -- Free tier gets 5 per day
      UPDATE users
      SET daily_requests_remaining = 5,
          daily_requests_reset_at = NOW() + INTERVAL '1 day'
      WHERE id = user_uuid
      RETURNING daily_requests_remaining INTO current_remaining;
    END IF;
  END IF;

  RETURN current_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. UPDATE EXISTING USERS WITH DEFAULTS
-- =====================================================

UPDATE users SET messaging_preference = 'connections_only' WHERE messaging_preference IS NULL;
UPDATE users SET show_in_explore = true WHERE show_in_explore IS NULL;
UPDATE users SET incognito_mode = false WHERE incognito_mode IS NULL;
UPDATE users SET subscription_tier = 'free' WHERE subscription_tier IS NULL;
UPDATE users SET daily_requests_remaining = 5 WHERE daily_requests_remaining IS NULL;
UPDATE users SET daily_requests_reset_at = NOW() WHERE daily_requests_reset_at IS NULL;

COMMENT ON COLUMN users.gender IS 'User gender for matching preferences';
