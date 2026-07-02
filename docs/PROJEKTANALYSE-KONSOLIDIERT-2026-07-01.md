# SwingZ — Konsolidierte Analyse (2026-07-01)

> Zusammenführung von `PROJEKTANALYSE-CODEBUFF-2026-07-01.md` (5 Selbst-Audit-Runden v1–v5, Deep-Dive-Stil)
> und `MARKTREIFE-AUDIT-2026-07-01.md` (11-Domänen-Scorecard, Subagent-Stil).
> Alle P0-Punkte + Stichproben wurden gegen Branch `feat/sprint-3-plus-a11y-theme-fixes` **frisch nachgeprüft** (Zeile "✓ nachgeprüft").
> Wo CODEBUFF sich selbst widersprach (v5-Selbstkorrektur), ist hier nur der korrigierte, verifizierte Wert übernommen.

---

## Ground-Truth-Metriken (nachgeprüft 2026-07-01)

| Metrik                                          | Wert                                                   | Status                                                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `as any`-Casts (`app,components,lib,src,hooks`) | **449**                                                | ✓ nachgeprüft (CODEBUFF-Erstwert 336 war stale, v5-Korrektur bestätigt)                                                                     |
| Dateien mit `console.*`                         | **89**                                                 | ✓ nachgeprüft (~CODEBUFFs 90)                                                                                                               |
| DB-Migrationen                                  | **135**                                                | ✓ nachgeprüft                                                                                                                               |
| `tsc --noEmit --project tsconfig.strict.json`   | **6 Errors**, alle `scripts/_repro-cluster.ts:183-196` | ✓ nachgeprüft — **CODEBUFFs eigene F.5-Korrektur ("0 Errors, Branch clean") ist falsch**, die Fehler existieren weiterhin auf diesem Branch |
| `.eslintignore` vorhanden?                      | **Nein**                                               | ✓ nachgeprüft — `ds-bundle/` (Vendor-JS, ~463 Phantom-Lint-Befunde laut CODEBUFF F.2) wird weiterhin gelintet                               |
| `.claude/worktrees/`                            | (nicht neu gezählt, CODEBUFF: 11.917 Dateien)          | nicht Teil dieser Prüfung                                                                                                                   |
| API-Routes / Test-Files                         | 306 Routes, ~46 Test-Dateien (~15 % File-Coverage)     | aus CODEBUFF übernommen, plausibel                                                                                                          |

---

## Gesamtbild

MARKTREIFE-AUDIT scort **Ø 1,9/4** über 11 Domänen (kein Bereich bei 0, nur Auth/Security bei 3/4). CODEBUFF (datei-fokussiert statt domänen-fokussiert) kommt zum selben Grundbild: **solide Einzelmuster, die nicht flächendeckend durchgesetzt sind** — gute Referenz-Implementierungen existieren (Stripe-Webhook-Idempotenz, Booking-RPC, Pricing-DDD-Skelett), werden aber nicht auf den Rest der Codebase übertragen.

**Empfehlung (aus MARKTREIFE):** Go-mit-Auflagen. ~8–12 Personentage für die 12 Blocker, keiner davon architektonisch riskant.

---

## P0 — Sofort (dedupliziert, mit Quelle)

