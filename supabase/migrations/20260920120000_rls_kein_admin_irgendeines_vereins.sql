-- Mandantentrennung, Teil 2: Policies der Form „Nutzer ist Admin IRGENDEINES Vereins".
--
-- Die Prüfung `EXISTS (SELECT 1 FROM user_club_memberships WHERE user_id = auth.uid()
-- AND role IN ('admin','superadmin'))` verglich den Verein nicht mit der Zeile. Ein Admin
-- von Verein A konnte über PostgREST (der anon-Key ist öffentlich, der Nutzer-Token
-- genügt) Gutscheine, Kampagnen, Warteschlange, Shop, Familienkonten, Check-ins und
-- Bestellungen von Verein B lesen und ändern. Die API-Routen maskierten das, weil sie
-- meist den Service-Client nutzen — aber die Policies sind die eigentliche Grenze.
--
-- Policy-Namen aus pg_policies der laufenden DB übernommen (AGENTS.md § Migrationen 1).

-- Trainer/Admin/Superadmin im selben Verein wie der Zielnutzer (oder Owner).
CREATE OR REPLACE FUNCTION public.is_staff_of_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_owner() OR EXISTS (
    SELECT 1
    FROM user_club_memberships a
    JOIN user_club_memberships t ON t.club_id = a.club_id
    WHERE a.user_id = auth.uid()
      AND a.is_active = true
      AND a.role IN ('trainer', 'admin', 'superadmin')
      AND t.user_id = target_user_id
      AND t.is_active = true
  );
$$;

-- ── Tabellen mit club_id ────────────────────────────────────────────────────

-- coupons: Gutscheine nur im eigenen Verein sichtbar (vorher: aktive Codes aller Vereine für jeden)
DROP POLICY IF EXISTS "Admins can create coupons" ON coupons;
DROP POLICY IF EXISTS "Admins can update coupons" ON coupons;
DROP POLICY IF EXISTS "Admins can delete coupons" ON coupons;
DROP POLICY IF EXISTS "Anyone can validate coupons" ON coupons;
CREATE POLICY coupons_insert_club_admin ON coupons FOR INSERT TO authenticated
  WITH CHECK (public.is_owner() OR public.is_club_admin(club_id));
CREATE POLICY coupons_update_club_admin ON coupons FOR UPDATE TO authenticated
  USING (public.is_owner() OR public.is_club_admin(club_id))
  WITH CHECK (public.is_owner() OR public.is_club_admin(club_id));
CREATE POLICY coupons_delete_club_admin ON coupons FOR DELETE TO authenticated
  USING (public.is_owner() OR public.is_club_admin(club_id));
CREATE POLICY coupons_select_club ON coupons FOR SELECT TO authenticated
  USING (public.is_owner() OR public.is_club_admin(club_id)
         OR (is_active = true AND public.is_club_member(club_id)));

-- email_campaigns
DROP POLICY IF EXISTS "Admins can create email campaigns" ON email_campaigns;
DROP POLICY IF EXISTS "Admins can update email campaigns" ON email_campaigns;
DROP POLICY IF EXISTS "Admins can delete email campaigns" ON email_campaigns;
DROP POLICY IF EXISTS "Admins can view email campaigns" ON email_campaigns;
CREATE POLICY email_campaigns_insert_club_admin ON email_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.is_owner() OR public.is_club_admin(club_id));
CREATE POLICY email_campaigns_update_club_admin ON email_campaigns FOR UPDATE TO authenticated
  USING (public.is_owner() OR public.is_club_admin(club_id))
  WITH CHECK (public.is_owner() OR public.is_club_admin(club_id));
CREATE POLICY email_campaigns_delete_club_admin ON email_campaigns FOR DELETE TO authenticated
  USING (public.is_owner() OR public.is_club_admin(club_id));
CREATE POLICY email_campaigns_select_club_admin ON email_campaigns FOR SELECT TO authenticated
  USING (public.is_owner() OR public.is_club_admin(club_id));

-- email_queue
DROP POLICY IF EXISTS "Admins can insert into email queue" ON email_queue;
DROP POLICY IF EXISTS "Admins can update email queue" ON email_queue;
DROP POLICY IF EXISTS "Admins can view email queue" ON email_queue;
CREATE POLICY email_queue_insert_club_admin ON email_queue FOR INSERT TO authenticated
  WITH CHECK (public.is_owner() OR public.is_club_admin(club_id));
CREATE POLICY email_queue_update_club_admin ON email_queue FOR UPDATE TO authenticated
  USING (public.is_owner() OR public.is_club_admin(club_id))
  WITH CHECK (public.is_owner() OR public.is_club_admin(club_id));
CREATE POLICY email_queue_select_club_admin ON email_queue FOR SELECT TO authenticated
  USING (public.is_owner() OR public.is_club_admin(club_id));

