-- Trainer-Slot Warteliste
-- Ermöglicht Mitgliedern sich auf vollständig gebuchte Trainer-Slots zu setzen.

CREATE TABLE IF NOT EXISTS trainer_slot_waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id     uuid NOT NULL REFERENCES trainer_availabilities(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trainer_slot_waitlist_unique UNIQUE (slot_id, user_id)
);

CREATE INDEX IF NOT EXISTS trainer_slot_waitlist_slot_idx ON trainer_slot_waitlist (slot_id);
CREATE INDEX IF NOT EXISTS trainer_slot_waitlist_user_idx ON trainer_slot_waitlist (user_id);

-- RLS: Mitglieder sehen nur ihre eigenen Einträge; Service-Client für Schreibzugriff
ALTER TABLE trainer_slot_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_read_own_waitlist" ON trainer_slot_waitlist;
CREATE POLICY "member_read_own_waitlist"
  ON trainer_slot_waitlist FOR SELECT
  USING (auth.uid() = user_id);
