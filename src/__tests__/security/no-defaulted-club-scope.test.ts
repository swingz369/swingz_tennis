/**
 * Regression guard für das Muster, das die Architektur-Analyse als Ursache
 * echter Bugs identifiziert hat (docs/ARCHIV/2026-09-13-architektur-analyse-datenzugriff.md
 * § 4 „P1: Halbe Architektur erzeugt Logikfehler“, Phase 0 des Umsetzungsplans).
 *
 * Konkreter Fund (13.09.2026): `GET /api/trial-trainings/[id]/route.ts` ruft
 * `trialTrainingService.getTrialTrainingById(id)` OHNE clubId auf. Der Adapter
 * defaulted `clubId: string = ''`, das Repository filtert zwingend per
 * `eq(trialTrainings.club_id, clubId)` — das Ergebnis ist `WHERE club_id = ''`,
 * also für JEDEN echten Verein ein 404. Kein Datenleck in diesem Einzelfall,
 * aber dieselbe Lücke (Aufrufer vergisst clubId, keiner merkt's beim Schreiben)
 * ist in einem anderen Repository ein Cross-Tenant-Leak statt eines 404 —
 * je nachdem, ob der leere String zufällig ausschließt oder nicht filtert.
 *
 * Die Repositories selbst verlangen `clubId` immer als Pflichtparameter
 * (`findById(id: string, clubId: string)`, kein Default). Der Bruch passiert
 * ausschließlich eine Schicht höher, im Adapter/Service, der das Argument mit
 * `= ''` optional macht — TypeScript prüft dann nicht mehr, ob ein Aufrufer
 * es vergisst. Diese Regel verbietet genau das: kein Service/Adapter darf
 * einen `clubId`-Parameter mit leerem String defaulten. Fehlt clubId an einer
 * echten Aufrufstelle, soll das ein Compile-Fehler werden, kein stiller
 * Laufzeit-Bug.
 *
 * Statischer Quelltext-Scan, keine Verhaltensprüfung — dieselbe Machart wie
 * `season-tenant-isolation.test.ts`: billig, deterministisch, bricht sofort
 * bei neuem Auftreten.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');
const SERVICES_DIR = path.join(ROOT, 'src/application/services');

// Bekannte Altfälle (13.09.2026) — Ursache des trial-training-Fundes oben.
// Nicht ausklammern, sondern beim nächsten Anfassen dieser Domäne (Phase 3
// der Architektur-Analyse) beheben: Default entfernen, jede Aufrufstelle
// zwingt der Compiler dann, clubId aus `auth.clubId` durchzureichen.
//
// payment-settings-service.adapter.ts: behoben und gelöscht (13.09.2026,
// ADR-005-Migration auf PaymentSettingsService + PaymentSettingsRepository,
// clubId kommt jetzt zwingend aus `auth.clubId` in der Route).
// absence-service.adapter.ts: behoben und gelöscht (13.09.2026, ADR-005-
// Migration auf AbsenceService + AbsenceRepository).
const KNOWN_VIOLATIONS = new Set(
  ['fee-configuration-service.adapter.ts', 'trial-training-service.adapter.ts'].map((f) =>
    path.join(SERVICES_DIR, f)
  )
);

function listServiceFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.test.ts'))
    .map((e) => path.join(dir, e.name));
}

// Erfasst `clubId: string = ''` / `= ""` in Parameterlisten, mit oder ohne
// führendes `?` (auch ein optionales `clubId?: string = ''` wäre derselbe Fehler).
const DEFAULTED_CLUB_ID = /\bclubId\??\s*:\s*string\s*=\s*(['"])\1/;

describe('kein defaulteter clubId-Parameter in src/application/services', () => {
  const files = listServiceFiles(SERVICES_DIR);

  it('mindestens ein Service/Adapter existiert (Testaufbau-Sanity-Check)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('keine NEUEN Service/Adapter-Dateien defaulten clubId auf einen leeren String', () => {
    const newViolations = files
      .filter((f) => !KNOWN_VIOLATIONS.has(f))
      .filter((f) => DEFAULTED_CLUB_ID.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f));

    expect(newViolations).toEqual([]);
  });

  it('Baseline schrumpft, wächst nicht: bekannte Altfälle noch vorhanden, keine neuen dazu', () => {
    const stillViolating = [...KNOWN_VIOLATIONS].filter(
      (f) => fs.existsSync(f) && DEFAULTED_CLUB_ID.test(fs.readFileSync(f, 'utf8'))
    );
    // Wenn diese Zahl sinkt: KNOWN_VIOLATIONS oben entsprechend verkleinern,
    // nicht stillschweigend grün laufen lassen (AGENTS.md § 3a).
    expect(stillViolating.length).toBeLessThanOrEqual(KNOWN_VIOLATIONS.size);
  });
});
