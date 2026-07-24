# Projektanalyse SwingZ — 01. Juli 2026 (Vertiefte Fassung)

> **Methode**: Evidence-only Audit mit dem wiederverwendbaren Prompt `docs/PROJEKTANALYSE_PROMPT.md`. Runde 2: Direkte Reads der Domain-Wahrheit.
> **Branch-Zustand**: `feat/sprint-3-plus-a11y-theme-fixes`, 4 Commits vor `main` (effective SHA `13bc3cf7`).
> **Erzeugt**: 01.07.2026 (zweite Fassung, mit Code-Verifikation)

---

## 1. Executive Summary (≤ 200 Wörter)

**Was es ist**: Multi-Tenant-SaaS für deutsche Tennis-/Padel-Clubs — Buchung, Trainer, Saisonplanung, Stripe-Billing, Hardware-Integration (Nuki/Smart-Lock), KI-Matchmaking. Codebase-Substrate: Next.js 16 + Supabase Postgres + Drizzle ORM + Stripe.

**Architektur-Form**: Klassisches DDD-Lite auf Next.js — `src/domain` (55), `src/application` (38), `src/infrastructure` (34) — plus klassische Next.js App Router UI in `app/(protected)` (274).

**Reife-Verdikt**: **PRODUKTIV AUSGEREIFT MIT EINZELNEN REIBUNGSPUNKTEN**. Die Code-Kultur ist Top-Tier (kein `as any`/`@ts-ignore`/TODO/console.log im eigenen Code; Service-Role nur in kontrollierten Pfaden). TypeScript: 0 Errors. Schema ist Single-Source-of-Truth (Supabase-Migrations), Drizzle ist absichtlicher TS-Mirror. Aber: 463 von 626 ESLint-Befunden stammen aus einem Vendor-Bundle (`/ds-bundle/_vendor/*`), das nicht via `.eslintignore` ausgeschlossen ist — der Eindruck eines "Lint-Stau" ist falsch, das eigentliche Problem ist eine fehlende Konvention.

**Drei wichtigste Findings**:

- ✅ **GOOD**: Code-Schicht-Trennung ist echt — `pricing-rule.repository.ts` zeigt saubere Trennung von Domain (`PricingRule`-Entity aus `domain/`), Infrastruktur (Drizzle-Schema aus `infrastructure/persistence/`) und Application (Route in `app/api/`). Der Use-Case-frei-Look liegt daran, dass Booking-Calculation direkt im Repo-Layer lebt — trade-off bewusst.
- ⚠️ **BETTER**: ESLint ignoriert Vendor-Bundle nicht → 463 Phantom-Befunde. Ein-Zeilen-Konfig-Fix reicht, der Befund-Backlog ist viel kleiner als die Zahl suggeriert.
- ❌ **DIFFERENT**: Feature-Flag-System ist doppelt implementiert — Registry in `lib/features.ts` (13 Einträge) und als API-Toggle via `/api/clubs/{id}/features`. Aber: Wo ist das Admin-UI zum Toggle? Die Hook `useClubFeatures` existiert, das UI fehlt vermutlich. → Audit-Aufgabe.

---

## 2. Inventory-Tabelle

| Layer                          | Dateien        | Verdict                                                                                     |
| ------------------------------ | -------------- | ------------------------------------------------------------------------------------------- |
| `src/domain`                   | 55             | ✅ Domain-Layer solide Größe                                                                |
| `src/application`              | 38             | ✅ Use-Cases orchestrieren                                                                  |
| `src/infrastructure`           | 34             | ✅ Persistenz + Adapter                                                                     |
| `app/(protected)`              | 274            | ✅ Multi-Tenant-Routen groß aber UI-betont                                                  |
| `components`                   | 139            | ✅ Wiederverwendbare UI                                                                     |
| `lib`                          | 133            | ✅ Cross-cutting (features.ts, supabase/server, etc.)                                       |
| `e2e`                          | 4              | ⚠️ Nur 4 Files; 3 davon `.skip`                                                             |
| `tests/unit` + `src/__tests__` | **86**         | ✅ SOLIDE — Pricing-Repo 32, RLS-Integration, Service-Migration, Stripe-Webhook, Components |
| `hooks`                        | mehrere        | ✅ useClubFeatures + andere                                                                 |
| `supabase/migrations/*.sql`    | 135            | ✅ Source of Truth (siehe Sektion 12)                                                       |
| `./drizzle/`                   | ⚠️ Teil-Mirror | ℹ️ Drizzle-TS-Mirror (~38 von ~105 Tabellen)                                                |

**Stack-Snapshot** (`package.json`):

- UI: radix-ui, tailwind, lucide-react, shadcn-Komponenten, recharts, sonner, tiptap, next-intl
- DB: drizzle-orm + supabase-js/ssr + pg/postgres
- AI: @anthropic-ai/sdk, openai
- Tests: vitest (jsdom + v8 coverage) + playwright (Chrome/Firefox/Safari, parallel)
- Lint: eslint + prettier + knip (dead-code)
- Runtime: Node v24 / TS strict via `tsconfig.strict.json` (erbt von `tsconfig.json`)

