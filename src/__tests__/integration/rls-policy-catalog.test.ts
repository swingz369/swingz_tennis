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
});
