# Änderungsprotokoll Test-Suite — 2026-08-13

> Snapshot für andere KI-Agenten (Handoff). Archiv — wird nicht mehr editiert.
> Basis-Commit: `f7273c84` (fix(trainer): eine Auflösung für die Trainer-ID)

Dieses Dokument fasst die in dieser Session am Test-System durchgeführten
Änderungen zusammen: Was wurde geändert, warum, und wie es verifiziert wurde.
Ausgangspunkt war das Test-Audit `docs/ARCHIV/2026-08-13-test-audit.md`.

---

## 1. P0-1: Reminder-Platzhalter-Tests durch echte Tests ersetzt

**Ausgangslage (Audit-Befund):** `src/__tests__/api/reminders.test.ts` und
`src/__tests__/use-cases/reminder.use-cases.test.ts` bestanden nur aus
Platzhaltern (`expect(true).toBe(true)`).

**Änderungen:**

| Datei                                                | Änderung                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/__tests__/api/reminders.test.ts`                | 8 echte Route-Tests (Muster `clubs.test.ts`): 403 ohne Admin-Rolle, 429 Rate-Limit, 500 bei Zod-Fehler, Dry-Run-Skip, Happy Path (E-Mail/`memberName`/`courtName`/`clubName`), leere Sessions, Member-not-found, DB-Fehler → 500                                         |
| `src/__tests__/use-cases/reminder.use-cases.test.ts` | 9 echte `ReminderService`-Tests mit injizierten Fakes (Muster `schedule.use-cases.test.ts`): leere Eingaben, Morgen-Datumsfenster via Fake-Timer, Dry-Run, Happy Path inkl. Audit-`action: 'create'`, Member-not-found, E-Mail-Fehler → `failed`, Fortsetzen nach Fehler |
| `app/api/reminders/booking-tomorrow/route.ts`        | **Latenten Bug gefixt:** Die drei `Temp*Repository`-Klassen schluckten Supabase-Fehler still (DB-Fehler → fälschlich 200 mit `total: 0`). Werfen jetzt einen Fehler → 500.                                                                                               |

## 2. P0-3: Tautologische Tests auf echte Imports umgestellt

**Ausgangslage (Audit-Befund):** Drei Testdateien replizierten Produktionslogik
als lokale Kopien („Replicated logic") und testeten nie die echte
Implementierung.

**Änderungen — neue Produktionsmodule (pure Funktionen extrahiert):**

| Datei                                           | Inhalt                                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/season-planning/clustering-utils.ts` (neu) | `timeSlotsOverlap`, `computeNiveauMatchScore`, `sortMembersByPriority`                                                                             |
| `lib/season-planning/conflict-utils.ts` (neu)   | Zeit-Helfer + 7 `detect*`-Regeln (NoCourtAssigned, Trainer-/Member-/Court-DoubleBookings, NoTrainerAssignments, TrainerOverLimit, LargeNiveauSpan) |
| `lib/trainer-availability.ts` (neu)             | Pure Slot-Helfer + `fetchAvailabilitySlots`/`saveAvailabilitySlots`/`applyToAllWeeksInMonth` mit injiziertem `apiFetch`                            |

**Änderungen — Produktion delegiert an die neuen Module (Verhalten exakt erhalten):**

| Datei                                         | Änderung                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `lib/season-planning/clustering-engine.ts`    | private `timeSlotsOverlap`/`computeNiveauMatch` delegieren an `clustering-utils`; Sort inline → `sortMembersByPriority` |
| `lib/season-planning/conflict-detector.ts`    | 7 Regeln delegieren an `conflict-utils`                                                                                 |
| `components/trainer-availability-manager.tsx` | nutzt `lib/trainer-availability` (Integrationstest rendert weiterhin die echte Komponente)                              |

**Änderungen — Tests testen jetzt die echten Imports:**

