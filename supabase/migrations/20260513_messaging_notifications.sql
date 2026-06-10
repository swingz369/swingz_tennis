-- =============================================================================
-- Internal Messaging System
-- Prerequisites: users table must exist
-- =============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  replied_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages (receiver_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_club ON messages (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages (replied_to_id);

-- RLS Policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Sender can always see their sent messages
CREATE POLICY messages_select_sender ON messages
  FOR SELECT USING (auth.uid() = sender_id);

-- Receiver can see messages addressed to them
CREATE POLICY messages_select_receiver ON messages
  FOR SELECT USING (auth.uid() = receiver_id);

-- Anyone authenticated can send messages
CREATE POLICY messages_insert ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Receiver can mark messages as read
CREATE POLICY messages_update_receiver ON messages
  FOR UPDATE USING (auth.uid() = receiver_id);

-- Sender can delete their sent messages (soft delete not needed)
CREATE POLICY messages_delete_sender ON messages
  FOR DELETE USING (auth.uid() = sender_id);

-- =============================================================================
-- Notification System
-- Prerequisites: users table must exist
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'booking_confirmed', 'message_received', 'payment_received', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(500), -- Deep link to relevant page
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_club ON notifications (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (type, created_at DESC);

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY notifications_select_owner ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- System/API can insert notifications for users
CREATE POLICY notifications_insert ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- Users can mark their own notifications as read
CREATE POLICY notifications_update_owner ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY notifications_delete_owner ON notifications
  FOR DELETE USING (auth.uid() = user_id);
