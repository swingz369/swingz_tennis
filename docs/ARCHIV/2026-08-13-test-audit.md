# Test-Audit SwingZ — 2026-08-13

> Archiv-Snapshot, kein lebendes Dokument. Stand: Branche `refactor/season-auth-helper-adoption`, 13.08.2026.

## TL;DR

- **1466 Tests bestanden, 10 geskippt (90 Testdateien)** — die Suite ist grün und läuft stabil durch (Laufzeit ~132 s).
- **Doch ein Teil der Tests prüft nichts Echtes:** Mehrere Dateien testen **lokale Kopien** der Produktionslogik („Replicated logic“) statt der echten Implementierung — diese Tests sind tautologisch und können nie die echte Logik brechen.
- **`tests/infrastructure/**` wird von Vitest gar nicht ausgeführt** (fehlt in den `include`-Patterns) — die beiden Repository-Testdateien sind tote Tests.
- **`src/__tests__/api/reminders.test.ts` besteht komplett aus Platzhaltern** (`expect(true).toBe(true)`).
- **Doppelstruktur:** `tests/unit/` und `src/__tests__/` existieren parallel; mindestens 3 Duplikate desselben Testgegenstands (clustering-engine, court-calendar-utils, billing-calculation).
- **Stärken:** Die API-Routen-Tests (clubs, training-groups, confirm-publish, features), die Auth-/Tenant-Helper-Tests (season-auth, resolve-active-club, trainer-record) und die Finanz-/Rechts-Logik-Tests (iban, verzugszins, elo) sind ausführlich und von hoher Qualität.

---

## 1. Testlauf-Status

| Metrik               | Wert                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Testdateien (Vitest) | 90 gefunden / ausgeführt                                                                      |
| Tests bestanden      | 1466                                                                                          |
| Tests geskippt       | 10 (Supabase-Integrationstests ohne Service-Key)                                              |
| Laufzeit             | ~132 s                                                                                        |
| Playwright-E2E       | 32 Specs × 6 Browser-Projekte (chromium, firefox, webkit, mobile-chrome, mobile-safari, ipad) |
| Vitest-Browser-E2E   | 6 Dateien unter `e2e/`, nur via `RUN_BROWSER_E2E=true` aktiv                                  |

Die 10 Skipped sind die Integrationstests (`billing-engine`, `payment-flow`, `rls-policies`, `stripe-webhook`, `trial-training-stats`), die ohne `SUPABASE_SERVICE_ROLE_KEY` per `describe.skip` ausweichen. Das ist dokumentiert und funktioniert — aber es bedeutet: **ohne CI-Secrets läuft ein erheblicher Teil der kritischen Billing-/Payment-/RLS-Pfade nie.**

---

## 2. Kritische Befunde (Tests, die nichts prüfen)

### 2.1 Platzhalter-Tests (`expect(true).toBe(true)`) — zwei Dateien

`src/__tests__/api/reminders.test.ts`:

```ts
it('should return 401 if not authenticated', async () => {
  // Test will be implemented when auth mocking is set up
  expect(true).toBe(true);
});
```

Alle 3 Tests (401, 403, „trigger reminders“) sind `expect(true).toBe(true)`. Die Route `POST /api/reminders/booking-tomorrow` wird nie importiert, nichts wird geprüft.

`src/__tests__/use-cases/reminder.use-cases.test.ts`: dasselbe Muster — 2 Tests („empty array when no sessions found“, „send reminders for confirmed bookings“) sind Platzhalter mit `expect(true).toBe(true)`. Auch die gemockten `EmailService`/`AuditService`-Klassen werden nie aufgerufen.

**Empfehlung:** echte Tests nach dem Vorbild von `clubs.test.ts`/`training-groups.test.ts` bzw. `schedule.use-cases.test.ts` schreiben (Chain-Mocks für Supabase + Auth) oder die Dateien löschen. Platzhalter-Tests sind gefährlicher als keine Tests — sie suggerieren Abdeckung.

### 2.2 `tests/infrastructure/repositories/*.test.ts` — werden nie ausgeführt

Die `include`-Patterns in `vitest.config.ts` decken nur `src/**/__tests__/**/*.test.{ts,tsx}` und `tests/unit/**/*.test.{ts,tsx}` ab. Verifikation:

