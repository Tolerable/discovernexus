-- NEXUS Messages Table
-- Messaging system for connected users
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL, -- Links messages in same thread
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'voice', 'system')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID[] DEFAULT ARRAY[]::UUID[], -- Array of user IDs who deleted this message
  CHECK (sender_id <> recipient_id) -- Can't message yourself
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent ON messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read_at) WHERE read_at IS NULL;

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view messages they sent or received (unless they deleted them)
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT
  USING (
    (auth.uid() = sender_id OR auth.uid() = recipient_id)
    AND NOT (auth.uid() = ANY(deleted_by))
  );

-- Users can send messages
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Users can update their own messages (to mark as read)
CREATE POLICY "Users can update messages" ON messages
  FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Users can delete messages (soft delete by adding to deleted_by array)
CREATE POLICY "Users can delete messages" ON messages
  FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Function to get conversation between two users
CREATE OR REPLACE FUNCTION get_conversation(user_a UUID, user_b UUID)
RETURNS SETOF messages AS $$
  SELECT * FROM messages
  WHERE conversation_id IN (
    SELECT DISTINCT conversation_id FROM messages
    WHERE (sender_id = user_a AND recipient_id = user_b)
       OR (sender_id = user_b AND recipient_id = user_a)
  )
  AND NOT (auth.uid() = ANY(deleted_by))
  ORDER BY sent_at ASC;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_count(user_id_param UUID)
RETURNS BIGINT AS $$
  SELECT COUNT(*) FROM messages
  WHERE recipient_id = user_id_param
  AND read_at IS NULL
  AND NOT (user_id_param = ANY(deleted_by));
$$ LANGUAGE SQL STABLE;

-- Function to mark message as read
CREATE OR REPLACE FUNCTION mark_message_read(message_id_param UUID)
RETURNS VOID AS $$
  UPDATE messages
  SET read_at = NOW()
  WHERE id = message_id_param
  AND read_at IS NULL
  AND recipient_id = auth.uid();
$$ LANGUAGE SQL;

-- Function to mark conversation as read
CREATE OR REPLACE FUNCTION mark_conversation_read(conversation_id_param UUID)
RETURNS VOID AS $$
  UPDATE messages
  SET read_at = NOW()
  WHERE conversation_id = conversation_id_param
  AND read_at IS NULL
  AND recipient_id = auth.uid();
$$ LANGUAGE SQL;

COMMENT ON TABLE messages IS 'Direct messages between matched users';
COMMENT ON COLUMN messages.conversation_id IS 'UUID linking all messages in a conversation thread';
COMMENT ON COLUMN messages.deleted_by IS 'Array of user IDs who have deleted this message from their view';
