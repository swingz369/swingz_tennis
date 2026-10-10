-- RLS-Performance: auth.uid(), auth.jwt() und is_owner() in Policies einmal pro Abfrage
-- statt pro Zeile auswerten.
--
-- Ohne Unterabfrage ruft Postgres die (STABLE-)Funktion für jede geprüfte Zeile neu auf;
-- als `(SELECT auth.uid())` wird sie zum InitPlan und läuft genau einmal. Semantisch
-- identisch — Supabase-Advisor `auth_rls_initplan`. Stand 10.10.2026: 215 von 366 Policies
-- betroffen.
--
-- Liest die Policies zur Laufzeit aus pg_policies und ändert sie per ALTER POLICY in
-- place: keine Namen aus Migrationsdateien geraten (AGENTS.md § Migrationen 1), Drift
-- zwischen lokal und Produktion bleibt unberührt, erneuter Lauf ändert nichts mehr.

DO $$
DECLARE
  p record;
  new_qual text;
  new_check text;
  stmt text;
BEGIN
  -- Deparse in pg_policies hängt am search_path; so erscheint is_owner() unqualifiziert.
  PERFORM set_config('search_path', 'public', true);

  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '(auth\.uid|auth\.jwt|is_owner)\(\)'
  LOOP
    new_qual := p.qual;
    new_check := p.with_check;

    -- Bereits eingepackte Aufrufe schützen, dann nackte einpacken, dann zurück.
    new_qual := replace(replace(replace(new_qual,
      '( SELECT auth.uid() AS uid)', chr(1)), 'auth.uid()', '( SELECT auth.uid() AS uid)'), chr(1), '( SELECT auth.uid() AS uid)');
    new_qual := replace(replace(replace(new_qual,
      '( SELECT auth.jwt() AS jwt)', chr(2)), 'auth.jwt()', '( SELECT auth.jwt() AS jwt)'), chr(2), '( SELECT auth.jwt() AS jwt)');
    new_qual := replace(replace(replace(new_qual,
      '( SELECT is_owner() AS is_owner)', chr(3)), 'is_owner()', '( SELECT is_owner() AS is_owner)'), chr(3), '( SELECT is_owner() AS is_owner)');

    new_check := replace(replace(replace(new_check,
      '( SELECT auth.uid() AS uid)', chr(1)), 'auth.uid()', '( SELECT auth.uid() AS uid)'), chr(1), '( SELECT auth.uid() AS uid)');
    new_check := replace(replace(replace(new_check,
      '( SELECT auth.jwt() AS jwt)', chr(2)), 'auth.jwt()', '( SELECT auth.jwt() AS jwt)'), chr(2), '( SELECT auth.jwt() AS jwt)');
    new_check := replace(replace(replace(new_check,
      '( SELECT is_owner() AS is_owner)', chr(3)), 'is_owner()', '( SELECT is_owner() AS is_owner)'), chr(3), '( SELECT is_owner() AS is_owner)');

    IF new_qual IS NOT DISTINCT FROM p.qual AND new_check IS NOT DISTINCT FROM p.with_check THEN
      CONTINUE;
    END IF;

    stmt := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;
    EXECUTE stmt;
  END LOOP;
END $$;
