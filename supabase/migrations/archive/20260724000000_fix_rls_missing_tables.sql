-- Fix: RLS für session_waitlist und trainer_member_notes nachrüsten
-- Beide Tabellen wurden ohne RLS-Policies deployed (Security Advisory 2026-06-22)

-- session_waitlist
ALTER TABLE session_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_waitlist_select" ON session_waitlist;
CREATE POLICY "session_waitlist_select" ON session_waitlist
  FOR SELECT USING (
    member_id = auth.uid()
    OR is_superadmin()
    OR is_club_trainer(club_id)
  );

DROP POLICY IF EXISTS "session_waitlist_insert" ON session_waitlist;
CREATE POLICY "session_waitlist_insert" ON session_waitlist
  FOR INSERT WITH CHECK (
    member_id = auth.uid()
    OR is_superadmin()
    OR is_club_trainer(club_id)
  );

DROP POLICY IF EXISTS "session_waitlist_update" ON session_waitlist;
CREATE POLICY "session_waitlist_update" ON session_waitlist
  FOR UPDATE USING (
    is_superadmin() OR is_club_trainer(club_id)
  );

DROP POLICY IF EXISTS "session_waitlist_delete" ON session_waitlist;
CREATE POLICY "session_waitlist_delete" ON session_waitlist
  FOR DELETE USING (
    member_id = auth.uid()
    OR is_superadmin()
    OR is_club_trainer(club_id)
  );

-- trainer_member_notes (sensitive: Verletzungen, Technik-Hinweise)
ALTER TABLE trainer_member_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer_notes_select" ON trainer_member_notes;
CREATE POLICY "trainer_notes_select" ON trainer_member_notes
  FOR SELECT USING (
    is_superadmin()
    OR is_club_admin(club_id)
    OR EXISTS (
      SELECT 1 FROM trainers t
      WHERE t.id = trainer_member_notes.trainer_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "trainer_notes_insert" ON trainer_member_notes;
CREATE POLICY "trainer_notes_insert" ON trainer_member_notes
  FOR INSERT WITH CHECK (
    is_superadmin()
    OR is_club_trainer(club_id)
  );

DROP POLICY IF EXISTS "trainer_notes_update" ON trainer_member_notes;
CREATE POLICY "trainer_notes_update" ON trainer_member_notes
  FOR UPDATE USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM trainers t
      WHERE t.id = trainer_member_notes.trainer_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "trainer_notes_delete" ON trainer_member_notes;
CREATE POLICY "trainer_notes_delete" ON trainer_member_notes
  FOR DELETE USING (
    is_superadmin()
    OR is_club_admin(club_id)
    OR EXISTS (
      SELECT 1 FROM trainers t
      WHERE t.id = trainer_member_notes.trainer_id AND t.user_id = auth.uid()
    )
  );
