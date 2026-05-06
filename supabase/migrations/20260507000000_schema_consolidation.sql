-- ============================================================
-- Migration: Schema Konsolidierung & Fehlende Tabellen
-- Datum: 2026-05-07
-- Behebt:
--   1. trainer_club vs trainer_clubs Namenskonflikt
--   2. trainer_availability vs trainer_availabilities Duplikat
--   3. Fehlende groups-Tabelle in Supabase (nur in Drizzle)
--   4. Doppelte sepa_mandates Definition
--   5. setup_completed_at für Clubs (Admin-Onboarding)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. trainer_clubs / trainer_club Alias
--    Drizzle nutzt 'trainer_club' (singular), migrations nutzen
--    'trainer_clubs' (plural). Wir erstellen einen View-Alias
--    damit beide Pfade funktionieren ohne Daten zu migrieren.
-- ─────────────────────────────────────────────────────────────

-- Stelle sicher dass trainer_clubs existiert (canonical table)
CREATE TABLE IF NOT EXISTS trainer_clubs (
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  club_id    UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  PRIMARY KEY (trainer_id, club_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- View für Drizzle-Code der trainer_club (singular) erwartet
CREATE OR REPLACE VIEW trainer_club AS
  SELECT trainer_id, club_id, created_at FROM trainer_clubs;

-- ─────────────────────────────────────────────────────────────
-- 2. trainer_availabilities → Alias auf trainer_availability
--    Primäre Tabelle ist trainer_availability (user_id-basiert)
--    Drizzle-Schema referenziert trainer_availabilities → View
-- ─────────────────────────────────────────────────────────────

-- trainer_availability (primary) muss existieren
CREATE TABLE IF NOT EXISTS trainer_availability (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id     UUID REFERENCES clubs(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- View für Drizzle (trainer_availabilities plural)
CREATE OR REPLACE VIEW trainer_availabilities AS
  SELECT
    id,
    user_id     AS trainer_id,
    club_id,
    CASE day_of_week
      WHEN 0 THEN 'monday'
      WHEN 1 THEN 'tuesday'
      WHEN 2 THEN 'wednesday'
      WHEN 3 THEN 'thursday'
      WHEN 4 THEN 'friday'
      WHEN 5 THEN 'saturday'
      WHEN 6 THEN 'sunday'
    END          AS day_of_week,
    start_time,
    end_time,
    is_available,
    created_at,
    created_at  AS updated_at,
    'confirmed'::TEXT AS status
  FROM trainer_availability;

-- ─────────────────────────────────────────────────────────────
-- 3. groups Tabelle (existiert nur in Drizzle, nicht in Supabase)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  level       VARCHAR(100),
  age_group   VARCHAR(100),
  description TEXT,
  max_members INTEGER DEFAULT 20,
  member_ids  JSONB DEFAULT '[]'::jsonb,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_club_id ON groups(club_id);

-- ─────────────────────────────────────────────────────────────
-- 4. Clubs: setup_completed_at für Admin-Onboarding
--    (wie im TSOW-Referenzprojekt)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────
-- 5. user_club_memberships: status Feld hinzufügen
--    (TSOW hat status: 'active'|'pending'|'suspended'|'left')
--    SwingZ hat nur is_active boolean → ergänzen
-- ─────────────────────────────────────────────────────────────

ALTER TABLE user_club_memberships
  ADD COLUMN IF NOT EXISTS status TEXT
    DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'suspended', 'left'));

-- Bestehende Einträge synchronisieren
UPDATE user_club_memberships
  SET status = CASE WHEN is_active THEN 'active' ELSE 'left' END
  WHERE status IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 6. notifications Tabelle (in Code referenziert, nicht in Migrationen)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id     UUID REFERENCES clubs(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT,
  type        TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error', 'booking', 'invoice', 'training')),
  read        BOOLEAN DEFAULT FALSE,
  action_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = FALSE;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own notifications" ON notifications;
CREATE POLICY "Users see own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage club notifications" ON notifications;
CREATE POLICY "Admins manage club notifications" ON notifications
  FOR INSERT WITH CHECK (is_club_admin(club_id));

-- ─────────────────────────────────────────────────────────────
-- 7. RLS für neue Tabellen
-- ─────────────────────────────────────────────────────────────

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Club members see groups" ON groups;
CREATE POLICY "Club members see groups" ON groups
  FOR SELECT USING (is_club_member(club_id));

DROP POLICY IF EXISTS "Admins manage groups" ON groups;
CREATE POLICY "Admins manage groups" ON groups
  FOR ALL USING (is_club_admin(club_id));

ALTER TABLE trainer_clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Club members see trainer clubs" ON trainer_clubs;
CREATE POLICY "Club members see trainer clubs" ON trainer_clubs
  FOR SELECT USING (is_club_member(club_id));

DROP POLICY IF EXISTS "Admins manage trainer clubs" ON trainer_clubs;
CREATE POLICY "Admins manage trainer clubs" ON trainer_clubs
  FOR ALL USING (is_club_admin(club_id));

ALTER TABLE trainer_availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Trainers manage own availability" ON trainer_availability;
CREATE POLICY "Trainers manage own availability" ON trainer_availability
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Club members see trainer availability" ON trainer_availability;
CREATE POLICY "Club members see trainer availability" ON trainer_availability
  FOR SELECT USING (is_club_member(club_id));
