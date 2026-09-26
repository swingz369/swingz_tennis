/**
 * Mandanten-Isolation über HTTP — Admin von Claude Sandbox Alpha ruft jede GET-Route
 * auf, mit IDs aus Claude Sandbox Gamma. Es darf keine fremde Zeile zurückkommen.
 *
 * Warum: Rund die Hälfte der API umging RLS (ADR-005); zwei Datenlecks im Juli waren die
 * Folge. Die statischen Scans (`season-tenant-isolation.test.ts`, `no-defaulted-club-scope`)
 * sehen nur Quelltext-Muster. Dieser Test ruft die Routen echt auf und ist damit das
 * Sicherheitsnetz für die Migration weiterer Domänen (Saisonplanung, Service-Client-Routen).
 *
 * Fremdverein ist Gamma, nicht Beta — Beta ist absichtlich leer, also gäbe es keine IDs.
 *
 * Ablauf:
 *   1. Fremde IDs einsammeln: jede Tabelle mit `club_id` (aus dem Katalog), Zeilen von Gamma
 *      abzüglich allem, was auch zu Alpha gehört (Superadmin ist in allen Vereinen).
 *   2. Pro Route Parameter auflösen: `[id]` unter `seasons/` → Gamma-Saison usw. Routen ohne
 *      auflösbare Fremd-ID werden ohne Parameter-Aufruf nicht gezählt (Abdeckung wird gemeldet).
 *   3. An jede Anfrage `?clubId=<Gamma>&club_id=<Gamma>` hängen (Query-Parameter-Injektion).
 *   4. Antwort 2xx: darf keine fremde UUID (außer den selbst mitgeschickten), keine
 *      `@gamma.claude.test`-Adresse und keinen Gamma-Vereinsnamen enthalten. Nicht-JSON-Antworten
 *      (PDF, CSV) auf eine fremde Pfad-ID sind schon als 2xx ein Befund. JSON mit leerem Ergebnis
 *      gilt als fail-closed (RLS), nicht als Leck.
 *
 * Nur GET, nur lesend. Rollen: Admin. Die Nutzer-Lane (`*.swingz.test`) wird nie berührt.
 *
 * Ausführung (Dev-Server mit DISABLE_RATE_LIMITING=true und lokale DB müssen laufen):
 *   npm run test:tenant
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { request, type APIRequestContext } from 'playwright';
import postgres from 'postgres';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const API_DIR = join(process.cwd(), 'app', 'api');
const DB_URL = process.env.DATABASE_URL || '';
const NIL = '00000000-0000-4000-8000-000000000000';
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const SKIP = [
  /^\/api\/auth\//, // Login/Logout/Session — beendet oder ändert die Test-Sitzung
  /^\/api\/cron\//, // Hintergrundjobs
  /^\/api\/health\//, // externe Dienste
  /^\/api\/webhooks?\//,
  /^\/api\/public\//, // bewusst öffentlich (Vereinsliste, Stats, Probetraining)
  /^\/api\/backup$/, // listet den Backup-Bucket der Plattform, nicht vereinsbezogen
];

/**
 * Bekannte Befunde (Route → Grund). Neue Befunde brechen den Test; alte werden beim Migrieren
 * der Domäne entfernt. Leer lassen, wenn der Test grün ist — nie eine Route „vorsorglich" eintragen.
 */
const KNOWN_LEAKS: Record<string, string> = {};

interface RouteFile {
  route: string; // /api/seasons/[id]/members
  params: string[]; // ['id']
}

function getRoutes(): RouteFile[] {
  const files = readdirSync(API_DIR, { recursive: true, encoding: 'utf8' });
  const out: RouteFile[] = [];
  for (const file of files) {
    if (!file.endsWith(`${sep}route.ts`) && file !== 'route.ts') continue;
    if (!/export\s+(async\s+function|const)\s+GET/.test(readFileSync(join(API_DIR, file), 'utf8')))
      continue;
    const segments = file.split(sep).slice(0, -1);
    const route = `/api${segments.length ? '/' + segments.join('/') : ''}`;
    if (SKIP.some((re) => re.test(route))) continue;
    out.push({ route, params: [...route.matchAll(/\[(\w+)\]/g)].map((m) => m[1]) });
  }
  return out.sort((a, b) => a.route.localeCompare(b.route));
}

