-- Test-Migration: verifiziert dass die !supabase/migrations/*.sql Negation in .gitignore
-- funktioniert — diese Datei sollte ohne `git add -f` committable sein.
--
-- Datum: 2026-06-11
-- Zweck: CI-Lock-Test (verify-gitignore.ts prüft die Negation)
-- Inhalt: harmloses CREATE TABLE, das nichts produktives tut

CREATE TABLE IF NOT EXISTS _negation_test (
  id INTEGER PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-cleanup: nach erfolgreichem Test in einer Follow-up-Migration dropen
COMMENT ON TABLE _negation_test IS
  'Test-Tabelle für die .gitignore-Negations-Regel. Wird in der nächsten Migration gedroppt.';