```
$ npx vitest run tests/infrastructure/
No test files found, exiting with code 1
include: src/**/__tests__/**/*.test.{ts,tsx}, tests/unit/**/*.test.{ts,tsx}
```

Die zwei Dateien (`billing.repository.test.ts`, `member.repository.test.ts`) testen echte Drizzle-Repositories **gegen eine echte DB, die im Test nie gemockt wird** (`afterEach` ist nur `// TODO: Implement cleanup`). Selbst wenn sie in den include aufgenommen würden, schlügen sie ohne DB-Zugriff fehl. **Empfehlung:** entweder Repositories mit gemocktem Drizzle-DB-Objekt testen (Muster: `src/__tests__/lib/load-config.test.ts`) oder als echte Integrationstests mit Test-DB führen und in den include aufnehmen.

### 2.3 Tautologische Tests — lokale Kopien statt echter Implementierung

Mehrere Dateien definieren die Produktionslogik **im Test neu** und testen dann die Kopie. Solche Tests sind immer grün, unabhängig davon, ob die echte Logik bricht.

| Datei                                                                                      | Problem                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/__tests__/components/trainer-availability-manager.test.ts`                            | Kommentar sagt es selbst: „Replicated pure logic from trainer-availability-manager.tsx“. `addCustomSlot`, `removeSlotById`, `togglePresetSlot`, `fetchSlots`, `saveSlots` sind alle als Test-lokale Funktionen neu geschrieben. Die echte Komponente `trainer-availability-manager.tsx` wird nie getestet. |
| `src/__tests__/season-planning/clustering-engine.test.ts`                                  | `computeNiveauMatch`, `timeSlotsOverlap`, Sortier- und Auslastungs-Logik werden im Test neu implementiert und getestet — nicht `SeasonClusteringEngine`.                                                                                                                                                   |
| `src/__tests__/season-planning/conflict-detector.test.ts`                                  | `timeStringToMinutes`, `timeSlotsOverlap`, Trainer-/Mitglieds-/Court-Doppelbelegungslogik werden im Test neu geschrieben. `ConflictDetector` aus `@/lib/season-planning/conflict-detector` wird nicht importiert.                                                                                          |
| `src/__tests__/lib/billing-calculation.test.ts` + `tests/unit/billing-calculation.test.ts` | Beide definieren `computeBillingPreview`/`calcPreview` eigenständig neu (Kommentar: „mirrors the inlined calculation in the billing-preview route“). Die echte Route wird nicht getestet. Zusätzlich sind die beiden Dateien Duplikate voneinander.                                                        |

**Empfehlung (wichtigste strukturelle Verbesserung im ganzen Audit):** Die echte Logik aus der Produktion extrahieren (reine Funktionen in `lib/` exportieren) und die Tests gegen den Import schreiben. Das Muster existiert bereits vorbildlich in `tests/unit/lib/services/elo.test.ts` und `tests/unit/lib/verzugszins.test.ts` — dort wird `@/lib/...` importiert und echtes Verhalten geprüft.

### 2.4 `src/__tests__/hooks/use-user-data.test.tsx` — testet nur Export-Existenz

```ts
it('should export useUserClub', async () => {
  const { useUserClub } = await import('@/hooks/use-user-data');
  expect(typeof useUserClub).toBe('function');
});
```

Vier Tests prüfen lediglich, dass Exports existieren — kein einziges Verhalten (z. B. Query-Key, Fehlerfall, Datenrückgabe). Vergleich: `use-user-role.test.ts` im selben Ordner ist dagegen exzellent. **Empfehlung:** entweder nach dem Vorbild von `use-user-role.test.ts` ausbauen oder löschen.

### 2.5 `src/__tests__/lib/cache.test.ts` — testet nur Konstanten-Existenz

Alle Tests prüfen nur `toHaveProperty` und Größenrelationen von `QUERY_KEYS`/`CACHE_TIMES`/`STALE_TIMES`. Das ist kein Verhaltens-Test, sondern eine Konfigurations-Plausibilitätsprüfung — der einzige Nutzen ist, versehentliches Löschen von Keys zu verhindern. **Empfehlung:** als „config integrity“-Test kennzeichnen oder mit echten Query-Factory-Funktionen (z. B. `queryKeyFor('bookings', clubId)`) anreichern, falls solche existieren.

---

## 3. Strukturelle Befunde

### 3.1 Doppelstruktur `tests/unit/` vs. `src/__tests__/`

Zwei parallele Testbäume mit unterschiedlichen Konventionen. Belegte Duplikate:

- `src/__tests__/lib/clustering-engine.test.ts` (loadConfig) + `src/__tests__/season-planning/clustering-engine.test.ts` (Kopie) + `tests/unit/lib/season-planning/clustering-engine.test.ts` (echte `loadMembers`-Regression) → **dreifach**.
- `src/__tests__/lib/court-calendar-utils.test.ts` + `tests/unit/court-calendar-utils.test.ts` → doppelt, gleicher Gegenstand (`getSlotStatus`), unterschiedliche Fixtures.
- `src/__tests__/lib/billing-calculation.test.ts` + `tests/unit/billing-calculation.test.ts` → doppelt.
- Trainer-Availability wird an **5 Stellen** behandelt: `src/__tests__/components/trainer-availability-manager.test.ts`, `.integration.test.tsx`, `e2e/trainer-availability.test.ts`, `tests/e2e/trainer-hours-approval-flow.spec.ts`, `tests/e2e/tutorial-trainer-availability.spec.ts`.

**Empfehlung:** eine Struktur wählen (z. B. alles unter `tests/unit/`, `tests/integration/`, `tests/e2e/`; `src/__tests__` auflösen) und Duplikate zusammenführen. Die Doppelungen blähen außerdem die Coverage-Zahlen künstlich auf (Thresholds: lines/functions/statements 60, branches 55).

### 3.2 Globales Setup-Mocking kann Tests maskieren

`src/__tests__/setup.ts` mockt **global** `next-intl`, `next/navigation`, `@/lib/supabase` und `@tanstack/react-query` (`useQuery`/`useMutation` immer gemockt). Vorteil: Komponenten-Tests brauchen kein Setup. Nachteil: Jede Komponente, die echtes Query-Verhalten braucht (Refetch, Cache, isLoading-Zustände), bekommt es hier nicht; Tests können grün sein, obwohl die echte Datenanbindung defekt ist. **Empfehlung:** nur dort global mocken, wo wirklich nötig; für Query-Verhalten lokale Mocks mit expliziten Rückgabewerten (Muster: `readiness-check.test.tsx`).

### 3.3 `global-setup.ts` führt DDL auf `DATABASE_URL` aus

Wenn `DATABASE_URL` gesetzt ist, führt das Global-Setup `drizzle-kit push` aus und wendet zusätzlich idempotentes DDL an (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`). Das ist für eine **Test-DB** gedacht und dokumentiert. **Achtung:** zeigt `.env.local` auf eine Nicht-Test-DB, verändert ein schlichter `pnpm test` die Schema-Struktur der DB. **Empfehlung:** hart gegen Produktions-URLs absichern (z. B. nur `swingz_test`/`.test`-Suffixe zulassen oder eigenes Test-DB-Env erzwingen).

