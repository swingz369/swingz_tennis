/**
 * API-Smoke-Test — jede GET-Route einmal aufrufen, keine darf 500 antworten.
 *
 * Warum: Die drei Datenfehler vom 16.08.2026 hatten dieselbe Signatur — eine
 * Annahme über die Form der Daten, die die Datenbank nicht teilt (ein JSON-String
 * statt eines Objekts, eine synthetische ID in einer uuid-Spalte, eine leere
 * Tabelle statt der richtigen). Alle drei zeigten sich erst beim echten Aufruf,
 * nicht beim Typcheck und nicht im Trockenlauf. Ein Aufruf pro Route hätte sie
 * gefunden.
 *
 * Geprüft wird nur: **kein 5xx**. 400/401/403/404 sind erlaubt — eine Route, die
 * Parameter verlangt, die dieser Test nicht kennt, ist nicht kaputt.
 *
 * Die Routenliste kommt aus dem Dateisystem (`app/api/ ** /route.ts`), kann also
 * nicht veralten. Routen mit dynamischen Segmenten (`[id]`) bleiben aussen vor —
 * ohne echte IDs wäre der Aufruf bedeutungslos.
 *
 * ponytail: nur GET, nur statische Pfade, nur Rolle Admin. Dynamische Routen und
 * POST/PATCH kämen als nächstes dran, wenn dieser Test zu wenig findet.
 *
 * Ausführung (Dev-Server muss laufen):
 *   npx vitest run tests/browser/api-routes-smoke.test.ts
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { request } from 'playwright';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const API_DIR = join(process.cwd(), 'app', 'api');

/** Routen, die absichtlich nicht per Smoke-Test aufgerufen werden. */
const SKIP = [
  /^\/api\/auth\/logout$/, // beendet die Sitzung des Tests
  /^\/api\/cron\//, // Hintergrundjobs, teils schreibend
  /^\/api\/health\/deep$/, // fragt externe Dienste an
];

function staticGetRoutes(): string[] {
  const files = readdirSync(API_DIR, { recursive: true, encoding: 'utf8' });
  const routes: string[] = [];

  for (const file of files) {
    if (!file.endsWith(`${sep}route.ts`) && file !== 'route.ts') continue;
    if (file.includes('[')) continue; // dynamisches Segment — ohne echte ID sinnlos

    const source = readFileSync(join(API_DIR, file), 'utf8');
    if (!/export\s+(async\s+function|const)\s+GET/.test(source)) continue;

    const segments = file.split(sep).slice(0, -1);
    routes.push(`/api${segments.length ? '/' + segments.join('/') : ''}`);
  }
  return [...new Set(routes)].sort();
}

describe('API-Smoke — keine Route antwortet mit 500', () => {
  it(
    'alle statischen GET-Routen',
    async () => {
      const email = process.env.TEST_ADMIN_EMAIL ?? '';
      const password = process.env.TEST_ADMIN_PASSWORD ?? '';
      expect(email, 'TEST_ADMIN_EMAIL fehlt in .env.local').toBeTruthy();

      const ctx = await request.newContext({ baseURL: BASE_URL });
      const login = await ctx.post('/api/auth/login', { data: { email, password } });
      expect(login.ok(), 'Login als Admin fehlgeschlagen').toBe(true);

      const routes = staticGetRoutes().filter((r) => !SKIP.some((re) => re.test(r)));
      expect(routes.length, 'keine Routen gefunden — Pfadaufbau prüfen').toBeGreaterThan(50);

      const broken: string[] = [];
      for (const route of routes) {
        const res = await ctx
          .get(route, { timeout: 60_000 })
          .catch((err: Error) => err as unknown as null | Error);
        if (!res || res instanceof Error) {
          broken.push(
            `${route} → keine Antwort (${res ? res.message.split('\n')[0] : 'unbekannt'})`
          );
          continue;
        }
        if (res.status() >= 500) {
          const body = (await res.text().catch(() => '')).slice(0, 200);
          broken.push(`${route} → ${res.status()} ${body}`);
        }
      }
      await ctx.dispose();

      if (broken.length > 0) {
        throw new Error(
          `${broken.length}/${routes.length} Routen antworten mit 5xx:\n  ${broken.join('\n  ')}`
        );
      }
    },
    10 * 60 * 1000
  );
});