-- shop_products
DROP POLICY IF EXISTS "Admins can insert shop products" ON shop_products;
DROP POLICY IF EXISTS "Admins can update shop products" ON shop_products;
DROP POLICY IF EXISTS "Admins can delete shop products" ON shop_products;
DROP POLICY IF EXISTS "Everyone can view active shop products" ON shop_products;
CREATE POLICY shop_products_insert_club_admin ON shop_products FOR INSERT TO authenticated
  WITH CHECK (public.is_owner() OR public.is_club_admin(club_id));
CREATE POLICY shop_products_update_club_admin ON shop_products FOR UPDATE TO authenticated
  USING (public.is_owner() OR public.is_club_admin(club_id))
  WITH CHECK (public.is_owner() OR public.is_club_admin(club_id));
CREATE POLICY shop_products_delete_club_admin ON shop_products FOR DELETE TO authenticated
  USING (public.is_owner() OR public.is_club_admin(club_id));
CREATE POLICY shop_products_select_club ON shop_products FOR SELECT TO authenticated
  USING (public.is_owner() OR public.is_club_admin(club_id)
         OR (is_active = true AND public.is_club_member(club_id)));

-- ── Tabellen ohne club_id: Verein über den Nutzer der Zeile ─────────────────

-- family_accounts
DROP POLICY IF EXISTS "Admins can manage family accounts" ON family_accounts;
DROP POLICY IF EXISTS "Admins can update family accounts" ON family_accounts;
DROP POLICY IF EXISTS "Users can view own family group" ON family_accounts;
CREATE POLICY family_accounts_insert_club_admin ON family_accounts FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of_user(user_id));
CREATE POLICY family_accounts_update_club_admin ON family_accounts FOR UPDATE TO authenticated
  USING (public.is_admin_of_user(user_id)) WITH CHECK (public.is_admin_of_user(user_id));
CREATE POLICY family_accounts_select_own_or_admin ON family_accounts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin_of_user(user_id)
    OR family_group_id IN (SELECT fa.family_group_id FROM family_accounts fa WHERE fa.user_id = auth.uid())
  );

-- family_invites
DROP POLICY IF EXISTS "Admins can update invites" ON family_invites;
DROP POLICY IF EXISTS "Users can view own invites" ON family_invites;
CREATE POLICY family_invites_update_club_admin ON family_invites FOR UPDATE TO authenticated
  USING (public.is_admin_of_user(created_by)) WITH CHECK (public.is_admin_of_user(created_by));
CREATE POLICY family_invites_select_own_or_admin ON family_invites FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_admin_of_user(created_by));

-- qr_checkins
DROP POLICY IF EXISTS "Admins can delete check-ins" ON qr_checkins;
DROP POLICY IF EXISTS "Admins can manage check-ins" ON qr_checkins;
DROP POLICY IF EXISTS "Users can view own check-ins" ON qr_checkins;
CREATE POLICY qr_checkins_delete_club_admin ON qr_checkins FOR DELETE TO authenticated
  USING (public.is_admin_of_user(user_id));
CREATE POLICY qr_checkins_update_club_admin ON qr_checkins FOR UPDATE TO authenticated
  USING (public.is_admin_of_user(user_id)) WITH CHECK (public.is_admin_of_user(user_id));
CREATE POLICY qr_checkins_select_own_or_staff ON qr_checkins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff_of_user(user_id));

-- shop_orders
DROP POLICY IF EXISTS "Admins can update orders" ON shop_orders;
DROP POLICY IF EXISTS "Users can view own orders" ON shop_orders;
CREATE POLICY shop_orders_update_club_admin ON shop_orders FOR UPDATE TO authenticated
  USING (public.is_admin_of_user(user_id)) WITH CHECK (public.is_admin_of_user(user_id));
CREATE POLICY shop_orders_select_own_or_admin ON shop_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_of_user(user_id));

-- attendance_records: die lockere Policy machte jeden Trainer/Admin irgendeines Vereins
-- zum Schreiber (Policies verknüpft RLS mit OR). Die eigene Insert-Policy prüfte den
-- Verein der Session nicht — jetzt schon.
DROP POLICY IF EXISTS "Trainers can insert attendance" ON attendance_records;
DROP POLICY IF EXISTS attendance_records_insert ON attendance_records;
CREATE POLICY attendance_records_insert ON attendance_records FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s JOIN schedules sc ON sc.id = s.schedule_id
      WHERE s.id = attendance_records.session_id
        AND (
          public.is_club_admin(sc.club_id)
          OR (public.is_club_member(sc.club_id)
              AND EXISTS (SELECT 1 FROM trainers t
                          WHERE t.id = attendance_records.trainer_id AND t.user_id = auth.uid()))
        )
    )
  );