### 3.4 Playwright: 6 Browser-Projekte, 32 Specs

`playwright.config.ts` definiert chromium + firefox + webkit + 2 Mobile-Profile + iPad. Das multipliziert jede Spec ×6 und verlängert CI erheblich. Zudem gibt es inhaltliche Überlappungen zwischen `admin-workflows.spec.ts`, `admin-features-flow.spec.ts`, `qa-audit-full.spec.ts`, `navigation-helpers.spec.ts`/`navigation-flows.spec.ts`, `role-access.spec.ts`/`role-access-sidebar.spec.ts` sowie 9 `tutorial-*`-Specs. **Empfehlung:** Basissuite nur auf chromium + mobile-chrome, die restlichen Browser in einen Nightly-/Weekly-Lauf oder per `--project`-Filter auslagern; redundante Specs konsolidieren.

### 3.5 Sonstiges

- `src/__tests__/domain/aggregates/event-sourced-club.test.archive.txt` — eine Testdatei als `.txt` im Testbaum (läuft nicht, ok, aber verwirrend platziert).
- `tests/bench/.scaling-results.json` und `tests/e2e/.clustering-perf-results.json` sind Artefakte im Repo-Baum — prüfen, ob gitignored.
- `tests/unit` hängt still am Setup aus `src/__tests__/` (`setup.ts`, `test-utils.tsx`, `mocks/server-only.ts`) — die beiden Bäume sind nicht unabhängig, was die Zusammenführung zusätzlich rechtfertigt.
- Die `e2e/**/*.test.ts`-Vitest-Browser-Tests sind sauber per Env-Flag (`RUN_BROWSER_E2E`) vom Standardlauf getrennt und dokumentiert — gut so.

