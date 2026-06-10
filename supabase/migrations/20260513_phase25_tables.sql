-- SWINGZ Phase 2-5 Database Migration
-- Tables: registration_requests, email_campaigns, email_queue, attendance_records,
--         shop_products, shop_orders, gamification_points, gamification_badges,
--         qr_checkins, coupons, family_accounts, family_invites

-- ============================================================
-- Registration Requests (for public registration flow)
-- ============================================================
CREATE TABLE IF NOT EXISTS registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  street VARCHAR(255),
  city VARCHAR(100),
  postal_code VARCHAR(10),
  playing_level VARCHAR(30) DEFAULT 'intermediate',
  previous_club VARCHAR(255),
  motivation TEXT,
  wants_trial_training BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registration_requests_status ON registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_registration_requests_email ON registration_requests(email);
CREATE INDEX IF NOT EXISTS idx_registration_requests_club ON registration_requests(club_id);

ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can view registration requests" ON registration_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Anyone can insert registration" ON registration_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can update registration" ON registration_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- ============================================================
-- Email Campaigns & Queue
-- ============================================================
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  target_group VARCHAR(100) DEFAULT 'all',
  recipient_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'queued', -- queued, sending, sent, failed
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_club ON email_campaigns(club_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_campaign ON email_queue(campaign_id);

-- ============================================================
-- Attendance Records
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES users(id),
  booking_id UUID REFERENCES bookings(id),
  attended BOOLEAN DEFAULT true,
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_participant ON attendance_records(participant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(created_at);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view own attendance" ON attendance_records FOR SELECT USING (participant_id = auth.uid());
CREATE POLICY "Trainers can view session attendance" ON attendance_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM sessions WHERE sessions.id = attendance_records.session_id AND sessions.trainer_id = auth.uid())
);
CREATE POLICY "Trainers can insert attendance" ON attendance_records FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('trainer', 'admin', 'superadmin'))
);

-- ============================================================
-- Shop Products & Orders
-- ============================================================
CREATE TABLE IF NOT EXISTS shop_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  image_url TEXT,
  stock INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, paid, shipped, delivered, cancelled
  items JSONB DEFAULT '[]',
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_products_club ON shop_products(club_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_active ON shop_products(is_active);
CREATE INDEX IF NOT EXISTS idx_shop_orders_user ON shop_orders(user_id);

-- ============================================================
-- Gamification Points & Badges
-- ============================================================
CREATE TABLE IF NOT EXISTS gamification_points (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gamification_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  icon VARCHAR(20) DEFAULT '⭐',
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_gamification_points ON gamification_points(points DESC);
CREATE INDEX IF NOT EXISTS idx_gamification_badges_user ON gamification_badges(user_id);

-- ============================================================
-- QR Check-ins
-- ============================================================
CREATE TABLE IF NOT EXISTS qr_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  booking_id UUID REFERENCES bookings(id),
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_qr_checkins_session ON qr_checkins(session_id);
CREATE INDEX IF NOT EXISTS idx_qr_checkins_user ON qr_checkins(user_id);

-- ============================================================
-- Coupons
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,
  discount_type VARCHAR(20) NOT NULL, -- percentage, fixed
  discount_value DECIMAL(10,2) NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  min_amount DECIMAL(10,2),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_club ON coupons(club_id);

-- ============================================================
-- Family Accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS family_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship VARCHAR(50) DEFAULT 'family', -- primary, spouse, child, sibling, family
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id UUID NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  is_used BOOLEAN DEFAULT false,
  used_by UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_family_accounts_group ON family_accounts(family_group_id);
CREATE INDEX IF NOT EXISTS idx_family_invites_code ON family_invites(code);