| #   | Finding                                                                                                                                                                                                                                                                                                                                               | Beleg                                                                                                         | Quelle                                         | Verifiziert                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| 1   | **Cross-Tenant Write**: `PATCH/DELETE /api/clubs/[id]` prüft nur `verifyRole(auth,'admin')`, nicht ob `id` zum Club des Admins gehört                                                                                                                                                                                                                 | `app/api/clubs/[id]/route.ts:75-88`                                                                           | M                                              | ✓ nachgeprüft — kein Club-Ownership-Check im Code sichtbar |
| 2   | **RLS-Bypass systemisch**: alle Drizzle-Routes laufen über `postgres`-Rolle, umgehen RLS vollständig; Read-IDOR über `schedule`, `groups`, `pricing-rules`, `analytics` (clubId aus Query-Param ungeprüft)                                                                                                                                            | `src/infrastructure/persistence/db.ts` + genannte Routes                                                      | M                                              | nicht re-verifiziert diese Runde                           |
| 3   | **Service-Client in Server-Component**: `createServiceClient()` rendert `board_decisions` ohne RLS                                                                                                                                                                                                                                                    | `app/(protected)/admin/(gated)/decisions/page.tsx:15` (Pfad durch `(gated)`-Restrukturierung geändert)        | C                                              | ✓ nachgeprüft, weiterhin offen                             |
| 4   | **`CRON_SECRET` optional** — Cron-Routes ohne Secret akzeptieren ungeprüfte Aufrufe                                                                                                                                                                                                                                                                   | `lib/env.ts:44`                                                                                               | C                                              | ✓ nachgeprüft, weiterhin `optional()`                      |
| 5   | **`lib/supabase/service.ts` ohne `import 'server-only'`** — Service-Client kompiliert auch in Client-Components                                                                                                                                                                                                                                       | `lib/supabase/service.ts`                                                                                     | C                                              | ✓ nachgeprüft, kein `import 'server-only'` vorhanden       |
| 6   | **DSGVO-Wipe unvollständig**: `WIPE_USER_COLUMNS` deckt nur 4 Felder (email/full_name/phone/avatar_url) — Adresse, SEPA-IBAN, Notfallkontakt, `trainer_member_notes` bleiben nach "Löschung" bestehen                                                                                                                                                 | `lib/services/anonymize.service.ts:83-88`                                                                     | C                                              | ✓ nachgeprüft, exakt 4 Felder                              |
| 7   | **Plan-Wechsel dupliziert Abos** (Starter→Professional erzeugt neue Checkout-Session statt `subscriptions.update()`) — Doppelbelastung                                                                                                                                                                                                                | `app/api/stripe/subscribe/route.ts:81-96`                                                                     | M                                              | nicht re-verifiziert                                       |
| 8   | **Kein Dunning**: `invoice.payment_failed` wird nicht behandelt, `past_due`/`unpaid` sperrt keinen Zugriff                                                                                                                                                                                                                                            | `app/api/webhooks/stripe/route.ts`, `admin/(gated)/layout.tsx:9-37`                                           | M                                              | nicht re-verifiziert                                       |
| 9   | **nuLiga-Import täuscht Erfolg vor** (fehlender UNIQUE-Constraint, Error-Rückgabe ignoriert)                                                                                                                                                                                                                                                          | `app/api/admin/nuliga/import/route.ts:50-83`                                                                  | M                                              | nicht re-verifiziert                                       |
| 10  | **Sentry im Root-Error-Boundary fehlt** — `global-error.tsx` loggt nur `console.error`, kein `withSentryConfig()` in `next.config.js` (Sub-Boundary `app/error.tsx` hat Sentry korrekt verdrahtet — Inkonsistenz zwischen den beiden Layern)                                                                                                          | `app/global-error.tsx:18-20` vs. `app/error.tsx:22-31`                                                        | C+M                                            | konsistent in beiden Quellen, nicht re-verifiziert         |
| 11  | **Backup ohne Restore-Pfad** — täglicher JSON-Export von 37 Tabellen, kein Restore-Skript/Doku                                                                                                                                                                                                                                                        | `app/api/cron/backup/route.ts`                                                                                | M                                              | nicht re-verifiziert                                       |
| 12  | **Rollen-Drift im Hook**: `use-user-data.ts` kennt nur 4 Rollen (`owner` fehlt) → Owner-User werden clientseitig ggf. falsch als "kein Admin" bewertet                                                                                                                                                                                                | `hooks/use-user-data.ts:5,47`                                                                                 | C                                              | ✓ nachgeprüft — `UserRole` ohne `'owner'`                  |
| 13  | **`lib/jobs/runner.ts`**: `as any`-Cast + Race-Condition (`upsert` ohne `locked_at`/`locked_by`, zwei parallele Cron-Trigger überschreiben sich)                                                                                                                                                                                                      | `lib/jobs/runner.ts:16-32`                                                                                    | C                                              | ✓ nachgeprüft, Cast bestätigt                              |
| 14  | **Rechtliches**: Impressum mit Platzhalterdaten, kein Cookie-Consent trotz aktivem GA-Tracking, Datenschutzerklärung ohne echte Sub-Prozessoren (Gemini fehlt) — **zusätzlich: zwei widersprüchliche Datenschutz-Seiten** (`app/datenschutz/page.tsx` vs. `app/privacy/page.tsx:94-96`, letztere behauptet fälschlich "Daten verlassen die EU nicht") | `app/impressum/page.tsx:61-96`, `components/analytics-provider.tsx:29-51`, `app/datenschutz/page.tsx:140-159` | M (+ neue Beobachtung: doppelte Privacy-Seite) | nicht re-verifiziert, Doppel-Seite verdient eigene Prüfung |
| 15  | **Multi-Tenant-Tests rot** — die einzige automatisierte Verifikation der Kern-Sicherheitseigenschaft liefert kein grünes Ergebnis                                                                                                                                                                                                                     | `tests/unit/.../hardware-vendor/route.test.ts`, `src/__tests__/api/clubs-features.test.ts`                    | M                                              | nicht re-verifiziert                                       |