---

## 4. Positiv-Befunde (Vorbilder im Repo)

- **API-Tests mit Chain-Mocks:** `clubs.test.ts`, `training-groups.test.ts`, `generate-invoices.test.ts`, `clubs-features.test.ts` — testen echte Routes, echte Statuscodes, Tenant-Isolation (superadmin-scoping!), Pagination-Offsets, Idempotenz, Fehlerpfade.
- **`confirm-publish.test.ts`:** sehr gründlich — Transaktions-Rollback für 5 verschiedene Fehlerszenarien, NaN-sichere Datums-Fallbacks, Holiday-Skipping, E-Mail-Versand, kritische Konflikte (409 vs. acceptedWarnings). Kommentare dokumentieren die Business-Regeln.
- **Auth-/Tenant-Helper:** `season-auth.test.ts`, `resolve-active-club.test.ts`, `trainer-record.test.ts` — prüfen echte Helper mit echten Grenzfällen (IDOR, cookie-no-membership, Legacy-ID-Auflösung).
- **Pure-Function-Tests:** `iban.test.ts`, `tests/unit/lib/verzugszins.test.ts` (BGH-Inklusiv-Tage, DST, Stichtage), `tests/unit/lib/services/elo.test.ts`, `tests/unit/lib/berlin-time.test.ts` — mathematisch nachvollziehbare Erwartungswerte mit kommentierter Herleitung.
- **Regression-Guards mit Kontext:** `tests/unit/api/branding.test.ts` und `tests/unit/lib/season-planning/clustering-engine.test.ts` dokumentieren den historischen Bug und prüfen den Fix gegen die echte Implementierung.
- **ESLint-Regel-Test:** `eslint/pagination-nav-mutually-exclusive-props.test.ts` nutzt `RuleTester` korrekt (valid/invalid-Cases, Message-IDs, Namespacing).
- **`prefers-reduced-motion.spec.ts`:** methodisch sehr gründlich (CDP-Emulation, Computed-Style-Checks, Layout-Shift-Messung).

---

## 5. Priorisierte Verbesserungsvorschläge

### P0 — Sofort (falsche Sicherheit, tote Tests)

1. **Beide Reminder-Platzhalterdateien** (`src/__tests__/api/reminders.test.ts` und `src/__tests__/use-cases/reminder.use-cases.test.ts`) entweder vollständig umsetzen (Vorbilder: `clubs.test.ts`, `schedule.use-cases.test.ts`) oder löschen. Keine `expect(true).toBe(true)`-Platzhalter im Repo.
2. **`tests/infrastructure/repositories/`** entweder mit DB-Mocks testbar machen oder als echte Integrationstests mit Test-DB in die `include`-Patterns aufnehmen. Aktuell suggerieren sie Repository-Abdeckung, die es nicht gibt.
3. **Tautologische Tests auflösen:** Die echte Logik aus `trainer-availability-manager.tsx`, `clustering-engine.ts`, `conflict-detector.ts` und der Billing-Preview-Route in exportierte, reine Funktionen extrahieren; Tests importieren und gegen diese schreiben. Danach die Test-lokalen Kopien entfernen.

### P1 — Wichtige Qualitätslücken

4. **`use-user-data.test.tsx`** zu echten Verhaltenstests ausbauen (Query-Key-Form, Fehlerfall, Datenpfad) oder löschen.
5. **Integrationstests in CI sicherstellen:** Entweder Supabase-Test-Instanz in CI provisionieren oder die 10 geskippten Tests so umbauen, dass die kritischen Pfade (Payment, RLS, Stripe-Webhook) wenigstens mit Mocks in jedem Lauf laufen.
6. **`global-setup.ts`** absichern: DDL/Drizzle-Push nur auf Test-DB-URLs zulassen (Guard gegen Produktions-`DATABASE_URL`).

### P2 — Struktur & Effizienz

