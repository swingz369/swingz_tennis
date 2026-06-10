-- SWINGZ Phase 2-5 RLS Policies
-- Adds Row Level Security to tables created in 20260513_phase25_tables.sql
-- that don't yet have RLS enabled.

-- ============================================================
-- Email Campaigns RLS
-- ============================================================
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- email_campaigns: Admins can manage, members cannot access
CREATE POLICY "Admins can view email campaigns" ON email_campaigns FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can create email campaigns" ON email_campaigns FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can update email campaigns" ON email_campaigns FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can delete email campaigns" ON email_campaigns FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- email_queue: Admins can view and manage
CREATE POLICY "Admins can view email queue" ON email_queue FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can insert into email queue" ON email_queue FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can update email queue" ON email_queue FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- ============================================================
-- Shop RLS
-- ============================================================
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;

-- shop_products: Everyone can view active products, admins manage
CREATE POLICY "Everyone can view active shop products" ON shop_products FOR SELECT USING (
  is_active = true OR
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can insert shop products" ON shop_products FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can update shop products" ON shop_products FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can delete shop products" ON shop_products FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- shop_orders: Users see own orders, admins see all
CREATE POLICY "Users can view own orders" ON shop_orders FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Users can create orders" ON shop_orders FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
CREATE POLICY "Admins can update orders" ON shop_orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- ============================================================
-- Gamification RLS
-- ============================================================
ALTER TABLE gamification_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_badges ENABLE ROW LEVEL SECURITY;

-- gamification_points: Everyone can view leaderboard, only admins/system can modify
CREATE POLICY "Everyone can view gamification points" ON gamification_points FOR SELECT USING (true);
CREATE POLICY "Admins can insert gamification points" ON gamification_points FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can update gamification points" ON gamification_points FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- gamification_badges: Everyone can view, only admins/system can insert
CREATE POLICY "Everyone can view badges" ON gamification_badges FOR SELECT USING (true);
CREATE POLICY "Admins can insert badges" ON gamification_badges FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- ============================================================
-- QR Check-ins RLS
-- ============================================================
ALTER TABLE qr_checkins ENABLE ROW LEVEL SECURITY;

-- Users can view their own check-ins, trainers see session check-ins, admins see all
CREATE POLICY "Users can view own check-ins" ON qr_checkins FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('trainer', 'admin', 'superadmin'))
);
CREATE POLICY "Users can check in" ON qr_checkins FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
CREATE POLICY "Admins can manage check-ins" ON qr_checkins FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can delete check-ins" ON qr_checkins FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- ============================================================
-- Coupons RLS
-- ============================================================
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Anyone can validate a coupon by code, admins can manage
CREATE POLICY "Anyone can validate coupons" ON coupons FOR SELECT USING (
  is_active = true OR
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can create coupons" ON coupons FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can update coupons" ON coupons FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can delete coupons" ON coupons FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- ============================================================
-- Family Accounts RLS
-- ============================================================
ALTER TABLE family_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;

-- family_accounts: Users see their own family group, admins see all
CREATE POLICY "Users can view own family group" ON family_accounts FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')) OR
  family_group_id IN (SELECT fa.family_group_id FROM family_accounts fa WHERE fa.user_id = auth.uid())
);
CREATE POLICY "Admins can manage family accounts" ON family_accounts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can update family accounts" ON family_accounts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- family_invites: Users see own invites, admins see all
CREATE POLICY "Users can view own invites" ON family_invites FOR SELECT USING (
  created_by = auth.uid() OR
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Users can create invites" ON family_invites FOR INSERT WITH CHECK (
  created_by = auth.uid()
);
CREATE POLICY "Admins can update invites" ON family_invites FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);
