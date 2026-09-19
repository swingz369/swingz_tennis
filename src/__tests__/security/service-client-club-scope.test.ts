/**
 * Wächter: Routen mit Ressourcen-ID, die RLS umgehen, müssen den Verein prüfen.
 *
 * `createServiceClient()` und `billingEngine` lesen und schreiben ohne RLS. Eine Route
 * `.../[id]/...`, die nur „ist Admin" prüft, lässt jeden Admin jede ID bearbeiten — so
 * konnte ein Admin fremde Zahlungen umbuchen und fremde Rechnungen versenden (Audit
 * 20.09.2026). Der Test verlangt in solchen Routen irgendeinen Vereinsbezug; er beweist
 * nicht, dass die Prüfung richtig ist, aber er fängt die vergessene.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const API_ROOT = join(process.cwd(), 'app', 'api');

const BYPASSES_RLS = /createServiceClient|billingEngine|getInvoiceById/;
const HAS_SCOPE =
  /club_id|clubId|verifyClubAccess|memberships|requireAdminClub|authorizeSeasonAccess|user\.id/;
/** Kein Vereinsnutzer als Aufrufer: Cron, Webhooks, öffentlich, Owner (sieht alles), Login. */
const EXEMPT = /(^|\/)(cron|webhooks|public|owner|auth|trial-training|trial-trainings)(\/|$)/;

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) routeFiles(full, out);
    else if (entry.name === 'route.ts') out.push(full);
  }
  return out;
}

describe('RLS-umgehende Routen mit ID prüfen den Verein', () => {
  it('jede Route mit [param] und Service-Client nennt einen Vereinsbezug', () => {
    const findings: string[] = [];

    for (const file of routeFiles(API_ROOT)) {
      const rel = relative(API_ROOT, file);
      if (!/\[[a-zA-Z]+\]/.test(rel) || EXEMPT.test(rel)) continue;
      const src = readFileSync(file, 'utf8');
      if (BYPASSES_RLS.test(src) && !HAS_SCOPE.test(src)) findings.push(rel);
    }

    expect(findings, `Ohne Vereinsprüfung:\n${findings.join('\n')}`).toEqual([]);
  });
});