**C** = aus CODEBUFF, **M** = aus MARKTREIFE-AUDIT. Punkt 14 enthält eine neue Beobachtung aus dieser Konsolidierung (zwei widersprüchliche Privacy-Seiten).

---

## P1 — Diese Sprint

- **`.eslintignore` fehlt** → `ds-bundle/` (Vendor) erzeugt ~463 von 626 Lint-Findings (74 % Phantom-Last). 5-Minuten-Fix, danach `max-warnings=0` im CI. [C, ✓ nachgeprüft: Ordner existiert, Ignore-Datei fehlt]
- **Kein CI-Gate** für `tsc`/`vitest`/`playwright` — nur `db-audit.yml`/`perf-bench.yml` vorhanden, Pre-Commit prüft nur Lint. [M]
- **`scripts/_repro-cluster.ts`** verursacht weiterhin 6 `tsc --strict`-Errors — reparieren oder nach `_archive/` verschieben + aus tsconfig excluden. [C, ✓ nachgeprüft weiterhin vorhanden]
- **`supabase gen types typescript --local` als CI-Gate** — beendet die `as any`-Epidemie an der Quelle statt sie zu migrieren. [C]
- **`clubs.features` GIN-Index fehlt** — Full-Table-Scan-Risiko sobald ein Cron alle Clubs nach Feature filtert. [C]
- **Zwei parallele Rate-Limit-Implementierungen** (`proxy.ts` raw fetch vs. `lib/rate-limit.ts` SDK) — Drift-Risiko bei neuen Limiter-Typen. [C]
- **Zapier-Webhook Dev-Bypass** (`NODE_ENV !== 'production'` statt explizitem Toggle). [C]
- **Sentry ohne User-Context** (`Sentry.setUser` fehlt) — Crash-Zuordnung zu Usern nicht möglich. [C]
- **Architektur-Drift**: nur ~20 % (62/306) Routes nutzen die geplante `src/application`-Schicht; Bookings/Billing/Matches laufen am Clean-Architecture-Layer vorbei. Zwei konkurrierende Billing-Stacks (`lib/billing-engine.ts` vs. `src/application/services/billing.service.ts`). [M, deckungsgleich mit CODEBUFFs C.1/D.5-Befunden zu Pricing-Route-Inline-Logik]
- **Gebaut, aber ungenutzt** (wiederkehrendes Muster in beiden Quellen): `lib/server-cache.ts` komplett tot trotz fertiger `unstable_cache()`-Config; `audit_logger` nur an 2 Stellen aufgerufen (bookings/payments/decisions fehlen); `anonymize.service.ts` vs. schwächere Lösch-Logik im tatsächlichen Delete-Endpoint. [C+M, gegenseitig bestätigt]
- **Timezone-Inkonsistenz**: `sessions.timeslot_start/end` naive `timestamp`, `bookings` korrekt `timestamptz`; Season-Planning rechnet über lokale Server-Zeit statt Europe/Berlin. [M]
- **Kein Gemini-Timeout/Rate-Limit** bei KI-Analyse-Route — Kostenkontrolle fehlt. [M]
- **N+1-Queries** im Superadmin-Dashboard (2 Implementierungen, eine im falschen Pfad); nur 5/306 Routes nutzen `getPagination`. [M]
- **a11y-Arbeit bleibt auf neue Infrastruktur beschränkt** — `CenteredModal` löst handgerollte Admin-Modals (`admin-trial-approvals.tsx`) nicht ab; harte englische Strings in shadcn-Primitiven (`dialog.tsx`, `breadcrumb.tsx`). [M]
- **i18n ist "schlimmer als tot"**: `NextIntlClientProvider` + 2 Dictionary-Files sind aktiv gebundlet, aber **kein** `useTranslations()`-Aufruf existiert — reiner Bundle-Size-Verlust ohne Nutzen. Entscheidung nötig: abschalten (XS, spart ≥50 KB) oder aktivieren (L). [C — präzisiert gegenüber v1-Annahme "einfach tot"]

---

## P2 — Backlog