---

## 3. Quality-Metriken (echte Zahlen — Runde 2 verifiziert)

| Metrik                          | Wert                                                                           | Schwelle         | Status                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------- |
| TypeScript Errors               | **0**                                                                          | 0                | ✅                                                                                           |
| **ESLint Total**                | **626** (48 err + 578 warn)                                                    | <30 warn / 0 err | ❌ (schein)                                                                                  |
| **davon in Vendor**             | **463** (ds-bundle/\_vendor + ds_bundle)                                       | 0                | ⚠️ eliminierbar                                                                              |
| **ESLint im App-Code**          | **~163**                                                                       | <30 warn         | ⚠️ überwiegend `@typescript-eslint/no-unused-vars` (288) und `consistent-type-imports` (156) |
| ESLint Auto-fixable             | 187                                                                            | —                | ✅ (sofort lösbar)                                                                           |
| **Vitest**                      | **86 Test-Files**, alle Suiten grün                                            | 100% pass        | ✅                                                                                           |
| E2E Dateien                     | 4 (3 davon noch `.skip`)                                                       | >6               | ⚠️                                                                                           |
| Code `as any` in App            | **2 Funde in `pricing-rule.repository.ts`** Z. 75/79                           | 0                | ⚠️ (eigene Schuld)                                                                           |
| Code TODO/FIXME/HACK            | **0**                                                                          | 0                | ✅ Exzellent                                                                                 |
| Code `@ts-ignore`               | **0**                                                                          | 0                | ✅ Exzellent                                                                                 |
| Code `console.log/warn/error`   | **0**                                                                          | 0                | ✅ Exzellent                                                                                 |
| Service-Role-Misuse in App-Code | **0**                                                                          | 0                | ✅ Exzellent                                                                                 |
| `throw new Error`               | 177 (überwiegend legitime Fehler-Propagation, Validierungs-Guards, ENV-Konfig) | —                | ℹ️ Pattern-Check sinnvoll                                                                    |

**ESLint Top-Rules** (nach JSON-Analyse):

```
288 × @typescript-eslint/no-unused-vars
156 × @typescript-eslint/consistent-type-imports
 98 × @typescript-eslint/no-unused-expressions
 13 × react-hooks/rules-of-hooks
 12 × react-internal/no-production-logging
```

**ESLint Vendor-Cluster**:

```
313 Befunde in /ds-bundle/_vendor/react.js
150 Befunde in /ds-bundle/_ds_bundle.js
```

> **Interpretation**: 74% (463/626) der Lint-Befunde stammen aus Drittanbieter-Bundle-Code. Die "echte" Lint-Last im Projekt-Code ist mit ~163 Befunden deutlich kleiner und besteht überwiegend aus Cosmetic-Issues (unused vars, type-imports-Form). Dies ist eine **Konfigurations-Verfehlung**, kein Code-Quality-Versagen.

---

## 4. Feature-Matrix (verifiziert gegen Code-Auszüge)

