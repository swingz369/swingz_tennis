-- Migration: Add broadcast support to messages table
-- Adds broadcast_type column to distinguish individual vs broadcast messages
-- and enables cross-club messaging within the same club.

-- Add broadcast_type column
ALTER TABLE messages ADD COLUMN IF NOT EXISTS broadcast_type TEXT
  CHECK (broadcast_type IN ('all', 'trainers', 'members') OR broadcast_type IS NULL);

-- Add index for broadcast queries
CREATE INDEX IF NOT EXISTS idx_messages_broadcast_type ON messages(broadcast_type) WHERE broadcast_type IS NOT NULL;

-- Add index for receiver inbox queries (performance)
CREATE INDEX IF NOT EXISTS idx_messages_receiver_created ON messages(receiver_id, created_at DESC);

-- Add index for sender sent queries
CREATE INDEX IF NOT EXISTS idx_messages_sender_created ON messages(sender_id, created_at DESC);