7. **Testbaum konsolidieren:** Eine Struktur (z. B. `tests/unit|integration|e2e`), `src/__tests__` auflösen, 3 Duplikate zusammenführen, Trainer-Availability-Tests auf 1 Unit + 1 E2E reduzieren.
8. **Playwright-Matrix verkleinern:** Standardlauf auf chromium + mobile-chrome; firefox/webkit/iPad in einen separaten Profil-Lauf.
9. **Setup-Mocks reduzieren:** `@tanstack/react-query` nur in Tests mocken, die es brauchen; `setup.ts` schlank halten.
10. **Coverage sinnvoll nutzen:** Nach Konsolidierung Thresholds nachmessen (aktuell durch Duplikate künstlich erfüllt) und ggf. auf die realen, hochwertigen Bereiche schärfen.
11. `tests/bench/.scaling-results.json`, `tests/e2e/.clustering-perf-results.json` und die `.archive.txt`-Testdatei aus dem Testbaum räumen bzw. gitignoren.

---

## 6. Anhang: Vollständige Testinventur (Stand 13.08.2026)

**Vitest — `src/__tests__/` (90 Dateien im Lauf):**

- `api/` (8): clubs ✓, clubs-features ✓, reminders ✗ Platzhalter, generate-invoices ✓, confirm-publish ✓, confirm-publish-rate-limit ✓, training-groups ✓, phase2-5-routes ✓ (sehr groß)
- `lib/` (15): billing-engine (Integration, skip ohne Key), validation-helpers ✓, features ✓ (regt echte `@/lib/features`-Logik an; 2 Contract-Tests sind No-Ops), session-participants ✓✓ (Regression-Guard mit dokumentiertem Bug), season-auth ✓, iban ✓, resolve-active-club ✓, load-config ✓, trainer-record ✓, court-calendar-utils (Duplikat), pain008-generator, cache ✗ nur Konstanten, navigation-utils ✓, clustering-engine (Duplikat), billing-calculation (Duplikat/tautologisch)
- `entities/` (3): booking ~ (Cancellation-Policy-Test schwach), club ✓, schedule ✓
- `use-cases/` (4): booking ✓, club-analytics, schedule ✓ (OptimizeScheduleUseCase mit echten Mocks, Fehlerpfade), reminder ✗ Platzhalter
- `services/` (3): scheduling, court, validation ✓
- `season-planning/` (6): conflict-detector ✗ Kopie, readiness-check ✓, schedule-grid, group-list-view, use-schedule-plan ✓, clustering-engine ✗ Kopie
- `integration/` (5): payment-flow, rls-policies, stripe-webhook, trial-training-stats, statistics-dashboard (alle skip ohne Supabase-Key; statistics-dashboard prüft echte Service-Logik mit gemockten Adaptern)
- `hooks/` (2): use-user-role ✓, use-user-data ✗ nur Exports
- `components/` (6): audit-log-viewer, stat-card ✓, trainer-availability-manager ✗ Kopie, .integration ✓, error-states ✓, attendance-history
- `value-objects/` (2): scheduleweek, timeslot ✓
- `i18n/` (1): dictionaries ✓ (inkl. Schlüssel-Symmetrie-Check)
- `validation/` (1): reminders.schema
- `eslint/` (1): ✓

**Vitest — `tests/unit/` (~30 Dateien):** überwiegend hohe Qualität (elo, verzugszins, berlin-time, csv-export, rsvp-status, season-tenant-isolation, branding, dry-run.helpers, …). Duplikate: court-calendar-utils, billing-calculation, clustering-engine.

**Vitest — `tests/infrastructure/` (2):** ✗ werden nicht ausgeführt, brauchen echte DB.

**Playwright — `tests/e2e/` (32 Specs):** auth ✓, role-access, trainer-hours-approval, prefers-reduced-motion ✓✓, clustering-performance, onboarding-wizard, sidebar-structure, season-planning-flow, phase2-5-pages, all-pages-render, stripe-checkout, page-transitions, admin-workflows, qa-audit-full, admin-features-flow, modal-centering, navigation-flows, mobile-responsiveness, members-crud-flow, billing-flow + 9 `tutorial-*`. Teilweise redundant (siehe 3.4).

**Vitest-Browser — `e2e/` (6):** layout-loader-smoke, trainer-availability, design-preview-* (4). Nur mit `RUN_BROWSER_E2E=true`.
