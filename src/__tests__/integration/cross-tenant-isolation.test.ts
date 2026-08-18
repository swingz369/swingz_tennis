/**
 * Trennt RLS die Vereine wirklich? (PRODUKTIONSREIFE.md 2.2 und 2.3)
 *
 * Der bestehende `rls-policies.test.ts` prüft nur, ob die Policies existieren
 * und ob der Service-Client durchkommt — der umgeht RLS aber ohnehin. Damit
 * konnte er die Frage, um die es hier geht, nie beantworten: sieht Verein A
 * die Zahlen von Verein B?
 *
 * Dieser Test setzt deshalb `request.jwt.claims` direkt und arbeitet als
 * Rolle `authenticated`, also genau so, wie PostgREST es für einen
 * angemeldeten Nutzer tut. Alles läuft in einer Transaktion, die am Ende
 * zurückgerollt wird — es bleibt nichts in der Datenbank stehen.
 *
 * Entscheidung dahinter (BUSINESS_RULES.md): Mitglieder sehen ausschliesslich
 * Nutzer aus ihren eigenen Vereinen. Vereinsübergreifende Spielersuche ist
 * damit bewusst ausgeschlossen.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL || '';
const isLocal = /localhost|127\.0\.0\.1/.test(DB_URL);
const describeDb = DB_URL && isLocal ? describe : describe.skip;

const CLUB_A = 'aaaaaaaa-0000-0000-0000-00000000a001';
const CLUB_B = 'bbbbbbbb-0000-0000-0000-00000000b002';
const SUPERADMIN_A = '11111111-0000-0000-0000-0000000000a1';
const MEMBER_A = '22222222-0000-0000-0000-0000000000a2';
const MEMBER_B = '33333333-0000-0000-0000-0000000000b3';

describeDb('Vereinstrennung (RLS)', () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(() => {
    sql = postgres(DB_URL, { max: 1 });
  });

  afterAll(async () => {
    await sql.end();
  });

  /** Führt `fn` als angemeldeter Nutzer aus und rollt danach alles zurück. */
  async function asUser<T>(userId: string, query: string): Promise<T[]> {
    let rows: T[] = [];
    await sql
      .begin(async (tx) => {
        await tx.unsafe(`
          insert into clubs (id, name, opening_hours) values
            ('${CLUB_A}', 'Verein A', '{}'::jsonb),
            ('${CLUB_B}', 'Verein B', '{}'::jsonb);
          insert into users (id, email, full_name) values
            ('${SUPERADMIN_A}', 'sa-a@isolation.test', 'Superadmin A'),
            ('${MEMBER_A}',     'm-a@isolation.test', 'Mitglied A'),
            ('${MEMBER_B}',     'm-b@isolation.test', 'Mitglied B');
          insert into user_club_memberships (user_id, club_id, role, is_active) values
            ('${SUPERADMIN_A}', '${CLUB_A}', 'superadmin', true),
            ('${MEMBER_A}',     '${CLUB_A}', 'member',     true),
            ('${MEMBER_B}',     '${CLUB_B}', 'member',     true);
          insert into billing_periods (club_id, start_date, end_date) values
            ('${CLUB_A}', '2026-01-01', '2026-01-31'),
            ('${CLUB_B}', '2026-01-01', '2026-01-31');
          set local role authenticated;
          set local request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}';
        `);
        rows = (await tx.unsafe(query)) as unknown as T[];
        // Rollback: der Test darf nichts hinterlassen.
        throw new Error('__rollback__');
      })
      .catch((e: Error) => {
        if (e.message !== '__rollback__') throw e;
      });
    return rows;
  }

  it('2.2 — ein Superadmin sieht die Abrechnungszeiträume fremder Vereine nicht', async () => {
    const [row] = await asUser<{ eigener: string; fremder: string }>(
      SUPERADMIN_A,
      `select count(*) filter (where club_id = '${CLUB_A}') as eigener,
              count(*) filter (where club_id = '${CLUB_B}') as fremder
         from billing_periods`
    );
    expect(Number(row?.eigener)).toBe(1);
    expect(Number(row?.fremder)).toBe(0);
  });

  it('2.3 — ein Mitglied sieht keine Nutzer aus fremden Vereinen', async () => {
    const [row] = await asUser<{ selbst: string; gleicher: string; fremder: string }>(
      MEMBER_A,
      `select count(*) filter (where id = '${MEMBER_A}')     as selbst,
              count(*) filter (where id = '${SUPERADMIN_A}') as gleicher,
              count(*) filter (where id = '${MEMBER_B}')     as fremder
         from users`
    );
    expect(Number(row?.selbst)).toBe(1);
    expect(Number(row?.gleicher)).toBe(1);
    expect(Number(row?.fremder)).toBe(0);
  });
});