const describeLive = DB_URL && /localhost|127\.0\.0\.1/.test(DB_URL) ? describe : describe.skip;

describeLive('Mandanten-Isolation über HTTP (Alpha-Admin gegen Gamma)', () => {
  let sql: ReturnType<typeof postgres>;
  let api: APIRequestContext;
  /** Tabelle → Gamma-IDs */
  const foreignByTable = new Map<string, string[]>();
  const foreignIds = new Set<string>();
  let gammaClubId = '';
  let gammaClubName = '';
  let foreignUserId = '';

  async function clubRows(clubId: string): Promise<Map<string, string[]>> {
    const tables = await sql<{ table_name: string }[]>`
      select c.table_name from information_schema.columns c
      join information_schema.columns i
        on i.table_schema = c.table_schema and i.table_name = c.table_name and i.column_name = 'id'
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
      where c.table_schema = 'public' and c.column_name = 'club_id' and i.data_type = 'uuid'`;
    const result = new Map<string, string[]>();
    for (const { table_name } of tables) {
      const rows = await sql.unsafe(
        `select id::text from public."${table_name}" where club_id = $1 limit 300`,
        [clubId]
      );
      if (rows.length)
        result.set(
          table_name,
          rows.map((r) => r.id as string)
        );
    }
    const members = await sql`
      select user_id::text as id from user_club_memberships where club_id = ${clubId} limit 300`;
    if (members.length)
      result.set(
        'users',
        members.map((r) => r.id as string)
      );
    return result;
  }

  beforeAll(async () => {
    sql = postgres(DB_URL, { max: 2 });
    const clubs = await sql<{ id: string; name: string }[]>`
      select id, name from clubs where name in ('Claude Sandbox Alpha', 'Claude Sandbox Gamma')`;
    const gamma = clubs.find((c) => c.name === 'Claude Sandbox Gamma');
    const alpha = clubs.find((c) => c.name === 'Claude Sandbox Alpha');
    if (!gamma || !alpha) throw new Error('Sandbox Alpha/Gamma fehlen — `npm run seed:agent`');
    gammaClubId = gamma.id;
    gammaClubName = gamma.name;

    const own = new Set([...(await clubRows(alpha.id)).values()].flat());
    for (const [table, ids] of await clubRows(gamma.id)) {
      const foreign = ids.filter((id) => !own.has(id));
      if (!foreign.length) continue;
      foreignByTable.set(table, foreign);
      foreign.forEach((id) => foreignIds.add(id));
    }
    foreignUserId = foreignByTable.get('users')?.[0] ?? '';

    api = await request.newContext({ baseURL: BASE_URL });
    const login = await api.post('/api/auth/login', {
      data: { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD },
    });
    if (!login.ok()) throw new Error(`Login fehlgeschlagen (${login.status()})`);
  });

  afterAll(async () => {
    await api?.dispose();
    await sql?.end();
  });

  /**
   * Der Dev-Server kompiliert Routen beim Erstaufruf und wird auf knappen Rechnern gelegentlich
   * vom OOM-Killer beendet. Ein Neustart (Watchdog) ist dann Sache der Umgebung; der Test wartet
   * bis zu 2 Minuten auf `/api/health` und wiederholt die Anfrage — mit frischer Anmeldung, weil
   * das Cookie einen Neustart überlebt, die Sitzung aber nicht garantiert.
   */
  async function getWithRetry(url: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await api.get(url, { failOnStatusCode: false });
      } catch (e) {
        if (attempt >= 2) throw e;
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const up = await api.get('/api/health', { failOnStatusCode: false }).then(
            () => true,
            () => false
          );
          if (up) break;
        }
      }
    }
  }

  /** Parameter → Fremd-ID. `undefined`, wenn nichts Passendes von Gamma existiert. */
  function resolve(route: string, param: string): string | undefined {
    if (/club/i.test(param)) return gammaClubId;
    if (/user|member|trainer|player/i.test(param) && foreignUserId) return foreignUserId;
    const before = route.split(`[${param}]`)[0].split('/').filter(Boolean).pop() ?? '';
    const table = before.replace(/-/g, '_');
    return foreignByTable.get(table)?.[0] ?? foreignByTable.get(`${table}s`)?.[0];
  }

  /** `echoed`: IDs, die der Test selbst in Pfad/Query mitgeschickt hat — ihr Zurückspiegeln ist kein Leck. */
  function leaks(body: string, echoed: string[]): string[] {
    const found = new Set<string>();
    for (const id of body.match(UUID_RE) ?? []) {
      const lower = id.toLowerCase();
      if (foreignIds.has(lower) && !echoed.includes(lower)) found.add(id);
    }
    if (/@gamma\.claude\.test/i.test(body)) found.add('@gamma.claude.test');
    if (body.includes(gammaClubName)) found.add(gammaClubName);
    return [...found];
  }

  it('keine GET-Route liefert Zeilen aus Gamma an den Alpha-Admin', async () => {
    const violations: string[] = [];
    let called = 0;
    let withForeignId = 0;
    const unresolved: string[] = [];
    const failed: string[] = [];

    for (const { route, params } of getRoutes()) {
      let url = route;
      let foreignInPath = false;
      let ok = true;
      const pathIds: string[] = [];
      for (const p of params) {
        const id = resolve(route, p);
        if (id) {
          foreignInPath = true;
          pathIds.push(id);
        } else ok = false;
        url = url.replace(`[${p}]`, id ?? NIL);
      }
      if (params.length && !foreignInPath) {
        unresolved.push(route);
        continue;
      }
      if (!ok) unresolved.push(`${route} (teilweise)`);

      let res;
      try {
        res = await getWithRetry(`${url}?clubId=${gammaClubId}&club_id=${gammaClubId}`);
      } catch (e) {
        // Server dauerhaft weg — kein Isolationsbefund, aber sichtbar machen.
        failed.push(`${route}: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
        continue;
      }
      called++;
      if (foreignInPath) withForeignId++;
      if (res.status() >= 500) {
        failed.push(`${route}: HTTP ${res.status()}`);
        continue;
      }
      if (res.status() < 200 || res.status() >= 300 || route in KNOWN_LEAKS) continue;

      // Binär/CSV (PDF, Export): kein UUID-Scan möglich — 2xx auf fremde Pfad-ID ist schon der Befund.
      // JSON mit leerem Ergebnis (RLS filtert) ist fail-closed und bewusst kein Befund.
      if (foreignInPath && !(res.headers()['content-type'] ?? '').includes('json')) {
        violations.push(
          `${route} → ${res.status()} (${res.headers()['content-type']}) für fremde ID im Pfad`
        );
        continue;
      }
      const echoed = [gammaClubId, ...pathIds].map((id) => id.toLowerCase());
      const hits = leaks(await res.text(), echoed);
      if (hits.length)
        violations.push(`${route} → ${res.status()} enthält ${hits.slice(0, 3).join(', ')}`);
    }

    console.log(
      `Tenant-Isolation: ${called} Routen aufgerufen, ${withForeignId} mit Fremd-ID im Pfad, ` +
        `${unresolved.length} ohne auflösbare Fremd-ID übersprungen, ${failed.length} fehlgeschlagen.` +
        (failed.length ? `\nFehlgeschlagen:\n  ${failed.join('\n  ')}` : '')
    );
    expect(called, 'Es wurde keine GET-Route geprüft').toBeGreaterThan(0);
    expect(withForeignId, 'Keine Route wurde mit einer fremden Pfad-ID geprüft').toBeGreaterThan(0);
    expect(failed, 'Nicht erreichbare Routen dürfen den Test nicht grün lassen').toEqual([]);
    expect(violations).toEqual([]);
  }, 600_000);
});