- Application-Service-Layer für Pricing (`PricingUseCase`), Strategy-Pattern `PricingResolver` statt 35-Zeilen-Inline-Logik in `bookings/route.ts:157-191`. [C]
- `BillingEngine`-Konsolidierung der 5 parallelen Billing-Services. [C]
- Modul-Scope-Service-Clients (Decision-/SEPA-/Invoice-/Payment-Service, ~10 Stellen) auf DI/Constructor-Injection umstellen. [C]
- Eigene Code-Smells in `pricing-rule.repository.ts` (2× `as any`, 1 dead parameter `_startTime`). [C, Selbst-Audit]
- Feature-Flag-Master-UI fehlt für 12 von 13 Features (nur `dynamic_pricing` hat Admin-Toggle). [C]
- `booking-completed`-Webhook-Race (SELECT-then-INSERT) → UNIQUE-INDEX + INSERT-first-then-catch. [C]
- Owner-Auth-Pattern vereinheitlichen (`requireOwner()` analog `requireAdminClub()` statt 3 Inline-Implementierungen). [C]
- `CONTRIBUTING.md`: Migrations-Layer-Modell + Schema-Drift-Konvention dokumentieren (135 Migrationen vs. 88 Drizzle-Tabellen ist bewusst, aber für neue Contributors unklar). [C]
- 2 Trainer-Availability-Tabellen (`trainerAvailability`/`trainerAvailabilities`) und 2 Group-Tabellen (`groups`/`training_groups`) — Konsolidierungsbedarf ungeklärt. [C]
- Admin-Onboarding praktisch ungetestet (einziger Test env-gated, läuft in keiner Standard-CI). [M]
- SVG-Upload beim Club-Logo ohne Sanitizing (Stored-XSS-Potenzial). [M]
- Newsletter ohne Double-Opt-In. [M]

---

## ✅ Was gut funktioniert (Referenzmuster, nicht überall angewendet)

- **Stripe-Webhook**: Signaturprüfung + atomare RPC-Idempotenz (`check_and_record_stripe_event`) — Production-Money-Pfad korrekt abgesichert. [C+M übereinstimmend]
- **Haupt-Buchungspfad** (`create_booking_safe` RPC): `FOR UPDATE` + Capacity-Check + GIST-Exclusion + Trigger — Defense-in-Depth vorbildlich. [M]
- **`season-billing.service.ts`**: Atomic-RPC mit Savepoint-Fallback, korrekte Idempotenz via `season_id`-FK statt fragiler `ilike`-Suche, Rounding-Drift-Audit. [C]
- **Rollenhierarchie als Zahlen-Vergleich** (`owner=5 → member=1`), keine String-Compares. [C]
- **Service-Client-Scope-Discipline empirisch sauber**: 217 Vorkommen, davon 0 in `components/`, 0 in `hooks/`. [C]
- **Auth-Guard-Pattern konsistent**: 196 Treffer für `withApiAuth(...verifyRole(...))`, keine Route umgeht den Layer (außer den unter P0 genannten Drizzle-Direct-Routes). [C]
- **`stripe-subscription-quantity-sync.service.ts`** als Vorzeige-Pattern: Pure-Logic getrennt von Side-Effects, typisiertes Result statt `throw`, DI statt Modul-Scope-Client. [C]
- **Auth & Security insgesamt beste Domäne** (3/4) — alle 15 vom Tooling als "ungeschützt" markierten Routes einzeln verifiziert, keine echte Lücke gefunden. [M]

---

## Was diese Konsolidierung NICHT (erneut) geprüft hat

- Alle "nicht re-verifiziert"-markierten P0/P1-Punkte oben — übernommen aus den Quelldokumenten, dort mit Datei:Zeile belegt, aber in dieser Runde nicht erneut gegen den Code gelesen.
- Production-Traffic, Sentry-Dashboards, Vercel-Logs, echte `vitest --coverage`-Quote (`--coverage`-Reporter wirft laut CODEBUFF `ERR_LOAD_URL`).
- Die neu aufgefallene Diskrepanz zwischen `app/datenschutz/page.tsx` und `app/privacy/page.tsx` (widersprüchliche Aussagen zu EU-Datentransfer) wurde nur oberflächlich bemerkt, nicht juristisch bewertet — verdient eigenen Termin.

---

## Top-5 Sofort-Maßnahmen (Risiko-Reduktion pro Aufwand)

1. Cross-Tenant-Write-Fix `PATCH/DELETE /api/clubs/[id]` — 1–2h
2. `CRON_SECRET` required + `import 'server-only'` in `lib/supabase/service.ts` — <30 Min zusammen
3. Sentry-Wiring in `global-error.tsx` + `withSentryConfig()` — <1 Tag
4. Cookie-Consent-Banner — 4–8h
5. Dunning-Handler (`invoice.payment_failed` + Zugriffssperre) — 1–2 Tage

Danach: CI-Gate (`tsc`+`vitest`+`playwright`) einziehen, Multi-Tenant-Tests grün bekommen, `.eslintignore` ergänzen (5 Min, killt 74 % Phantom-Lint-Last).