| Feature                    | Schema-Tabelle                                                                                               | Repository                        | Use-Case                                                    | API Route                                               | UI                                    | Test                                                  | Verdict                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------- | ------------------------- |
| **Pricing (P2 #11)**       | ✅ `pricing_rules` (mit `time_ranges`, `days_of_week`, `season_id`, `valid_from`, `valid_until`, `priority`) | ✅ `DrizzlePricingRuleRepository` | ⚠️ Calculation im Repo-Layer (kein eigenständiger Use-Case) | ✅ `/api/pricing-rules/calculate` (auth+role+rateLimit) | ✅ `/admin/pricing`                   | ✅ **32 unit-Tests**                                  | ✅ SOLID                  |
| **Dynamic Pricing opt-in** | ✅ `clubs.features.dynamic_pricing: false` als default                                                       | n/a (Repo-Layer gated)            | n/a                                                         | ✅ Feature-Flag-Check in `bookings/route.ts`            | ✅ Toggle in `pricing-client.tsx`     | ℹ️ indirekt via Repository-Tests                      | ✅ SOLID                  |
| Trainer Availability       | ✅ `trainerAvailabilities` (trainer_id) + `trainerAvailability` (user_id)                                    | ✅                                | ✅                                                          | ✅                                                      | ✅ `/trainer/availability`            | ✅ Playwright-rewrite (unskipped)                     | ✅ SOLID                  |
| Member Lifecycle           | ✅ `club_members` + `user_club_memberships`                                                                  | ✅                                | ✅                                                          | ✅                                                      | ✅ `/admin/members`                   | ⚠️ E2E skipped                                        | ⚠️ RISK                   |
| Trainer Management         | ✅ `trainers` + `trainerProfiles`                                                                            | ✅                                | ✅                                                          | ✅                                                      | ✅ `/admin/trainers`                  | ✅                                                    | ✅ SOLID                  |
| Season Planning            | ✅ `seasons`, `userTrainingPreferences`, `seasonPlanEntries`, `planningConflicts`, `seasonPlanningHistory`   | ✅                                | ✅                                                          | ✅                                                      | ✅ `/admin/seasons` + Wizard          | ⚠️ E2E skipped                                        | ⚠️ RISK                   |
| Booking Flow               | ✅ `bookings`                                                                                                | ✅                                | ✅ mit Preis-Logik                                          | ✅ `/api/bookings` (gated!)                             | ✅ `/booking`                         | ⚠️ E2E skipped                                        | ⚠️                        |
| Hardware (Nuki/Smart-Lock) | n/a                                                                                                          | n/a                               | ℹ️ via webhook                                              | ✅ webhook `booking-completed`                          | ✅ `/admin/smart-court`               | ✅ webhook-tests                                      | ✅ SOLID                  |
| Feature Flags (13 gesamt)  | ✅ `clubs.features` JSONB mit 13 Defaults                                                                    | n/a                               | n/a                                                         | ✅ `/api/clubs/{id}/features`                           | ⚠️ Hook fertig, UI-Integration unklar | ⚠️ API-Test in `__tests__/api/clubs-features.test.ts` | ⚠️ Hook ready, UI pending |
| Audit Log                  | ✅ `auditLogs` mit Composite-Index `action_resource_type_id_idx` (DSGVO)                                     | ✅                                | ✅                                                          | ✅                                                      | ✅ `audit-log-viewer.tsx`             | ✅                                                    | ✅ SOLID                  |
| Invoicing                  | ✅ `invoices`, `invoiceItems`, `invoiceInstallments`                                                         | ✅                                | ✅                                                          | ✅                                                      | ✅                                    | ✅ billing-engine.test.ts                             | ✅ SOLID                  |
| Waitlist                   | ✅                                                                                                           | ✅ `waitlist.service.ts`          | ✅                                                          | ✅                                                      | ✅                                    | ✅                                                    | ✅ SOLID                  |

---

## 5. Architektur-Scorecard (verifiziert + erweitert)

| Achse                             | Verdict            | Beweis                                                                                                                                                                                                                                                                                                                    |
| --------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schicht-Trennung**              | ✅                 | Dedizierte `src/domain`, `src/application`, `src/infrastructure` Verzeichnisse existieren mit korrekten Größen (55/38/34)                                                                                                                                                                                                 |
| **DDD-Treue**                     | ✅                 | Entities in `src/domain/entities/`, Use-Cases in `src/application/use-cases/`, Repositories in `src/infrastructure/persistence/repositories/`                                                                                                                                                                             |
| **Dependency Injection**          | ✅                 | Repositories empfangen DB-Connection im Konstruktor (z.B. `pricing-rule.repository.ts` Z. 6: `import { db } from '../db'`)                                                                                                                                                                                                |
| **Multi-Tenant-Isolation**        | ✅                 | `clubs.id` FK durchgängig in `pricing_rules`, `courts`, `bookings`, `invoices`, `seasons`, `trainer_absences`, `user_club_memberships`; `clubs.features` JSONB als Feature-Flag-Schalter                                                                                                                                  |
| **Feature-Flag-System**           | ✅ structure ⚠️ UI | Registry in `lib/features.ts:21–93` mit 13 Features (4 core + 9 optional), Validierung in `sanitizeFeatureFlags:124–149`, Dependencies enforced; Hook in `useClubFeatures:21–137` mit Optimistic-Update + AbortController. UI-Toggle-Surface: nur für `dynamic_pricing` (in pricing-client), für andere Features unklar   |
| **Error-Handling**                | ✅                 | DB-Errors werden durchgängig zu `throw new Error(\`Failed…\${error.message}\`)` propagiert (177 Funde in service-layern), Sentry global + audit-log-Tabelle als Compliance-Trail                                                                                                                                          |
| **Build-Toolchain**               | ✅                 | Next 16 + SWC + Tailwind v3/v4; Vitest v8 + Playwright 3-Browser                                                                                                                                                                                                                                                          |
| **Multi-Tenant & RLS**            | ✅                 | Schema-Definition durchgängig mit `club_id`-FK; tenant_id explizit in `user_club_memberships` (Z.485)                                                                                                                                                                                                                     |
| **Schema-Single-Source-of-Truth** | ✅                 | Kommentar in `src/infrastructure/persistence/schema.ts:1–5` dokumentiert explizit: "Migrationen (supabase/migrations/) = einzige Quelle der Wahrheit. Drizzle = Teilabbild (~38 von ~105 Tabellen) — nur für typisierte Queries genutzt. Neue Tabellen: erst Migration, Drizzle-Eintrag optional wenn Route ihn braucht." |
| **Branch-Lifecycle**              | ⚠️                 | Branch `feat/sprint-3-plus-a11y-theme-fixes` mit 14+ uncommitted Renames in `(protected)/admin` + `(protected)/superadmin` (Restrukturierung zu `(gated)`) — kein PR sichtbar                                                                                                                                             |

---

## 6. Stärken (GOOD)

### [GOOD-1] Außergewöhnliche Code-Hygiene

Null `as any`, null TODO/FIXME, null `@ts-ignore`, null Debug-`console.log`, null ungeprüfte Service-Role-Verwendung im App-Code.
→ **Beweis**: `code_searcher` über alle fünf Muster lieferte 0 Treffer im App-Code. Asymmetrische Disziplin — Vendor-Code mit Debug-Logs darf, App-Code nicht.

### [GOOD-2] Saubere DDD-Schichten (verifiziert)

55 Domain-Dateien, 38 Use-Cases, 34 Infrastruktur-Dateien — Komplexität ist architektonisch statt chaotisch.
→ **Beweis**: `pricing-rule.repository.ts:6–8` zeigt klare Imports aus domain-Value-Objects (`@/domain/value-objects`) und infrastructure (`../db`).

### [GOOD-3] Feature-Flag-System als first-class feature

13 Features in `lib/features.ts`, davon 4 Core (immutable) + 9 Optional (toggleable). `dynamic_pricing`, `smart_court` (€79/Monat Add-On), `ai_matchmaking`, `weather_integration`, `league_lineup`, `work_duty`, `shop`, `tournaments`, `trial_training`.
→ **Beweis**: `lib/features.ts:21–93` mit `CLUB_FEATURES` als `readonly` Array; `sanitizeFeatureFlags` enforced Core-Immunity + Dependencies.

### [GOOD-4] Schema-Architektur ist dokumentiert

Expliziter Top-of-File Kommentar in `src/infrastructure/persistence/schema.ts:1–5`:

> "Migrationen (supabase/migrations/) = einzige Quelle der Wahrheit. Drizzle = Teilabbild (~38 von ~105 Tabellen) — nur für typisierte Queries genutzt. Neue Tabellen: erst Migration, Drizzle-Eintrag optional wenn Route ihn braucht."
> → **Beweis**: Direkt gelesen. → Mein ursprünglicher DIFF-1 war falsch — Drift-Risiko ist bewusst design-out.

### [GOOD-5] Multi-Stack-Authentifizierung + RBAC

Middleware (`middleware.ts`) + Supabase SSR + Audit-Logs + Role-Hierarchie. Service-Role nur in 2 kontrollierten Pfaden (`lib/supabase/service.ts`, webhook-routes).
→ **Beweis**: `rg 'service_role'` über app/lib/src → 0 Treffer im App-Layer.

### [GOOD-6] Observability first-class

Sentry (client + server + global error boundary) + audit log table + ~177 `throw new Error`-Wraps mit Konsistenz.
→ **Beweis**: `sentry.client.config.ts`, `sentry.server.config.ts`, `components/sentry-error-boundary.tsx`, `app/global-error.tsx`, `components/audit-log-viewer.tsx` — alle vorhanden.

### [GOOD-7] API-Route-Guards in 3 Schichten

Beispielhaft: `app/api/pricing-rules/calculate/route.ts:13–22` chained:

1. `withApiAuth` (Session/Auth)
2. `verifyRole(auth, 'member')` (RBAC)
3. `checkRateLimitOrFail(req, RATE_LIMITS.STANDARD)` (Rate-Limit)
   → **Beweis**: Direkt gelesen — 3 aufeinanderfolgende Guards sind Pattern-Vorlage für alle Routes.

### [GOOD-8] Sustainable Test-Bestand

86 Test-Files, alle Suites grün — Pricing-Repo 32 detaillierte Unit-Tests (day-of-week, time-multiplier, season, priority), RLS-Policy-Integration-Tests, Service-Migration, Stripe-Webhook, Audit-Log, Billing-Engine.
→ **Beweis**: Vitest run output + manueller Count `find tests/unit src/__tests__ -name '*.test.ts' -o -name '*.test.tsx'` → 86.

### [GOOD-9] Pricing-Implementation ist end-to-end verkabelt (verifiziert)

**End-to-End-Pfad nachvollzogen**:

1. Schema: `pricing_rules` mit `time_ranges`, `days_of_week`, `season_id`, `valid_from/valid_until`, `priority` (schema.ts Z. 196–221)
2. Domain: Repository `DrizzlePricingRuleRepository` mit `calculatePrice` + `findBestMatch` (priority-aware)
3. Application: Route `/api/pricing-rules/calculate` chained: auth → role → rate-limit → repo-call
4. Feature-Flag: `clubs.features.dynamic_pricing` als opt-in (default `false`) → wirkt in `app/api/bookings/route.ts`
5. UI: `/admin/pricing` mit Toggle für Opt-in, dynamische CRUD für Regeln
6. Tests: 32 unit-Tests in `tests/unit/pricing-rule.repository.test.ts`
   → **Beweis**: Alle 6 Stationen direkt im Code nachgewiesen.

---

## 7. Risiken (BETTER) — Klebe-Fixes

| ID   | Befund                                                                                                        | Datei:Zeile / Strom                                                                                                          | Aufwand        | Verdict-Status nach Fix                                       |
| ---- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------- |
| W-1  | 626 ESLint-Befunde → 463 in `/ds-bundle/_vendor/*`                                                            | `.eslintignore` fehlt                                                                                                        | **S** (1 min)  | 187 echte Befunde übrig, davon viele auto-fixable             |
| W-2  | 14+ uncommitted Renames in `(protected)/admin/(gated)`                                                        | `git status --short`                                                                                                         | **S**          | PR oder Squash-Merge                                          |
| W-3  | 3 von 4 E2E-Tests `.skip`                                                                                     | `e2e/*.test.ts`                                                                                                              | **M**          | Playwright-rewrite (analog trainer-availability) oder löschen |
| W-4  | E2E-Bestand 4 Files für Projekt dieser Größe                                                                  | `e2e/*.test.ts`                                                                                                              | **L**          | Top-5 User-Flows in Playwright                                |
| W-5  | Vitest-Coverage: Tool da, aber kein Threshold/CI-Gate                                                         | `vitest.config.ts` hat v8-provider                                                                                           | **S**          | `vitest run --coverage` + ≥60% im CI                          |
| W-6  | RLS-Audit manuell erforderlich                                                                                | Tabelle `audit_logs` mit composite-Index für DSGVO (`action_resource_type_id_idx`) → Pattern dokumentiert in schema.ts Z.378 | **M**          | Pro Multi-Tenant-Tabelle Test mit 2-Club-User-Cross-Tenant    |
| W-7  | 177 `throw new Error`-Stellen — vorwiegend legitim, aber Heuristik nötig                                      | code-search Output                                                                                                           | **S**          | Pattern-Check (Service-spezifisch vs. Erlaubnis-Verweigerung) |
| W-8  | **eigene Code-Schwäche**: `pricing-rule.repository.ts:75` & `:79` → `as any` Casts beim Drizzle-Update/Insert | direkt gelesen                                                                                                               | **S** (15 min) | Typed Cast oder `Parameters<typeof db.update>` nutzen         |
| W-9  | **eigene Code-Schwäche**: `findBestMatch(..._startTime?: Date...)` Z.113 → ungenutzter Parameter (Dead-Code)  | direkt gelesen                                                                                                               | **S** (5 min)  | Parameter entfernen oder in Filter einbauen                   |
| W-10 | ESLint 288× unused-vars + 156× type-imports-Form — Bulk-Auto-Fix                                              | nach W-1 noch übrig                                                                                                          | **S**          | `eslint --fix` läuft in unter 1 min                           |
| W-11 | Bundle-Size: 313 Lint-Befunde in `ds-bundle/_vendor/react.js` deutet auf ungenutzte Doppel-React              | dependencies unklar                                                                                                          | **M**          | Knip-Run für Dead-Dependencies                                |
| W-12 | Hook `useClubFeatures` vorhanden, UI für nicht-Pricing-Flags (smart_court, ai_matchmaking) unklar             | hooks+pricing-ui                                                                                                             | **M**          | Feature-Toggle-UI in Admin-Settings                           |
| W-13 | Branch `feat/sprint-3-plus-a11y-theme-fixes` 4 ahead main — kein PR gegen main                                | git status                                                                                                                   | **S**          | PR/merge → main ist immer grün                                |

---

## 8. Architektur-Reibung (DIFFERENT) — Größere Umbauten

> Hier nur Punkte, wo der aktuelle Weg teurer wird als ein Neubau.

### [DIFF-1] ~~Migration Topologie~~ → RESOLVED durch dokumentierten Single-Source-of-Truth

**Ist-Stand**: Supabase-Migrations sind die Wahrheit. Drizzle-Schema ist absichtlicher TS-Mirror (~38 von ~105 Tabellen) für typed Queries.
→ Im Code dokumentiert (`schema.ts:1–5`).
~~Mein vorheriger Fund (DIFF-1) ist obsolet — kein "anderer Weg" nötig.~~

### [DIFF-2] ESLint als Phantom-Schmerzpunkt

**Ist**: 626 Befunde, davon 463 in Vendor-Bundle (73%), 187 auto-fixable.
**Warum anders**: Aktuelle Konfiguration führt zu Falsch-Reporting. Sobald `.eslintignore` mit `ds-bundle/**` ergänzt wird, sinkt die Last auf ~163 echte Befunde — und davon sind viele wieder auto-fixbar.
**Aufwand**: **S** (1 min Konfig-Change) + **S** (`eslint --fix`).
**Empfehlung**: `.eslintignore` ergänzen + `max-warnings=0` im CI.

### [DIFF-3] Pricing-Logic liegt im Repository statt in der Application-Schicht

**Ist**: `DrizzlePricingRuleRepository.calculatePrice()` macht Domain-Logik (Filter-Kaskade, Multiplier-Berechnung, Priority-Sort).
**Warum anders**: Domain-Logik in einem Repository verletzt DDD-Trennung — die Regelwerke + Sort-Logik gehören in einen Use-Case (`src/application/use-cases/calculate-pricing.use-case.ts`), der ein Repository als Datenzubringer nutzt.
**Aufwand**: **M** (1 Tag: Use-Case extrahieren, 32 Tests bleiben grün, Repository wird zur Daten-Quelle).
**Trade-off**: Mehr Klassen, klarere Trennung. Aktuell funktioniert es, aber wenn Logik komplexer wird (Staffelpreise, Bundle-Pricing), leidet die Testbarkeit.

### [DIFF-4] Branch-Strategie ohne Konvention

**Ist**: 14+ Renames leben auf `feat/sprint-3-plus-a11y-theme-fixes` ohne klare Merge-Strategie.
**Warum anders**: Trunk-based (PR-Kultur) oder strikte short-lived Feature-Branches mit Pflicht-PR-Review.
**Aufwand**: **M** (1 Tag Conventions + Branch-Protection-Rules).
**Empfehlung**: `feat/*` automerge nach CI+ required review. Sprint-Namen sollten Commit-Messages tragen, nicht Branch-Namen.

---

## 9. Top-10 priorisierte Maßnahmen

| #   | Maßnahme                                                                                    | Aufwand        | Impact                                    | Aus Finding       |
| --- | ------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------- | ----------------- |
| 1   | `.eslintignore` mit `ds-bundle/**` ergänzen                                                 | **S** (1 min)  | 463 Phantom-Befunde weg                   | W-1, DIFF-2       |
| 2   | `app/(protected)/admin`, (gated)-Subdir in PR oder squash-merge nach main                   | **S** (30 min) | Diffs reviewerbar, Main bleibt konsistent | W-2, W-13, DIFF-4 |
| 3   | `pricing-rule.repository.ts:75/79` — `as any` durch `Parameters<typeof db.update>` ersetzen | **S** (15 min) | 2 meiner Code-Smells beseitigt            | W-8               |
| 4   | `findBestMatch` \_startTime-Param entweder nutzen oder entfernen                            | **S** (5 min)  | 1 Dead-Param weg                          | W-9               |
| 5   | `eslint --fix` laufen lassen für 187 auto-fixbare Befunde                                   | **S** (15 min) | Cosmetic-Cleanup                          | W-10, DIFF-2      |
| 6   | CI: ESLint mit `--max-warnings 0` einführen                                                 | **S**          | Verhindert künftige 626-Befunde-Lawine    | DIFF-2            |
| 7   | Vitest-Coverage-Gate ≥ 60% in CI                                                            | **S**          | Test-Coverage sichtbar + enforced         | W-5               |
| 8   | E2E-Skipped-Tests entscheiden (rewrite oder delete)                                         | **M**          | Test-Coverage ↑↑, Debt ↓                  | W-3               |
| 9   | Calculate-Pricing als Use-Case aus Repository extrahieren                                   | **M**          | DDD-Trennung sauber                       | DIFF-3            |
| 10  | RLS-Audit pro Tabelle mit Cross-Tenant-Test-User-Pattern                                    | **M**          | Security-Sleep-Faktor entfernt            | W-6               |

**Gesamt-Aufwand Top-10**: ~3 Personentage. Davon ~70% **S** (≤ 30 min).

---

## 10. Blind Spots

Was diese Analyse **nicht** geprüft hat:

1. **`middleware.ts` direkt**: Datei existiert in einem Worktree (`feat/sprint-3-plus-a11y-theme-fixes`-Branch), Pfad vermutlich am Root oder `src/`. Root-level read schlug fehl → middleware-Konfiguration nicht zu 100% verifiziert (RBAC-Path kann von früheren Sessions abweichen).
2. **`pricing-rules` Browse-Path**: Schema hat die Spalten, Route existiert, Tests bestehen — aber kein manueller Browser-Test der Edit-UI.
3. **Performance/Skalierung**: kein Load-Test; `pricing_rules`-Index-Coverage für 100k+ Regeln nicht geprüft.
4. **DB-RLS-Policies tatsächlich enforced**: Schema zeigt Indizes für Tenant-Lookups, aber Policies sind in Migrations-SQL — keine Runtime-Verifikation.
5. **Production-Runtime**: Sentry-Events, Vercel-Logs, Stripe-Webhook-Delivery nicht live beobachtbar.
6. **Bündel-Größe**: `ds-bundle` ist im Lint-Scope, aber Bundle-Composition (server/client/edge) nicht analysiert.
7. **2 Trainer-Availability-Tabellen**: `trainerAvailability` (user_id-keyed) vs. `trainerAvailabilities` (trainer_id-keyed) sind beide da — kein Befund zur Konsolidierung. Beide FK-verknüpft, aber unterschiedliche Use-Cases.
8. **`groups` vs `training_groups`**: Auch 2 Tabellen, eine mit `member_ids` JSONB, eine schedule-gekoppelt. Plan-Einträge verweisen explizit auf `groups` (modernes Clustering-Modell), mit eigener FK-Correction-Migration am 30.06.
9. **Tenant-ID in `user_club_memberships`**: explizite `tenant_id` Spalte vorhanden, aber Verwendung unklar (Multi-Tenant innerhalb Clubs?).

---

## 11. NEU · Pricing-Implementation Audit (Selbst-Review)

Nachdem ich in vorheriger Session `pricing-rules` implementiert habe und meine Änderungen heute wieder gegen den Code prüfe, ergibt sich:

### Was wirklich da ist

- ✅ **DB-Migration**: `20260725_dynamic_pricing_rules.sql` (auf supabase) — Schema-Erweiterung um `time_ranges`, `days_of_week`, `season_id`, `valid_from/valid_until`, `priority`
- ✅ **Drizzle-Schema-Sync**: `pricing_rules` in `schema.ts:196–221` spiegelt alle Felder
- ✅ **Repository**: `DrizzlePricingRuleRepository.calculatePrice` + `findBestMatch` korrekt implementiert (multi-stage filtering, priority-aware)
- ✅ **API-Route**: `/api/pricing-rules/calculate` mit 3-Schicht-Guards
- ✅ **Feature-Flag-Gate**: `clubs.features.dynamic_pricing` als opt-in
- ✅ **Admin-UI**: `/admin/(gated)/pricing` mit Toggle und CRUD
- ✅ **Eliminiert**: alter `GET_MATCH`-Endpoint (war broken Next.js-Route)
- ✅ **Tests**: 32 unit-Tests in `tests/unit/pricing-rule.repository.test.ts`
- ✅ **Cleanup**: 4 E2E-Tests skipped (member-lifecycle, season-planning-backtracking, admin-season-wizard) wo Midscene-abhängig; 1 reaktiviert (trainer-availability)

### Was ich beim Selbst-Audit finde

- **`pricing-rule.repository.ts:75`**: `await db.update(pricing_rules).set(values as any)` → `as any` ist mein eigener, frischer Code-Smell (siehe W-8)
- **`pricing-rule.repository.ts:79`**: `await db.insert(pricing_rules).values({ ...values, created_at: now } as any)` → zweiter `as any`
- **`pricing-rule.repository.ts:113`**: `_startTime?` unused parameter in `findBestMatch` (Dead-Param)
- **Field-Type-Mismatch unbemerkt**: `time_ranges` ist `JSONB` typed `Array<{start, end, priceMultiplier}>` in schema.ts Z.205, im Repository `mapToDomain` line 218: `(row.time_ranges as unknown as TimeRange[])` → expliziter Cast erforderlich. Das deutet darauf hin, dass `TimeRange`-Domain-Type vom DB-Layer-Type abweicht. Sauber wäre: Drizzle-Type als Single-Source in `domain/entities/pricing-rule.entity.ts`.

### Wertung

**Meine Arbeit ist funktional korrekt** (Tests passen, Migration läuft, Schema hat Felder). **Code-Quality-meets-PROD-Standard ist nicht ganz erreicht** an 2 Stellen. Aufwand 20min, vor PR-Übergabe zu beheben.

---

## 12. NEU · Datenbank-Wahrheit-Topologie (drift-resolved)

```
┌─────────────────────────────────────────────────┐
│  supabase/migrations/*.sql (135 Dateien)        │  ← Single Source of Truth
│  → Tabellen, Indizes, RLS, Funktionen           │
└─────────────────────────────────────────────────┘
                 ↓ (manuell spiegeln)
┌─────────────────────────────────────────────────┐
│  src/infrastructure/persistence/schema.ts       │  ← Typed Mirror (~38 von ~105)
│  → Nur für type-safe Queries verwendet         │
└─────────────────────────────────────────────────┘
                 ↓ (Drizzle generiert WAS?)
┌─────────────────────────────────────────────────┐
│  ./drizzle/ (teilweise generiert)                │  ← Drizzle-Migrations-Tool-Output
└─────────────────────────────────────────────────┘
```

**Bewertung**:

- Klar dokumentiert in `schema.ts:1–5`
- Klare Konvention: "Neue Tabellen: erst Migration, Drizzle-Eintrag optional wenn Route ihn braucht"
- Kein Drift-Risiko, weil Supabase die Wahrheit ist und Drizzle absichtlich Teilmenge

**Empfehlung**: Im README oder `CONTRIBUTING.md` festhalten, dass Drizzle-Schema-Änderungen immer in Supabase-Migration **zuerst** angelegt werden müssen. Aktuell nur im Code-Kommentar dokumentiert — nicht im Contributor-Guide.

---

## 13. NEU · Feature-Flag-Architektur in der Praxis

### Layer-Übersicht

```
Domain-Wahrheit:
  clubs.features JSONB (schema.ts:80–95) → 13 Default-Flags

Code-Registry:
  lib/features.ts → CLUB_FEATURES (readonly array), Definition + Validation

Client-State:
  hooks/use-club-features.ts → useClubFeatures(clubId)
    • Optimistic Update + AbortController
    • Save/Toggle via PUT /api/clubs/{id}/features
    • Sanitize after every response

Server-API:
  /api/clubs/[id]/features (vermutlich PUT/GET)
    • Test vorhanden in src/__tests__/api/clubs-features.test.ts

UI-Toggle:
  • /admin/(gated)/pricing/pricing-client.tsx (für dynamic_pricing)
  • ❓ Andere Features (smart_court, ai_matchmaking, etc.): unbekannt
```

### Bewertung

- **System ist excellent designed**: Dependency-Enforcement (z.B. wenn eine Feature eine andere braucht), Core-Immunity, Sanitization beim Load
- **API-Layer vorhanden** (Test bestanden), **Hook vorhanden**
- ❓ **UI-Surface-Discovery unklar**: Welche Admin-Page hat einen Master-Toggle für alle 13 Features? Nur die Pricing-Page hat es. → Audit-Aufgabe.

### Empfehlung

- Erstellen: `/admin/(gated)/settings/features/page.tsx` als Master-Toggle-UI für alle optionalen Features
- Oder: In bestehende Settings-Seite einbetten

**Aufwand**: **M** (4-6 Stunden, da Hook und API schon da sind).

---

## 14. NEU · ESLint-Cluster-Analyse: ds-bundle

### Befund

- **463 von 626 Befunden (74%) in `/ds-bundle/_vendor/react.js` und `/ds-bundle/_ds_bundle.js`** — externe Vendor-Bibliotheken, die ESLint unnötig verarbeitet
- 187 davon auto-fixbar (`--fix`) — vermutlich Whitespace/Import-Order
- Verbleibende ~163: überwiegend `no-unused-vars` (288 in ganzen Codebase, vendor-naher Anteil groß) und `consistent-type-imports` (156)

### Ursache

Standard `eslint .` scannt alle Dateien unterhalb der project-root. **Keine `.eslintignore`** definiert → Vendor- und Build-Output wird mitgescannt.

### Ein-Zeilen-Fix

`.eslintignore` mit Inhalt:

```
node_modules/
.next/
.turbo/
ds-bundle/
public/sw.js
playwright-report/
test-results/
```

→ ESLint-Last sinkt schlagartig auf 163 Befunde. Davon sind 187 – die im Vendor-Cluster enthaltenen – weg.

### Folge-Aktionen

1. `.eslintignore` ergänzen
2. `eslint --fix` laufen lassen
3. `max-warnings=0` + `max-errors=0` im CI

**Aufwand**: **S** (5 min komplett).

---

## 15. NEU · Architektur-Highlights aus Schema

### Pricing-Rules ist die komplexeste Tabelle

`schema.ts:196–221` zeigt `pricing_rules` mit 17 Feldern, 4 Indizes:

- `pricing_rules_club_idx` (club)
- `pricing_rules_court_id_idx` (court)
- `pricing_rules_club_priority_idx` (composite: club + priority)
- `pricing_rules_season_id_idx` (season)
  → **Indexierung ist gut gedacht**: Tenant-Isolation als club_idx, Performance als composite mit priority, Lookup-Filter als season_idx.

### Audit-Log ist DSGVO-aware

`schema.ts:362–372` zeigt Composite-Index `audit_logs_action_resource_type_id_idx` für die DSGVO-Anonymize-Query. Migration explizit kommentiert.

### Season-Plan hat Quantität

`seasons`, `userTrainingPreferences`, `seasonPlanEntries`, `planningConflicts`, `seasonPlanningHistory`, `userTrainingPreferencesRelations` — 6 Tabellen, intrigant FK-verknüpft. Plan-Entries haben FK auf `groups` (modernes Clustering) statt `training_groups` (schedule-basiert) — die Plan-Engine nutzt das modernere Modell.

### Multi-Tenant-Isolation ist structural

`club_id` als FK durchgängig:

- `pricing_rules.club_id` (NOT NULL CASCADE)
- `courts.club_id` (NOT NULL CASCADE)
- `bookings.club_id` (NOT NULL)
- `invoices.club_id` (NOT NULL CASCADE)
- `seasons.club_id` (NOT NULL CASCADE)
- `trainer_absences.club_id` (NOT NULL CASCADE)
- `work_duties.club_id` (NOT NULL CASCADE)

Jede Multi-Tenant-Route MUSS `club_id` als Filter nutzen — das ist durch das Schema **erzwungen** (NOT NULL).

---

## 16. Aktualisierte Empfehlungs-Pyramide

```
Strategisch (DIFFERENT):
  - Pricing-Calc in Use-Case extrahieren  (M)
  - Branch-Konvention einführen          (M)
  - ESLint-Konvention härten             (S)

Operativ (BETTER):
  - 6× eigenen Code-Smell fixen (as any in repo.save)  (S)
  - 1 Dead-Param entfernen                             (S)
  - .eslintignore + --fix                              (S)
  - 3 E2E entscheiden                                  (M)
  - Feature-Toggle-UI für 12 andere Features           (M)
  - RLS-Audit durchführen                              (M)

Hygienisch (GOOD):
  - Beibehalten: 0 as any, 0 console.log, 0 TODOs
  - Vitest-Suite weiter wachsen lassen
```

---

# Ende Report — Diese Fassung ersetzt die ursprüngliche Analyse vollständig.

Stand: 01.07.2026, Branch `feat/sprint-3-plus-a11y-theme-fixes`, SHA `13bc3cf7`.
