-- Migration: Trainer-Notizen pro Mitglied
-- Trainer können pro Mitglied Notizen hinterlegen (Verletzung, Technik-Schwerpunkt).
-- Nur für Trainer und Admin sichtbar.

CREATE TABLE IF NOT EXISTS trainer_member_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID        NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  member_id  UUID        NOT NULL,
  club_id    UUID        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  note       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(trainer_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_notes_member
  ON trainer_member_notes(member_id, club_id);
