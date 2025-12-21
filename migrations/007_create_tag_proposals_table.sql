-- NEXUS Tag Proposals Table
-- Community-driven tag creation system
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS tag_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  proposed_definition TEXT NOT NULL,
  proposed_examples TEXT[] DEFAULT ARRAY[]::TEXT[],
  category TEXT,
  votes INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES users(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tag_proposals_status ON tag_proposals(status);
CREATE INDEX IF NOT EXISTS idx_tag_proposals_created ON tag_proposals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tag_proposals_votes ON tag_proposals(votes DESC);
CREATE INDEX IF NOT EXISTS idx_tag_proposals_proposer ON tag_proposals(proposed_by);

-- Enable Row Level Security
ALTER TABLE tag_proposals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can view approved or pending proposals
CREATE POLICY "Anyone can view proposals" ON tag_proposals
  FOR SELECT
  USING (true);

-- Authenticated users can submit proposals
CREATE POLICY "Authenticated users can submit proposals" ON tag_proposals
  FOR INSERT
  WITH CHECK (auth.uid() = proposed_by);

-- Users can update their own pending proposals
CREATE POLICY "Users can update own pending proposals" ON tag_proposals
  FOR UPDATE
  USING (auth.uid() = proposed_by AND status = 'pending');

-- Users can delete their own pending proposals
CREATE POLICY "Users can delete own pending proposals" ON tag_proposals
  FOR DELETE
  USING (auth.uid() = proposed_by AND status = 'pending');

-- Function to vote on a proposal (simple implementation)
CREATE OR REPLACE FUNCTION vote_on_proposal(proposal_id_param UUID, vote_value INT)
RETURNS VOID AS $$
  UPDATE tag_proposals
  SET votes = votes + vote_value
  WHERE id = proposal_id_param;
$$ LANGUAGE SQL;

-- Function to approve a proposal and create tag (admin function)
CREATE OR REPLACE FUNCTION approve_tag_proposal(
  proposal_id_param UUID,
  admin_notes_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  proposal_record RECORD;
  new_tag_id UUID;
BEGIN
  -- Get proposal details
  SELECT * INTO proposal_record FROM tag_proposals WHERE id = proposal_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  -- Create new tag
  INSERT INTO tags (tag_name, version, definition, examples, category, created_by, is_current)
  VALUES (
    proposal_record.tag_name,
    'v1.0',
    proposal_record.proposed_definition,
    proposal_record.proposed_examples,
    proposal_record.category,
    proposal_record.proposed_by,
    true
  )
  RETURNING id INTO new_tag_id;

  -- Update proposal status
  UPDATE tag_proposals
  SET status = 'approved',
      reviewed_at = NOW(),
      reviewed_by = auth.uid(),
      admin_notes = admin_notes_param
  WHERE id = proposal_id_param;

  RETURN new_tag_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE tag_proposals IS 'Community proposals for new connection pattern tags';
COMMENT ON COLUMN tag_proposals.votes IS 'Number of upvotes (can be negative)';
