-- Rechteausweitung über PostgREST schließen (05.10.2026)
--
-- 1. user_club_memberships: Die Policy "user_club_memberships_access_own" (ALL,
--    USING user_id = auth.uid(), ohne WITH CHECK) erlaubte jedem angemeldeten
--    Nutzer, seine eigene Mitgliedschaft beliebig zu schreiben — direkt per
--    PostgREST mit dem öffentlichen Anon-Key. Lokal belegt: ein Mitglied setzt
--    die eigene Rolle auf 'admin' und legt sich eine Admin-Mitgliedschaft in
--    einem fremden Verein an (ebenso möglich: role 'owner' mit club_id NULL).
--    Lesen der eigenen Zeilen decken memberships_select / memberships_owner_select
--    ab; geschrieben wird die Tabelle nur von Admins (memberships_manage_admin,
--    memberships_owner_*) und serverseitig über den Service-Client.
DROP POLICY IF EXISTS "user_club_memberships_access_own" ON public.user_club_memberships;

-- 2. users: users_own / users_update_own lassen jeden Nutzer seine Zeile ändern —
--    auch Abo- und Stripe-Spalten (subscription_status = 'active' umgeht die
--    Bezahlschranke). Diese Spalten schreibt nur noch der Server (Stripe-Webhook,
--    Abo-Abgleich, Service-Role). Alle übrigen Spalten bleiben für die bestehenden
--    Policies (eigenes Profil, Vereinsadmin) beschreibbar.
REVOKE UPDATE ON public.users FROM authenticated, anon;
GRANT UPDATE (
  email, full_name, avatar_url, updated_at, billing_email, phone, address, city,
  postal_code, date_of_birth, bio, emergency_contact, emergency_phone,
  superadmin_setup_completed_at, experience_months, skill_level, dtb_id,
  owner_setup_completed_at, lk_rating
) ON public.users TO authenticated;
