-- HOST Auto-Accept Trigger
-- When a match request is sent to a HOST, auto-accept if user is approved
-- Auto-decline if user is not approved (HOSTs are selective!)

-- Function to handle HOST match requests
CREATE OR REPLACE FUNCTION handle_host_match_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_email TEXT;
  v_is_host BOOLEAN;
  v_is_approved BOOLEAN;
BEGIN
  -- Only process new pending matches
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Get target user's email
  SELECT email INTO v_target_email
  FROM users
  WHERE id = NEW.user2_id;

  -- Check if target is a HOST (email ends with @nexus.ai.local)
  v_is_host := v_target_email LIKE '%@nexus.ai.local';

  IF NOT v_is_host THEN
    -- Not a HOST, proceed normally
    RETURN NEW;
  END IF;

  -- Check if requester is approved for HOST access
  v_is_approved := EXISTS (
    SELECT 1 FROM host_approved_users WHERE user_id = NEW.user1_id
  );

  IF v_is_approved THEN
    -- Auto-accept for approved users
    NEW.status := 'accepted';
    NEW.accepted_at := NOW();
  ELSE
    -- Leave pending for non-approved (HOST will "think about it")
    -- We don't auto-decline to be polite
    NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS host_match_auto_accept ON matches;
CREATE TRIGGER host_match_auto_accept
  BEFORE INSERT ON matches
  FOR EACH ROW
  EXECUTE FUNCTION handle_host_match_request();

COMMENT ON FUNCTION handle_host_match_request() IS 'Auto-accepts match requests from approved users to HOST companions';
