-- Email Requests Table
-- Stores user requests for @discovernexus.app email addresses
-- Run this in Supabase SQL Editor (EZTUNES database)

CREATE TABLE IF NOT EXISTS email_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_email TEXT NOT NULL,
  forward_to TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active')),
  user_id UUID REFERENCES users(id),
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_email_requests_status ON email_requests(status);
CREATE INDEX IF NOT EXISTS idx_email_requests_email ON email_requests(requested_email);

-- Enable RLS
ALTER TABLE email_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (submit request)
CREATE POLICY "Anyone can submit email request" ON email_requests
  FOR INSERT
  WITH CHECK (true);

-- Users can view their own requests
CREATE POLICY "Users can view own requests" ON email_requests
  FOR SELECT
  USING (true);

COMMENT ON TABLE email_requests IS 'User requests for @discovernexus.app email addresses';
COMMENT ON COLUMN email_requests.status IS 'pending=awaiting approval, approved=will be set up, rejected=denied, active=email is live';
