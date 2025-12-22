-- HOST Approved Users
-- Controls who HOSTs will accept matches from
-- Admin-managed whitelist for testing and VIP access

CREATE TABLE IF NOT EXISTS host_approved_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approved_by TEXT DEFAULT 'system', -- admin email or 'system'
  notes TEXT, -- 'tester', 'VIP', 'staff', etc.
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_host_approved_users ON host_approved_users(user_id);

-- Enable RLS
ALTER TABLE host_approved_users ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage
CREATE POLICY "Host approved users service access" ON host_approved_users
  FOR ALL USING (true) WITH CHECK (true);

-- Function to check if user is approved for HOST chat
CREATE OR REPLACE FUNCTION is_host_approved(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM host_approved_users WHERE user_id = p_user_id
  );
END;
$$;

-- Function to approve a user (by email)
CREATE OR REPLACE FUNCTION approve_user_for_hosts(p_email TEXT, p_approved_by TEXT DEFAULT 'admin', p_notes TEXT DEFAULT 'tester')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO v_user_id FROM users WHERE email = p_email;

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Insert or update approval
  INSERT INTO host_approved_users (user_id, approved_by, notes)
  VALUES (v_user_id, p_approved_by, p_notes)
  ON CONFLICT (user_id) DO UPDATE SET
    approved_by = EXCLUDED.approved_by,
    notes = EXCLUDED.notes,
    approved_at = NOW();

  RETURN true;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION is_host_approved(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION approve_user_for_hosts(TEXT, TEXT, TEXT) TO authenticated, anon;

COMMENT ON TABLE host_approved_users IS 'Whitelist of users who can match with HOST companions';
