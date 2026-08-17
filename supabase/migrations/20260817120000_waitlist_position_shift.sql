-- Wartelisten-Reindex in EINER Query statt N UPDATEs im Loop.
--
-- Nach einem Nachrücken sinken die Positionen aller verbleibenden
-- Wartelisten-Einträge einer Session um genau 1 — das ist eine einzige
-- Mengen-Operation, kein Index-setzen pro Zeile. Die API-Route
-- /api/bookings/[id]/cancel ruft dieses RPC auf, seit die Supabase-Query-Builder
-- keine SQL-Expressions (SET position = position - 1) kennen.
--
-- SECURITY INVOKER + EXECUTE nur für service_role: Die Funktion läuft
-- ausschließlich über den Service-Client der API-Route (der passiert RLS wie
-- gehabt). Kein User-/anon-Kontext kann sie über PostgREST aufrufen (s. REVOKE unten).
CREATE OR REPLACE FUNCTION "public"."shift_session_waitlist_positions"(
  "p_session_id" "uuid"
)
RETURNS "void"
LANGUAGE "sql" SECURITY INVOKER
AS $$
  UPDATE public.session_waitlist
  SET position = position - 1
  WHERE session_id = p_session_id;
$$;

ALTER FUNCTION "public"."shift_session_waitlist_positions"("p_session_id" "uuid") OWNER TO "postgres";

-- Zugriff nur über den Service-Client der API-Route. Ohne REVOKE wäre das RPC
-- über PostgREST für jede Rolle aufrufbar (EXECUTE-Default für PUBLIC, und in
-- Supabase ziehen Default-Privileges EXECUTE für anon/authenticated/service_role
-- bei neuen Funktionen nach) — Trainer könnten mit beliebiger session_id die
-- Wartelisten-Positionen ihres Vereins manipulieren (der Pfad war vorher nur
-- über den Service-Client da).
--
-- REVOKE explizit für alle Rollen außer service_role: auf der konkreten Funktion
-- damit das Endbild unabhängig davon ist, ob die Funktion frisch angelegt wird
-- (dann ziehen Supabase-Default-Privileges EXECUTE für anon/authenticated nach)
-- oder ersetzt wird (dann bliebe die alte ACL stehen). Der GRANT auf service_role
-- setzt das erwünschte Endbild.
REVOKE ALL ON FUNCTION "public"."shift_session_waitlist_positions"("p_session_id" "uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."shift_session_waitlist_positions"("p_session_id" "uuid") FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."shift_session_waitlist_positions"("p_session_id" "uuid") TO "service_role";

COMMENT ON FUNCTION "public"."shift_session_waitlist_positions"("p_session_id" "uuid")
  IS 'Dekrementiert die Wartelisten-Position aller Einträge einer Session um 1 (nach Nachrücken)';