| Datei                                                           | Änderung                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/__tests__/season-planning/clustering-engine.test.ts`       | umgestellt auf echte Imports; Tautologie-Reste entfernt (`toBe(100)` statt Range-Assertion) |
| `src/__tests__/season-planning/conflict-detector.test.ts`       | umgestellt auf echte Imports; Plan-Entry-Bucket-Semantik korrekt dokumentiert               |
| `src/__tests__/components/trainer-availability-manager.test.ts` | umgestellt auf echte Lib-Imports; `getWeeksInMonth`-Limit konkret (5 für März 2026)         |

## 3. Konsolidierung Doppelstruktur `tests/unit` vs `src/__tests__`

**Ausgangslage (Audit-Befund):** Beide Verzeichnisse liefen in Vitest, drei
Testgegenstände waren dupliziert.

**Entscheidung:** `src/__tests__/` ist der kanonische Baum (alle `tests/unit`-
Dateien nutzten bereits den `@/`-Alias, Test-Infrastruktur lebt dort,
`test:integration`-Script zielt dorthin).

**Änderungen:**

| Änderung                                                     | Details                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 32 Dateien per `git mv` von `tests/unit/` → `src/__tests__/` | reine Verschiebung, keine Import-Umschreibungen nötig (z. B. `tests/unit/api/branding.test.ts` → `src/__tests__/api/branding.test.ts`, `tests/unit/lib/season-planning/clustering-engine.test.ts` → `src/__tests__/lib/clustering-engine.loadMembers.test.ts`) |
| Duplikate zusammengeführt                                    | `tests/unit/billing-calculation.test.ts` + `tests/unit/court-calendar-utils.test.ts` gelöscht (`git rm`); die `src`-Versionen sind kanonisch                                                                                                                   |
| `src/__tests__/lib/court-calendar-utils.test.ts`             | neu geschrieben als Merge beider Fixture-Stile (Berlin-Zeitzonen-Muster); **alle 27 `it()`-Fälle der `tests/unit`-Version nachweislich erhalten** (per `git show` + `comm` verifiziert)                                                                        |
| `src/__tests__/season-planning/clustering-engine.test.ts`    | umbenannt zu `src/__tests__/season-planning/clustering-utils.test.ts` (testet die pure Utils)                                                                                                                                                                  |
| `vitest.config.ts`                                           | `include` auf nur noch `src/__tests__` reduziert (`tests/unit`-Pattern entfernt)                                                                                                                                                                               |
| Docblocks in verschobenen Dateien                            | Pfad-Referenzen auf die neuen `src/__tests__`-Pfade aktualisiert (Route-Tests, `lib/services/*`, `anonymize.service.test.ts`)                                                                                                                                  |
| `src/__tests__/season-planning/audit-log-trigger.test.ts`    | **Nebenbefund-Fix:** kaputter Migrationspfad (4 `..`-Hops statt 3; zeigte auf nicht existierendes `/home/aeugeln/supabase`); auf 3 Hops korrigiert                                                                                                             |

## 4. Billing-Preview-Route reimplementiert + Test auf echte Imports

**Ausgangslage (Audit-Befund):** `src/__tests__/lib/billing-calculation.test.ts`
testete lokale Kopien von `computeBillingPreview`/`computeInvoiceTotals`; die
referenzierte `billing-preview`-Route existierte nicht mehr (in Git `a0557179`
entfernt).

**Änderungen:**

| Datei                                                 | Änderung                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/billing/billing-preview.ts` (neu)                | pure Funktionen `matchFeeConfiguration` (first-match, `trainingGroup` als `string[]` via `includes`, konsistent mit `FeeConfigurationService.calculateFeeForMember`), `computeBillingPreview`, `computeInvoiceTotals` (Line-Item-Tax wie `SeasonBillingService`), `roundCurrency` (bewusste Kopie des privaten Helpers) |
| `app/api/seasons/[id]/billing-preview/route.ts` (neu) | POST; `withApiAuth` + `authorizeSeasonAccess` (Tenant-Isolation, Muster Schwester-Route `billing`); Daten: `season_plan_entries` via `auth.supabase` + `feeConfigurationService.getActiveFeeConfigurations(clubId)` (Drizzle-Adapter); expandiert `expected_participants` → Preview-Item je Mitglied                    |
| `src/__tests__/lib/billing-calculation.test.ts`       | lokale Kopien entfernt; testet jetzt die echten Imports aus `@/lib/billing/billing-preview` (23 Tests inkl. neuer `matchFeeConfiguration`-/`roundCurrency`-Blöcke)                                                                                                                                                      |
| `src/__tests__/api/billing-preview.test.ts` (neu)     | 7 Route-Tests: 403 Tenant-Isolation, 500 DB-Fehler, leere Entries, Fee-Matching durch die Route, Fallback, Teilnehmer-Expansion, `group_id=null`-Defensive                                                                                                                                                              |

**Review-Befunde behoben:** Doku-Kommentar korrigiert (Route reichert
`memberName` nicht an); `installment_count` als Legacy-Kontraktfeld präzisiert
(keine DB-Spalte, Domain-Enum kennt kein `'installment'`); toter
`mockEntriesData`-Code entfernt; `roundCurrency`-Duplikat dokumentiert.

---

## Verifikation (alle Schritte)

| Check                            | Ergebnis                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| Neue Tests (Reminder, Billing)   | ✅ 30/30 bzw. 17/17 grün                                                                 |
| Kompletter Vitest-Lauf           | ✅ **90 Testdateien, 1489 Tests bestanden, 10 geskippt** (Supabase-Integration ohne Key) |
| `tsc --noEmit`                   | ✅ fehlerfrei                                                                            |
| ESLint (alle geänderten Dateien) | ✅ sauber                                                                                |

---

## Offene Punkte / Hinweise für andere KIs

1. **Nicht committet (separate Arbeit dieser Session):** Reminder-Tests
   (P0-1), Tautologie-Extraktion (P0-3), Billing-Preview-Reimplementierung —
   je nach gewünschter Commit-Granularität in eigenen Commits ablegen.
2. **Fremde Änderungen im Working Tree (NICHT von dieser Session, nicht
   anfassen):** `app/(protected)/member/preferences/page.tsx`,
   `app/api/sepa-mandates/route.ts`, `components/command-palette.tsx`,
   `lib/navigation.ts`, `lib/require-feature.ts`, `app/api/members/directory/`,
   `e2e/nav-links-smoke.test.ts`.
3. **`docs/ARCHIV/2026-08-13-test-audit.md`** (untracked) — das zugrunde
   liegende Audit; gehört als eigenes Archiv-Dokument behandelt.
4. **Audit-Punkte noch offen:** `tests/infrastructure/**` wird von Vitest
   nicht ausgeführt (tote Tests), `use-user-data.test.tsx` testet nur
   Export-Existenz, globales Setup-Mocking einschränken,
   `global-setup.ts`-DDL gegen Produktions-DB absichern.
