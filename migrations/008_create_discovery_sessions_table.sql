-- NEXUS Discovery Sessions Table
-- Saves voice interview transcripts and AI analysis
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS discovery_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transcript JSONB DEFAULT '[]'::jsonb, -- Array of {question, answer, timestamp}
  ai_analysis JSONB DEFAULT '{}'::jsonb, -- Detected patterns, suggested tags
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_user ON discovery_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_created ON discovery_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_completed ON discovery_sessions(completed);

-- Enable Row Level Security
ALTER TABLE discovery_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only view their own discovery sessions
CREATE POLICY "Users can view own sessions" ON discovery_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own sessions
CREATE POLICY "Users can create own sessions" ON discovery_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions" ON discovery_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete own sessions" ON discovery_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to mark session as completed
CREATE OR REPLACE FUNCTION complete_discovery_session(session_id_param UUID)
RETURNS VOID AS $$
  UPDATE discovery_sessions
  SET completed = true,
      completed_at = NOW()
  WHERE id = session_id_param
  AND user_id = auth.uid();
$$ LANGUAGE SQL;

-- Function to add to transcript
CREATE OR REPLACE FUNCTION add_to_transcript(
  session_id_param UUID,
  question_text TEXT,
  answer_text TEXT
)
RETURNS VOID AS $$
  UPDATE discovery_sessions
  SET transcript = transcript || jsonb_build_array(
    jsonb_build_object(
      'question', question_text,
      'answer', answer_text,
      'timestamp', NOW()
    )
  )
  WHERE id = session_id_param
  AND user_id = auth.uid();
$$ LANGUAGE SQL;

COMMENT ON TABLE discovery_sessions IS 'Stores discovery interview transcripts and AI analysis for profile building';
COMMENT ON COLUMN discovery_sessions.transcript IS 'JSON array of Q&A pairs with timestamps';
COMMENT ON COLUMN discovery_sessions.ai_analysis IS 'JSON object with detected patterns and tag suggestions';
