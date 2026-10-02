/**
 * Wächter über pg_policies: keine Policy ohne Vereinsbezug.
 *
 * Zwei Muster brachen die Mandantentrennung (Audit 20.09.2026):
 *  1. „Admin IRGENDEINES Vereins" — Policy fragt user_club_memberships nach der Rolle, aber
 *     nicht nach dem Verein der Zeile.
 *  2. USING/WITH CHECK `true` für Nutzerrollen — jeder liest/schreibt alle Vereine.
 *
 * Bewusst öffentliche Daten stehen in ALLOWED_OPEN (mit Begründung).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL || '';
const describeDb = DB_URL && /localhost|127\.0\.0\.1/.test(DB_URL) ? describe : describe.skip;

const OPEN_PREDICATE = String.raw`^\(?true\)?$`;

/** tabelle → Grund, warum `true` stimmt. */
const ALLOWED_OPEN: Record<string, string> = {
  school_holidays: 'Ferientermine sind Landesdaten, keine Vereinsdaten',
};

describeDb('RLS-Policy-Katalog', () => {
  let sql: ReturnType<typeof postgres>;
  beforeAll(() => {
    sql = postgres(DB_URL, { max: 1 });
  });
  afterAll(async () => {
    await sql.end();
  });

  it('keine Policy prüft nur die Rolle, aber nicht den Verein', async () => {
    const rows = await sql<{ tablename: string; policyname: string }[]>`
      SELECT tablename, policyname FROM pg_policies
      WHERE schemaname = 'public'
        AND (coalesce(qual,'') || coalesce(with_check,'')) ~ 'user_club_memberships'
        AND (coalesce(qual,'') || coalesce(with_check,'')) !~ '(club_id|is_club_|is_admin_of_user|is_staff_of_user|shares_active_club_with|is_owner|is_superadmin_of)'
    `;
    expect(rows.map((r) => `${r.tablename}.${r.policyname}`)).toEqual([]);
  });

  it('keine Nutzer-Policy mit USING/WITH CHECK true', async () => {
    const rows = await sql<{ tablename: string; policyname: string }[]>`
      SELECT tablename, policyname FROM pg_policies
      WHERE schemaname = 'public'
        AND NOT ('service_role' = ANY (roles::text[]))
        AND coalesce(nullif(with_check,''), qual) ~ ${OPEN_PREDICATE}
        AND policyname <> 'registration_requests_insert_public'
    `;
    const bad = rows.filter((r) => !(r.tablename in ALLOWED_OPEN));
    expect(bad.map((r) => `${r.tablename}.${r.policyname}`)).toEqual([]);
  });

  it('keine SECURITY-DEFINER-Funktion für Nutzer ausführbar, die nicht freigegeben ist', async () => {
    const rows = await sql<{ proname: string; anon: boolean }[]>`
      SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef
        AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    `;
    const bad = rows
      .filter((r) => !(r.proname in DEFINER_FOR_USERS) || (r.anon && !RLS_HELPERS.has(r.proname)))
      .map((r) => `${r.proname}${r.anon ? ' (anon)' : ''}`);
    expect(bad).toEqual([]);
  });
});

/**
 * RLS-Helfer: Policies rufen sie im Kontext des Abfragenden auf, auch für anon.
 * Sie geben nur Auskunft über den Aufrufer selbst.
 */
const RLS_HELPERS = new Set([
  'get_my_trainer_id',
  'get_user_club_ids',
  'is_admin_of_user',
  'is_club_admin',
  'is_club_member',
  'is_club_trainer',
  'is_conversation_participant',
  'is_message_participant',
  'is_owner',
  'is_staff_of_user',
  'is_superadmin',
  'is_superadmin_of',
  'news_audience_matches',
  'shares_active_club_with',
]);

/**
 * SECURITY DEFINER umgeht RLS. Für `authenticated` freigegeben ist nur, was selbst prüft, wer
 * aufruft (Grund: 20261002100000_security_definer_rechte.sql). Alles andere: EXECUTE nur
 * service_role, oder SECURITY INVOKER.
 */
const DEFINER_FOR_USERS: Record<string, string> = {
  ...Object.fromEntries([...RLS_HELPERS].map((n) => [n, 'RLS-Helfer'])),
  chat_unread_total: 'zählt nur Gespräche von auth.uid()',
  create_group_conversation: 'prüft Staff-Rolle im Verein',
  list_my_conversations: 'nur Gespräche von auth.uid()',
  start_direct_conversation: 'prüft gemeinsame Vereinsmitgliedschaft',
  news_read_stats: 'prüft Admin des Vereins',
  generate_season_invoices_atomic: 'prüft Admin des Vereins (20260914120000)',
};
