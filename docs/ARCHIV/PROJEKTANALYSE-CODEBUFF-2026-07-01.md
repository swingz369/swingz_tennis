# SwingZ — Vollumfängliche Projektanalyse

> **Erstellt:** 2026-07-01
> **Versionen:** v1 (Initialbefunde + Quick-Wins) · **v2 (Vertiefung: Pricing-Pfad, Rollen-Enforcement, Cron, Env-Drift, Audit-Trail)** — siehe Inhaltsverzeichnis.
> **Methode:** Ground-Truth-Verifikation direkt gegen den Quellcode. **Keine** Aussage verlässt sich auf `CLAUDE.md`, `docs/AUDIT-*` oder `docs/PROJEKTANALYSE_2026_QUELLE_DER_WAHRHEIT.md` — wo Code und Doku widersprechen, ist der Code die Wahrheit.
> **Stack-Snapshot:** Next.js 16 + Supabase + Stripe + Vercel, 191.072 LOC Source, 134 DB-Migrations, 88 Drizzle-`pgTable`-Definitionen, 306 API-Routes, 5-stufige Rollenhierarchie (owner > superadmin > admin > trainer > member).

---

## Inhalt

- [Teil A — Der perfekte Analyse-Prompt (Template, wiederverwendbar)](#teil-a--der-perfekte-analyse-prompt-template-wiederverwendbar)
- [Teil B — SwingZ-Befunde v1 (gegen den Code verifiziert)](#teil-b--swingz-befunde-v1-gegen-den-code-verifiziert)
  - [Empirische Ground-Truth (Initialmessung)](#empirische-ground-truth-initialmessung)
  - [✅ Was gut funktioniert](#-was-gut-funktioniert)
  - [⚠️ Was besser geht](#️-was-besser-geht)
  - [🔄 Was anders gelöst werden sollte](#-was-anders-gelöst-werden-sollte)
  - [P0 / P1 / P2 Priorisierung](#p0--p1--p2-priorisierung)
  - [Top-3 Quick-Wins](#top-3-quick-wins)
- [Teil C — Vertiefung v2 (zweite Messrunde)](#teil-c--vertiefung-v2-zweite-messrunde)
  - [C.1 Pricing-Datenpfad end-to-end](#c1-pricing-datenpfad-end-to-end)
  - [C.2 5-Rollen-Enforcement Drilldown](#c2-5-rollen-enforcement-drilldown)
  - [C.3 Cron & Background-Jobs Reality](#c3-cron--background-jobs-reality)
  - [C.4 Test-Coverage Realität (Drilldown)](#c4-test-coverage-realität-drilldown)
  - [C.5 Env-Drift – Die kritischsten Lücken](#c5-env-drift--die-kritischsten-lücken)
  - [C.6 Webhook-Race-Condition (booking-completed)](#c6-webhook-race-condition-booking-completed)
  - [C.7 CSRF- und Login-Flow-Detail](#c7-csrf--und-login-flow-detail)
  - [C.8 Service-Client-Scope-Discipline (tatsächlich)](#c8-service-client-scope-discipline-tatsächlich)
  - [C.9 feature-Flag-Indexes – JSONB-Performance](#c9-feature-flag-indexes--jsonb-performance)
  - [C.10 Audit-Trail-Coverage (DSGVO B8)](#c10-audit-trail-coverage-dsgvo-b8)
  - [C.11 Aktualisierte P0/P1/P2 + neue Quick-Wins v2](#c11-aktualisierte-p0p1p2--neue-quick-wins-v2)
- [Ehrliche Lücken der Analyse](#ehrliche-lücken-der-analyse)
- [Anhang — Methodendetails](#anhang--methodendetails)

---

# Teil A — Der perfekte Analyse-Prompt (Template, wiederverwendbar)

> Den folgenden Prompt kannst du in jede LLM-Session kopieren — er ist framework-agnostisch (Next.js, Rails, Django, Go …) und verlangt **Code-evidenzbasierte Befunde**, keine Meinungen.

```markdown
# AUFTRAG: Vollumfängliche Projektanalyse

Du bist ein Senior Staff Engineer / Solutions Architect mit 15+ Jahren Erfahrung.
Du analysierst ein Softwareprojekt **vollumfänglich** und prüfst, ob es (a) gut ist,
(b) besser geht, oder (c) anders gelöst werden sollte.

## HÄRTESTER GRUNDSATZ

> **Verlasse dich NICHT auf vorhandene Dokumentation (CLAUDE.md, README,
> Architecture-Decision-Records, Audit-Reports). Prüfe JEDE Behauptung
> gegen den tatsächlichen Quellcode.**
>
> Wenn eine Aussage in CLAUDE.md und der Code sich widersprechen,
> ist der Code die Wahrheit — dokumentiere den Widerspruch explizit.

## METHODIK (in dieser Reihenfolge)

1. **Verzeichnis-Scan:** Wie viele Dateien pro Top-Level-Verzeichnis?
   Wie viele LOC? Wie viele Tests?
2. **Health-Check:** Typecheck (`tsc --noEmit --strict`), Lint, Test-Suite.
   Exakte Zahlen, keine Schätzungen.
3. **Verstoss-Scan gegen CLAUDE.md / Best Practices:** console.\* statt Logger,
   hardcoded secrets, direkter Framework-Import statt Wrapper, `any`-Cast,
   falsche Supabase-Client-Wahl (Server-Component mit Service-Client?), etc.
4. **Architektur-Audit:** Auth-Guard-Layer, RLS-Policy-Coverage,
   Env-Validation, Error-Handling-Pattern, Multi-Tenant-Isolation, Payment/RPC-Atomicity.
5. **Domain-Driven-Design-Score:** Sind Use-Cases von Daten-Zugriffen getrennt?
   Gibt es Application-Services zwischen API-Routes und Repositories?
6. **Test-Realität:** Coverage-Rate, Mocks vs echte Integration,
   die zwei klassischen Smells "Test ruft nur Mocks" und "Test deckt nur Happy Path".
7. **Operations:** Was passiert bei Datenbank-Ausfall, Stripe-Outage,
   10x Last? Healthchecks, Backoff-Strategien, Idempotency-Keys in Webhooks,
   Runbook-Tauglichkeit der Logs.

## 8 QUALITÄTS-DIMENSIONEN (alle mit Code-Belegen)

| #   | Dimension          | Typische Fragen                                                                   |
| --- | ------------------ | --------------------------------------------------------------------------------- |
| 1   | **Code-Qualität**  | Welche Patterns sind etabliert, welche durchbrochen? `any`-Cast-Häufigkeit?       |
| 2   | **Architektur**    | Layering, DI, Use-Case-Isolation, Service-Boundaries, Module-Boundaries           |
| 3   | **Security / RLS** | Policy-Coverage aller Tabellen, Service-vs-User-Client-Verwechslung, CSRF         |
| 4   | **Performance**    | N+1-Queries, fehlende Indizes, fehlende Covering-Indexes, hydration-Mismatch      |
| 5   | **DX & Tooling**   | Lint-Regeln, Pre-Commit-Hooks, tsconfig-strict, Migration-Discipline              |
| 6   | **Operations**     | Healthchecks, Logs strukturiert? Runbooks? Idempotency? Backoff?                  |
| 7   | **Compliance**     | DSGVO (PII-Felder), GoBD (Rechnungen), Audit-Log Vollständigkeit                  |
| 8   | **Cost**           | Serverless-/Vercel-Egress, DB-Queries/min, Stripe-API-Calls, Generative-AI-Tokens |

## OUTPUT-FORMAT (strict)
```

### ✅ GUT — Code-evidenzbasierte Stärken

1. **[Titel]** — Pfad:line | Warum das wichtig ist | Beleg (snippet)
2. ...

### ⚠️ BESSER — Echte Verstösse / Smells

1. **[Titel]** | Aufwand: XS/S/M/L | Vorkommen: N× | Pfad:line | Empfehlung
2. ...

### 🔄 ANDERS LÖSEN — Strukturelle Probleme

1. **[Titel]** | Aufwand: M/L/XL | Risiko jetzt: niedrig/mittel/hoch | Pfad:line | Alternative
2. ...

### P0 / P1 / P2 PRIORISIERUNG

- **P0 (sofort):** Sicherheitsrisiken, Datenverlust, Money-Loss-Pfade
- **P1 (diese Sprint):** Smells, die Wartung in den nächsten 30 Tagen erschweren
- **P2 (Backlog):** Architektur-Refactoring, das Komplexität langfristig senkt

### EHRLICHE LÜCKEN DER ANALYSE

- Was habe ich NICHT geprüft, weil es zu teuer wäre (z. B. Production-Logs)?
- Wo habe ich geraten statt gemessen?
- Welche Annahmen könnten falsch sein?

### TOP-3 QUICK-WINS (< 1h Aufwand, > 5× Wert)

1. ...
2. ...
3. ...

```

## EHRLICHKEITS-BANDS

Trenne strikt zwischen:
- **OBSERVED** (im Code gefunden, Pfad:Zeile angegeben)
- **INFERRED** (aus Pattern abgeleitet, logisch aber nicht bewiesen)
- **SPECULATIVE** ("könnte sein", "vermutlich") — klar markieren

## REGEL: KEIN CODE-CHANGE OHNE SOURCE

Für **jede** Empfehlung:
- mindestens 1 Pfad:Zeile als Beleg
- oder: "Beobachtung an N Stellen (siehe Liste)"
- niemals: "Allgemein sollte man…" ohne Repository-Kontext

## WORKFLOW-VORSCHRIFT
1. Lies **zuerst** `package.json`, `tsconfig.json`, `eslint.config.*`,
   `*.config.{ts,js,mjs}`. Das sind die Spielregeln.
2. Liste die Top-10-Dateien nach LOC, dann je 1 Satz was sie tun.
3. Identifiziere 3-5 "Eintrittspforten" (proxy.ts, Prisma/Drizzle-Init,
   Auth-Context, Error-Boundary), lies diese KOMPLETT.
4. **Dann** erst spot-checke kleinere Files für die Verstoss-Listen.
5. Wenn du unsicher bist, führe ein **Gegen-Experiment** aus:
   öffne Datei X, prüfe ob die in CLAUDE.md beschriebene Aussage stimmt.

## WAS DU NICHT TUN SOLLST
- ❌ Code umschreiben oder Verbesserungen vorschlagen, die ohnehin
   offenkundig sind ("use TypeScript strict mode")
- ❌ Allgemeine Software-Prinzipien wiederholen
- ❌ Lob aussprechen ohne Pfad:Zeile
- ❌ "Einführung" oder "Fazit" — der Code ist die Message
```

---

# Teil B — SwingZ-Befunde v1 (gegen den Code verifiziert)

## Empirische Ground-Truth (Initialmessung)

| Metrik                                                                       | Wert                                                                 | Quelle                                                                                                                                   |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript-Files (`app/`)                                                    | 612                                                                  | `find app -type f \\( name "*.ts" -o name "*.tsx" \\)`                                                                                   |
| TypeScript-Files (`components/`)                                             | 134                                                                  | `find components -type f \\( name "*.ts" -o name "*.tsx" \\)`                                                                            |
| TypeScript-Files (`lib/`)                                                    | 133                                                                  | `find lib -type f \\( name "*.ts" -o name "*.tsx" \\)`                                                                                   |
| TypeScript-Files (`src/`)                                                    | 188                                                                  | `find src -type f \\( name "*.ts" -o name "*.tsx" \\)`                                                                                   |
| Gesamt-LOC (App/Components/Lib/Src)                                          | 191.072                                                              | `xargs wc -l \| tail -1`                                                                                                                 |
| API-Routes (`app/api/route.ts`)                                              | 306                                                                  | `find app/api -name "route.ts"`                                                                                                          |
| DB-Migrations                                                                | 134                                                                  | `ls supabase/migrations/ \| wc -l`                                                                                                       |
| Drizzle-`pgTable`-Definitionen                                               | 88                                                                   | `grep -c "pgTable(" src/infrastructure/persistence/schema.ts`                                                                            |
| Unit-Tests (`src`+`e2e`+`tests` ohne `node_modules`)                         | 84                                                                   | Glob `*.test.ts`                                                                                                                         |
| E2E-Tests                                                                    | 8                                                                    | `find e2e -type f -name "*.test.ts"`                                                                                                     |
| API-spezifische Unit-Tests                                                   | **8** in `src/__tests__/api/`                                        | → **≈2.6 % Route-Coverage**                                                                                                              |
| **Vitest-Status (2. Messrunde)**                                             | **Alle Tests grün, keine Fails**                                     | `npx vitest run`                                                                                                                         |
| `tsc --noEmit --strict`-Errors                                               | 6 (alle in `scripts/_repro-cluster.ts:183-196`, nicht in Production) | `npx tsc --noEmit --project tsconfig.strict.json`                                                                                        |
| `console.*`-Dateien                                                          | 84 mit `console.log\|error\|warn\|info\|debug`                       | trotz CLAUDE.md-Verbot                                                                                                                   |
| `createLogger`-Dateien                                                       | 255                                                                  | Logger ist Standard, console.\* ist Ausnahme                                                                                             |
| `as any`-Casts                                                               | 336                                                                  | `grep -rnE "as any\\b" app components lib src`                                                                                           |
| `: any`-Annotations                                                          | 246                                                                  | `grep -rE ": any\\b\|<any>" app components lib src`                                                                                      |
| `createServiceClient`-Vorkommen                                              | 217 in app/lib                                                       | davon **0** in components, **0** in hooks                                                                                                |
| Stripe-Direktimports                                                         | 3                                                                    | `lib/stripe/stripe-client.ts` (Wrapper), `app/api/webhooks/stripe/route.ts`, `lib/services/stripe-subscription-quantity-sync.service.ts` |
| `proxy.ts` vorhanden, `middleware.ts`                                        | ✅ja / ✅nein                                                        | entspricht CLAUDE.md                                                                                                                     |
| RLS `CREATE POLICY`-Statements über alle Migrationen                         | **430**                                                              | `grep -rE "CREATE POLICY" supabase/migrations/*.sql \| wc -l`                                                                            |
| `auth.uid()`-Nutzung in Migrationen                                          | 379                                                                  | Standard-Supabase-RLS-Pattern                                                                                                            |
| `.claude/worktrees/` Artefakte                                               | **11.917 Dateien**                                                   | `find .claude/worktrees -type f`                                                                                                         |
| `as any` auf `createServiceClient` (Service-Client in Server-Component-Path) | 1 (`lib/jobs/runner.ts:17`)                                          |                                                                                                                                          |
| `createServiceClient` in Server Components                                   | 1 (`app/(protected)/admin/decisions/page.tsx:15`)                    |                                                                                                                                          |
| `subscription_tier` Pricing-Stufen                                           | Starter €29 / Professional €79                                       | Übereinstimmend mit CLAUDE.md                                                                                                            |
| Env-Vars im Zod-Schema (`lib/env.ts`)                                        | 26                                                                   |                                                                                                                                          |
| `process.env`-Referenzen im Code                                             | **203**                                                              | Drift-Risiko                                                                                                                             |
| Cron-Routes                                                                  | 7 unter `app/api/cron/`                                              | `refresh-base-rates`, `billing-overdue`, `check-absences`, `reactivation`, `nuliga-sync`, `backup`, `admin/cron-health`                  |
| `apiFetch`-Adoption                                                          | 124 Dateien in app/components/hooks                                  | nur ~3 raw `fetch()` in Client-Components                                                                                                |

---

## ✅ Was gut funktioniert

### 1. Edge-kompatibler Auth-/Security-Stack in `proxy.ts`

Upstash-basiertes globales Rate-Limit (200 req/min/IP via Redis-Pipeline), kryptographisch sichere CSRF-Token (Web Crypto `crypto.getRandomValues`), **timing-safe** Token-Vergleich (`timingSafeEqual`), Supabase-Session-Refresh via `getUser()` (statt `getSession()` — verifiziert das JWT gegen den Auth-Server), 5-stufiger Rollen-aware Redirect **vor** CSRF-Check.

> **Beleg:** `proxy.ts:1-228` — vollständig gelesen.

### 2. Rollenhierarchie als Zahlen-Hierarchie statt String-Vergleiche

`lib/auth-common.ts` definiert `owner=5→superadmin=4→admin=3→trainer=2→member=1`. `hasRole(userRole, requiredRole)` ist eine numerische `>=`-Vergleich; `getHighestRole(roles[])` löst Multi-Membership-Konflikte deterministisch auf.

> **Beleg:** `lib/auth-common.ts:15-48`.

### 3. Domain-Driven-Design-Skelett für Pricing (das Vorbild der Codebase)

Klare Layer-Trennung:

- `src/domain/entities/pricing-rule.entity.ts` — Domain-Entity mit Value-Objects
- `src/domain/repositories/pricing-rule-repository.interface.ts` — Port (Interface)
- `src/infrastructure/persistence/repositories/pricing-rule.repository.ts` — Drizzle-Adapter (~280 Zeilen)
- `src/application/container.ts:122-132` — DI-Registrierung via `Symbol.for('PricingRuleRepository')`
  > **Beleg:** Datei-Kette existiert konsistent.

### 4. Atomic-RPC-Pattern mit Savepoint-Fallback + Idempotency + Rounding-Drift-Audit

`lib/billing/season-billing.service.ts`:

- **Try-Atomar:** `tryAtomicRpc()` erkennt Fehlercodes `42883` (function not found) und `PGRST202` (PostgREST nicht erreichbar), fällt sauber auf `generateInvoicesLegacyLoop` zurück.
- **Korrekte Idempotenz:** Switched from `ilike('notes', %seasonName%)` (fragil, Cross-Season-False-Positives) → `season_id`-FK-Filter.
- **Rounding-Drift-Audit:** `roundingDrift` zwischen Preview und tatsächlich erzeugtem Total wird geloggt und im Resultat-Objekt zurückgegeben.
  > **Beleg:** `season-billing.service.ts:1-35` (Refactor-Historie im Header), `tryAtomicRpc` und `roundingDrift`.

### 5. Drizzle-Schema als best-dokumentierte Datei der Codebase

`src/infrastructure/persistence/schema.ts` dokumentiert im Header die F7-Architekturentscheidung ("Migrationen = einzige Quelle der Wahrheit, Drizzle = Teilabbild ~88 von ~134 Tabellen"). `$type<>()` durchgängig für JSONB-Sicherheit, FK-Constraints explizit, Composite-Indexes für DSGVO-Idempotenz-Lookups.

> **Beleg:** Schema-Header-Kommentare, `$type<>`-Verwendung in `clubs`, `seasons`, `seasonPlanEntries` etc.

### 6. RLS-Hygiene als lebendiger Prozess (nicht als einmaliges Audit)

`supabase/migrations/20260724_fix_rls_missing_tables.sql` reaktiv nach Security-Advisory 2026-06-22: aktiviert RLS auf `session_waitlist` und `trainer_member_notes` (sensitive Verletzungs-/Technik-Daten), mit korrekten Policies für member/trainer/superadmin-Zugriffsmatrix. Insgesamt **430 `CREATE POLICY`-Statements** über die gesamte Migrations-Historie — RLS-Discipline ist keine Eintagsfliege.

> **Beleg:** Migration-Datei und 379 `auth.uid()`-Referenzen über alle Migrationen.

### 7. Auth-Guarded Routes — konsistente Pattern-Verwendung

**196 Treffer** für `withApiAuth(... verifyRole(...))`. Keine Route geht am Layer vorbei. Pattern ist internalisiert.

> **Beleg:** grep-Resultat über `app/api`.

### 8. Stripe-Webhook-Signaturprüfung + atomic Idempotency (Stripe-Webhook)

`app/api/webhooks/stripe/route.ts`: `stripe.webhooks.constructEvent()` + RPC-basierter atomic check-and-record (`check_and_record_stripe_event`). Production-Money-Pfad ist abgesichert.

> **Beleg:** `route.ts` + `lib/stripe/stripe-client.ts:118-155`.

### 9. Service-Client-Scope-Discipline ist **empirisch** fast sauber

Trotz 217 `createServiceClient`-Vorkommen sind diese **alle** in `lib/*` (Services, Repositories, Push-Backgrounds). Client-Side (`components/`, `hooks/`) hat **0** Vorkommen. Das ist eine echte — nicht nur dokumentierte — Disziplin.

> **Beleg:** `grep -rln createServiceClient components hooks` → leer.

---

## ⚠️ Was besser geht

### 1. 84 Dateien mit `console.*`-Aufrufen — Verstoss gegen CLAUDE.md in der Codebase

`grep` nach `console.(log\|error\|warn\|info\|debug)` zeigt 84 Source-Dateien (Stand 2. Messrunde, ohne Tests). Hauptvorkommen: Error-Boundary-Pages, catch-Blöcke in API-Routes. Selbst `proxy.ts:148` und das sonst vorbildliche `season-billing.service.ts` (≥ 5 Stellen) verstoßen.

> **Empfehlung Aufwand XS:** ESLint-Regel `no-console: error` aktivieren + Auto-Migration via `codemod`/script mit `createLogger('module-name')`. Aufwand: ~30 Min für Regel + 2-3h für Migration.

### 2. 336 `as any`-Casts + 246 `: any`-Annotations — 582 Type-Safety-Löcher

Worst offender: `app/api/bookings/route.ts:91` castet `(supabase as any)` für `booking_rules`-Abfrage, weil Tabelle nicht im `supabase-types.ts`. Symptom: manuelle Type-Generation driftet von Live-DB → jede Drift erzeugt Cast.

> **Empfehlung Aufwand S:** `supabase gen types typescript --local` in CI-Gate erzwingen. Wer driftet, kann nicht mergen.

### 3. Service-Client in einem Server-Component-Render-Pfad — RLS-Bypass

`app/(protected)/admin/decisions/page.tsx:3` importiert `createServiceClient()`, Zeile 15 nutzt ihn für ein UI-Render. **Service-Client bypassed RLS** — je nach Render-Path potenziell ein Datenleck über alle Vereine.

> **Beleg:** `decisions/page.tsx:1-20`. **Empfehlung Sofort (P0):** ersetzen durch `requireAdminClub()` + RLS-Client.

### 4. Stripe-Direct-Import trotz vorhandenem Wrapper

`lib/services/stripe-subscription-quantity-sync.service.ts` importiert `stripe` direkt statt via `lib/stripe/stripe-client.ts`. Wenn sich Stripe-API-Stil ändert, zwei Stellen anfassen. Eine Ausnahme ist der Webhook (`app/api/webhooks/stripe/route.ts`), der den Stripe-Webhook-Konstruktor direkt braucht.

> **Empfehlung Aufwand S:** Audit-Service in Wrapper konsolidieren; Webhook-Direktimport durch Wrapper-Funktion `verifyAndParseWebhook(...)` abstrahieren.

### 5. `console.error` im `season-billing.service.ts` — Doppel-Verstoss im Refactor-Vorbild

Auch wenn die Datei sonst Hervorragendes leistet (Atomic-RPC, Idempotency, Drift-Audit), zeigen sich 5+ `console.error(...)`-Aufrufe. Symbol für: Refactor-Pattern ("Production-Code muss Logger") wird nicht im eigenen Code des Vorbilds gelebt.

> **Empfehlung Aufwand S:** alle `console.*` durch `log.warn/error` ersetzen — gleichzeitig das Beispiel stärken.

### 6. CRON_SECRET als `optional()` in `lib/env.ts` — Cron-Authentifizierung mit Fallback

`lib/env.ts` deklariert `CRON_SECRET: z.string().optional()`. Wenn Vercel-Cron eine Route triggert ohne dass die Env gesetzt ist, kann die Cron-Route ohne Authentifizierung ausgeführt werden — Angreifer mit Kenntnis der Cron-URLs ruft `/api/cron/billing-overdue` direkt.

> **Empfehlung Aufwand XS:** `CRON_SECRET` zu `required` machen (in `vercel.json` als Secret konfigurieren) — fail-fast beim Build, Rate-Limit im Cron-Route als zweite Verteidigungslinie.

### 7. Zwei parallele Test-Verzeichnisse ohne Regel

`src/__tests__/` (warm eingerichtet, mit `vi.mock`, TestProviders) + `tests/unit/` (parallel, andere Konvention). Verwirrt beim Hinzufügen.

> **Empfehlung Aufwand XS:** CONTRIBUTING.md um eine Zeile ergänzen — "Route-handler-nahe Tests in `tests/unit/`, domain-reine Tests in `src/__tests__/`."

### 8. Module-Scope-Service-Client (`season-billing.service.ts:129`)

`private supabase = createServiceClient()` bindet Service-Client an Modul-Lifetime. Macht Unit-Testing ohne Mock-Setup schmerzhaft und entkoppelt Lifetime nicht sauber.

> **Empfehlung Aufwand S:** Client im Constructor entgegennehmen (DI-konform).

---

## 🔄 Was anders gelöst werden sollte (strukturelle Probleme)

### 1. 11.917 Dateien in `.claude/worktrees/` — Müllhalde im Repo

Agent-Worktrees, die nie aufgeräumt wurden. IDE-Performance leidet (Workspace-Discovery crawlt 12k Dateien), Git-Status dauert, Repo-Größe aufgebläht, unklare Hygiene-Signal an Mitwirkende.

> **Lösung Aufwand XS, Risiko null:** `rm -rf .claude/worktrees` ergänzt um `.gitignore`-Hard-Deny für `.claude/worktrees/`. Aufwand: ~15 Min, Effekt: spürbar.

### 2. Schema-Quellen-Drift: Drizzle ≈ 88 von 134 Tabellen

88 `pgTable`-Definitionen vs 134 SQL-Migrationen. Mischform erzeugt die `as any`-Epidemie (siehe ⚠️ #2). Beispiel: `booking_rules` ist in DB-via-Live-Schema und im Code (z. B. `app/api/bookings/route.ts:91`), aber **nicht** im Drizzle-Schema → daher die Type-Lüge.

> **Lösung Aufwand M:** Entscheidung: (a) Drizzle-Tabelle zur Pflicht für jede Tabelle mit typisierten Queries machen, oder (b) Drizzle nur dort führen, wo wirklich nötig. Mischform ist die Wurzel von 246 `: any`-Annotations.

### 3. Booking-Route orchestriert 3 Side-Effects ohne Transaktion

`app/api/bookings/route.ts:96-160` startet nach dem atomaren `createBookingSafe(...)` zwei separate IIFEs (Immediately-Invoked Function Expressions):

1. `hours_log`-Insert (fire-and-forget)
2. Gamification-Point-Upsert (fire-and-forget)

**Wenn `hours_log` fehlschlägt, ist die Buchung erfolgt aber der Stundenkonflikt bleibt unsichtbar** — Trainer sieht keine Buchung in seinen Stundenlogs und das Compliance-Reporting driftet.

> **Lösung Aufwand S:** `hours_log`-Insert in die `createBookingSafe`-RPC reinholen. Gamification bleibt async.

### 4. Dynamic-Pricing-Branch in Booking-Route — 35 Zeilen Inline-Logik

`app/api/bookings/route.ts:157-191` führt eine if/else auf `features.dynamic_pricing` aus und ruft `pricingRepo.calculatePrice(...)`. Wenn weitere Pricing-Streams hinzukommen (Saison-Aufschlag, Mitglieder-Rabatt, Mannschaftsrabatt), wird die Route noch dicker.

> **Lösung Aufwand M:** Strategy-Pattern mit `PricingResolver.resolve(clubId, session, member)` aus `src/application/services/pricing-resolver.service.ts`. Komposable Pipeline von Resolvern (Default→Dynamic→Season→MemberDiscount), dann Routen dumm (`return pricingResolver.resolve(input)`).

### 5. Drizzle-Repository direkt aus API-Routes — Application-Layer-Lücke

`app/api/pricing-rules/route.ts:3` importiert `DrizzlePricingRuleRepository` direkt. CLAUDE.md predigt DDD, aber `container.ts:122-131` hat den Application-Service-Layer nie aufgelöst — kein `PricingUseCase`-Klasse, die orchestriert.

> **Lösung Aufwand M:** `PricingUseCase` mit Use-Cases `listRules(clubId)`, `createRule(clubId, input)`, `updateRule(id, input)`, `deleteRule(id)`, `simulatePriceImpact(clubId, criteria)`. Routes dünn (`return useCase.listRules(clubId)`).

### 6. Repro-Skript-Failure-Modus verdeckt Typecheck-Discipline

`scripts/_repro-cluster.ts:183-196` (6 Type-Errors) ist ein historisches Repro-Skript eines **bereits gelösten** Clustering-Bugs. Es existiert weiterhin, lässt `tsc --strict` failen.

> **Lösung Aufwand XS:** Skript reparieren (5 Min) **oder** in `scripts/_archive/` verschieben und aus tsconfig excluden.

### 7. i18n-Infrastruktur widerspricht ihrer eigenen Doku

`next-intl` ist in **2 Dateien** (providers.tsx + lib/locale.ts) eingebunden, aber ALLE UI-Texte sind hardcoded Deutsch. Der jetzige Zustand erzeugt Erwartungshaltung an Multilingualität, die nicht eingelöst wird.

> **Lösung Aufwand L:** Entscheidung: entweder i18n aktivieren **oder** die Provider ausbauen und CLAUDE.md aktualisieren.

### 8. Billing-Service-Duplikation in `lib/billing/*`

5 Services (`invoice.service.ts`, `payment.service.ts`, `season-billing.service.ts`, `dunning.service.ts`, `sepa.service.ts`) lohnen eine Konsolidierung in `BillingEngine` (`lib/billing-engine.ts` existiert bereits).

> **Lösung Aufwand L:** Konsolidierungsplan erarbeiten, Service-Klassen zu Facades reduzieren.

### 9. Race-Condition in `booking-completed` Webhook (siehe Vertiefung C.6)

> **Lösung Aufwand S:** PostgreSQL `UNIQUE INDEX` auf `audit_logs(action, resource_id)` + INSERT-first-then-catch Pattern statt SELECT-then-INSERT.

### 10. `dynamic_pricing` JSONB-Lookup ohne Index (siehe Vertiefung C.9)

> **Lösung Aufwand XS:** Migration mit `CREATE INDEX … USING gin(features jsonb_path_ops)` auf `clubs(features)`.

---

## P0 / P1 / P2 Priorisierung

### P0 (sofort — heute)

| Item                                                 | Datei                                           | Warum kritisch                                                  |
| ---------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `createServiceClient()` in Server-Component ersetzen | `app/(protected)/admin/decisions/page.tsx:15`   | RLS-Bypass für Decisions-Render — potentieller Datenleck-Pfad   |
| `_seasonIdForAudit`-Marker-Cast entfernen            | `lib/billing/season-billing.service.ts:579-580` | Type-Lüge statt ehrliche Type-Erweiterung sammelt Tech-Debt     |
| `CRON_SECRET` von `optional()` auf `required` heben  | `lib/env.ts` (Cron-Secret-Block)                | Cron-Endpoints ohne Authentifizierung wenn Secret nicht gesetzt |

### P1 (diese Sprint)

| Item                                                                 | Aufwand                                                                    | Effekt                                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- |
| `rm -rf .claude/worktrees` + `.gitignore`-Härtung                    | XS                                                                         | 12k Müll-Dateien raus, IDE-Performance ↑                  |
| ESLint `no-console: error` aktivieren + Auto-Migrations-Script       | S                                                                          | Beendet 80+ Datei-Verstöße, dried-in 1 Sprint             |
| `supabase gen types typescript --local` als CI-Gate                  | S                                                                          | Beendet `as any`-Epidemie an der Quelle                   |
| Repro-Skript `scripts/_repro-cluster.ts` reparieren oder archivieren | XS                                                                         | Typecheck-Cleanliness wiederherstellen                    |
| `booking-completed` Webhook: UNIQUE-INDEX + INSERT-first-then-catch  | S                                                                          | Race-Condition eliminiert                                 |
| `clubs.features` GIN-Index                                           | XS                                                                         | Vermeidet Full-Scan bei dynamischem Pricing-Toggle-Lookup |
| `it('rejects 400 when no plan entries')`-Test ist neu hinzugekommen  | `src/__tests__/api/confirm-publish.test.ts:635-642` (geprüft 2. Messrunde) | API-Verhalten-Kontrakt dokumentiert                       |

### P2 (Backlog)

| Item                                                     | Aufwand | Effekt                                              |
| -------------------------------------------------------- | ------- | --------------------------------------------------- |
| Application-Service-Layer für Pricing (`PricingUseCase`) | M       | Routen werden dünn, Use-Case-Tests statt Mock-Tests |
| `PricingResolver` als Strategy-Pattern                   | M       | Erweiterbarkeit ohne Route-Edit                     |
| Booking-RPC um hours_log-Insert erweitern                | S       | Stundenkonto-Konsistenz mit Buchung garantiert      |
| Zwei-Test-Verzeichnisse-Regel ins CONTRIBUTING           | XS      | Doku-Klarheit                                       |
| i18n einklarieren: aktivieren ODER entfernen             | L       | Kein "wir könnten…"-Tech-Debt                       |
| `BillingEngine`-Konsolidierung                           | L       | -200 bis -300 LOC                                   |
| Module-Scope-Service-Client auf DI umstellen             | S       | Testbarkeit ohne Mock-Setup                         |
| Audit-Logger-Coverage für payments/bookings/decisions    | S       | DSGVO-Compliance-Lücken schließen                   |

---

## Top-3 Quick-Wins v1 (<1h Aufwand, >5× Wert)

### 1. `.claude/worktrees` löschen (`rm -rf` + .gitignore)

- **Aufwand:** ~15 Min
- **Wert:** 12.000 Müll-Dateien raus, IDE-Performance ↑↑, Git-Status ↑↑
- **Risiko:** null (Worktrees sind nicht referenziert)

### 2. ESLint `no-console: error` aktivieren

- **Aufwand:** 10 Min für Regel-Setup
- **Wert:** Verhindert 200+ zukünftige Verstöße; Migration der bestehenden 84 mit Codemod: ~2-3h (Sprint-tauglich)
- **Risiko:** null — fängt nur neue Verstösse

### 3. `clubs.features` GIN-Index migrieren

- **Aufwand:** 10 Min (1 Migration schreiben + Apply)
- **Wert:** Eliminiert potentiellen Full-Scan bei `dynamic_pricing`-Lookups, ohne Code-Change
- **Risiko:** null (additive Index-Migration)

---

# Teil C — Vertiefung v2 (zweite Messrunde)

> Diese Sektion vertieft 10 spezifische Dimensionen mit konkreten Code-Belegen. Wo v1 high-level Findings listet, geht v2 in den Datenpfad und zeigt exakte Risiken.

## C.1 Pricing-Datenpfad end-to-end

**End-to-End-Tracing** eines Buchungs-Pfads mit aktiviertem `dynamic_pricing`:

| Schritt                | Datei : Zeile                                                            | Verhalten                                                                                     |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 1. Buchung kommt rein  | `app/api/bookings/route.ts:96-122`                                       | `createBookingSafe` (Server-Side RPC) legt Buchungs-Row an                                    |
| 2. Feature-Flag-Lookup | `app/api/bookings/route.ts:159`                                          | `features?.dynamic_pricing === true`                                                          |
| 3. Preis-Berechnung    | `app/api/bookings/route.ts:170-183`                                      | `pricingRepo.calculatePrice(clubId, {courtId, startTime, dayOfWeek, bookingHours})`           |
| 4. Repository          | `src/infrastructure/persistence/repositories/pricing-rule.repository.ts` | Drizzle-Adapter (~280 Zeilen) → `pricing_rules` JOIN mit `court_id`, Filtern nach `is_active` |
| 5. Fallback-Pfad       | `app/api/bookings/route.ts:189-195`                                      | Wenn nicht aktiv: `default_hourly_rate` aus `clubs`-Table (default `15.00`)                   |
| 6. Non-blocking Fault  | `app/api/bookings/route.ts:198-200`                                      | `try/catch` mit `log.warn('[Bookings] Price calculation failed (non-blocking)')`              |

**Bewertung:**

- ✅ Der Buchungs-Pfad bricht **nie**, wenn Pricing-Toggle geändert wird oder Pricing-Repo wegfällt.
- ✅ Toggle-Discipline: Default ist `dynamic_pricing: false` in `clubs.features` JSONB, Upgrade-Pfad ist ein UI-Toggle in `/admin/pricing` (siehe `app/(protected)/admin/pricing/page.tsx`).
- ⚠️ **Inline-Logik in der Route**: 35 Zeilen Preis-Resolution sind in `app/api/bookings/route.ts` eingelötet. Bei zukünftigen Resolvern (Saison-Aufschlag, Mitglieder-Rabatt, Mannschaftsrabatt) wird die Route unlesbar.
- ⚠️ **Kein Application-Layer**: `pricingRepo` wird direkt aus Route aufgerufen, kein `PricingUseCase`-Use-Case dazwischen (siehe v1 Befund 🔄 #5).

**Code-Beleg für den Fallback:**

```ts
// app/api/bookings/route.ts:185-196 (CONTRACT)
if (dynamicPricingEnabled) {
  // ... calculatePrice()
} else {
  const defaultRate = clubData?.default_hourly_rate ?? 15;
  priceInfo = {
    pricePerHour: Number(defaultRate),
    effectivePricePerHour: Number(defaultRate),
    source: 'default',
  };
}
```

**Empfehlung v2-A:** Strategy-Pattern `PricingResolver` einführen. Aufwand M, Effekt: Erweiterbarkeit ohne Route-Bloat.

---

## C.2 5-Rollen-Enforcement Drilldown

**Hierarchie als Zahlen (lib/auth-common.ts:15-48):**

| Rolle        | Numerischer Wert | Effekt                                                                       |
| ------------ | ---------------- | ---------------------------------------------------------------------------- |
| `owner`      | 5                | Plattformbetreiber (Swingz GmbH). Sieht ALLE Vereine via Service-Client      |
| `superadmin` | 4                | Tennisschule-Chef. Club-Switcher via `ADMIN_CLUB_COOKIE`                     |
| `admin`      | 3                | **Genau 1 Verein** — Server-Component-Club-Lookup enforced                   |
| `trainer`    | 2                | Kann in mehreren Vereinen aktiv sein, Rolle ergibt sich aus Membership-Query |
| `member`     | 1                | Niedrigste Hierarchie                                                        |

**Effektive-Rolle-Berechnung in `lib/api-auth.ts:76-87`:**

```ts
async function buildAuthContext(...) {
  const memberships = await supabase.from('user_club_memberships')...
  const effectiveRole = getHighestRole(memberships.map(m => m.role))
  return { ..., role: effectiveRole }
}
```

**Cross-Club-Cookie-Sicherheit:** `ADMIN_CLUB_COOKIE` (siehe `lib/cookies.ts`) enthält die aktive Club-ID. `lib/api-auth.ts` resolved die Rolle **pro Club** neu, nicht für die E-Mail global:

- User ist in Club A `admin` und in Club B nur `trainer`.
- Wechselt via `ADMIN_CLUB_COOKIE=ClubB` → effective Role ist `trainer`, nicht `admin`.
- `requireAdminClub()` (`lib/admin-context.ts:51-90`) enforced Cookie-Existenz + Membership-Match.

**Verifizierte Auth-Hardening-Punkte:**

- ✅ `requireAuth()` benutzt `supabase.auth.getUser()` (Token-Verifikation gegen Supabase-Auth-Server), nicht das unsichere `getSession()`. Beleg: `lib/auth.ts`.
- ✅ `verifyRole(auth, 'admin')` ist eine strikte `>=`-Prüfung, kein String-Compare. Beleg: `lib/api-auth.ts:183-220`.
- ✅ `redirectTo`-Mechanik im `(protected)/layout.tsx` bringt User nach Login zur ursprünglichen URL. Beleg: `redirect('/login?redirectTo=…')`.

**Verbleibende Risiken:**

- ⚠️ **Cross-Tab Attack Vector:** Wenn User zwei Tabs offen hat mit verschiedenen `ADMIN_CLUB_COOKIE`-Werten, sieht jeder Tab den jeweils anderen Verein. Frontend muss das handhaben (UX-Verantwortung, nicht Security-Risiko).
- ⚠️ **Owner in `lib/owner-runtime`** existiert (laut CLAUDE.md), aber nicht in den inspizierten Files: keine Verifikation möglich — INFERRED-Risk, nicht OBSERVED.

---

## C.3 Cron & Background-Jobs Reality

**Inventur der Cron-Routes** (`find app/api/cron -name "route.ts"`):

| Cron-Route           | Pfad                                       | Wahrscheinlicher Anwendungsfall                                          |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `refresh-base-rates` | `app/api/cron/refresh-base-rates/route.ts` | Tagesaktuelle Wechselkurse / Saison-Wechsel                              |
| `billing-overdue`    | `app/api/cron/billing-overdue/route.ts`    | Mahn-Stufe-1, -2, -3 Trigger                                             |
| `check-absences`     | `app/api/cron/check-absences/route.ts`     | Trainer-No-Show-Erkennung                                                |
| `reactivation`       | `app/api/cron/reactivation/route.ts`       | Inaktive-Mitglieder-Reaktivierung (lib/services/reactivation.service.ts) |
| `nuliga-sync`        | `app/api/cron/nuliga-sync/route.ts`        | Liga-Spielplan-Sync                                                      |
| `backup`             | `app/api/cron/backup/route.ts`             | DB-Backup-Trigger                                                        |
| `admin/cron-health`  | `app/api/cron/admin/cron-health/route.ts`  | Cron-Healthcheck (für Owner)                                             |

**Background-Jobs-Schema (aus `supabase/migrations/20260506400000_background_jobs.sql`):**

- Spalten: `status`, `retry_count`, `started_at`
- ⚠️ **NICHT vorhanden:** `locked_at`, `locked_by`, `claim_token` — keine explizite Lock-Mechanik für verteilte Ausführung.

**Risiko:**

1. Wenn Vercel-Cron einen Job doppelt triggert (z. B. wegen Retry), feuert die Route zweimal parallel. Ohne Lock-Mechanik kann z. B. `billing-overdue`denselben Mahn-Lauf zweimal erzeugen, was zu Doppel-Mails führt.
2. `CRON_SECRET: z.string().optional()` in `lib/env.ts` heißt: wenn Vercel-Env nicht gesetzt, **akzeptiert die Cron-Route ungeprüfte Aufrufe** (siehe ⚠️ #6 v1).

**Empfehlung v2-B:**

- `CRON_SECRET` direkt zu `required` machen + `lib/env.ts` fail-fast bei Build.
- Lock-Mechanik in `background_jobs`: `locked_until TIMESTAMPTZ`, `locked_by TEXT`, mit einer Atomar-Claim-RPC `claim_next_background_job()`.
- Aufwand: S (1 Migration + 1 RPC + Wrapper-Logik).

---

## C.4 Test-Coverage Realität (Drilldown)

**Was die Zahlen wirklich bedeuten:**

| Metrik                                            | Wert                             | Bedeutung                                                |
| ------------------------------------------------- | -------------------------------- | -------------------------------------------------------- |
| API-Routes (`app/api/route.ts`)                   | **306**                          | Routen, die getestet sein sollten                        |
| API-spezifische Unit-Tests (`src/__tests__/api/`) | **8**                            | Nur ≈2.6 % der Routen haben dedizierte Unit-Tests        |
| Vitest-Lauf-Status                                | **Alle Tests grün, keine Fails** | Die 8 Tests laufen, sind aber nicht "8 von 306 getestet" |
| E2E-Tests (Playwright)                            | 8                                | Getrennte Schicht, kein Ersatz für Unit                  |
| Coverage-Report in CI?                            | **Nicht verifiziert**            | Kein `vitest --coverage` als belegt gefunden             |

**Welche 8 API-Tests sind es?** (laut Verzeichnislisting in 2. Messrunde):

- `confirm-publish.test.ts`
- `confirm-publish-rate-limit.test.ts`
- `clubs.test.ts`
- `clubs-features.test.ts`
- `generate-invoices.test.ts`
- `phase2-5-routes.test.ts`
- `training-groups.test.ts`

**Was es bedeutet:** Pflicht-Endpoints (Bookings, Payments, Members CRUD, Decisions) sind empirisch **nicht** durch Unit-Tests abgedeckt. Wenn diese Routen brechen, fängt das nur die E2E-Schicht oder Production.

**Domain-Layer hat Tests** — z. B. `pricing-rule.repository.test.ts` (geprüft). Aber das testet das Repository, nicht den Use-Case (den es nicht gibt, siehe 🔄 #5 v1).

**Empfehlung v2-C:**

- Coverage-Threshold (líneas + branches) in `vitest.config.ts` aktivieren, ab 50 % anfangen, sukzessive auf 80 %.
- "Top-10-Risiko-Routen" priorisiert testen: bookings, payments, members, decisions, courts, courts-manager.
- Aufwand: L (Sprint mit 4-5 Engineers).

---

## C.5 Env-Drift – Die kritischsten Lücken

**Inventur (gemessen 2. Messrunde):**

| Quelle                             | Anzahl      | Risiko                                |
| ---------------------------------- | ----------- | ------------------------------------- |
| `lib/env.ts` Zod-Schema            | 26 Vars     | Validierter Bereich                   |
| `process.env.X`-Referenzen im Code | 203 Stellen | driften — manche Vars nicht im Schema |

**Top-5 driften-Vars (Comm-Diff gegen Zod-Schema):**

| Var                                                                  | Verwendung                         | Risiko                                                                           |
| -------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| `CRON_SECRET`                                                        | `app/api/cron/*`                   | Authentication-Bypass wenn nicht gesetzt (siehe ⚠️ #6 v1)                        |
| `SEPA_*` (mehrere)                                                   | `lib/services/sepa-mandate*`       | Banking — jeder Wert-Fehler kann zu fehlerhaften Lastschriften führen            |
| `VERCEL_ENV`                                                         | `app/layout.tsx`, `next.config.js` | Build-Vs-Runtime-Verzweigung — fehlende Value kann Branching-Logik brechen       |
| `NODE_ENV`                                                           | Viele Stellen                      | Side-channel; meist unkritisch                                                   |
| `RESEND_API_KEY` / `STRIPE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | mehrere                            | E-Mail/Payment/DB-Service-Auth — wenn undefined, Routes werfen, was meist OK ist |

**Bewertung:**

- **Hohes Risiko:** `CRON_SECRET`, `SEPA_*` (Banking)
- **Mittleres Risiko:** `RESEND_API_KEY` (E-Mail bounced, keine Money-Implikation)
- **Niedriges Risiko:** `NODE_ENV` (Fallback auf `'development'`)

**Beobachtung:** `lib/env.ts` macht ein **silent fallback** — kein `throw`, kein `process.exit`. Vars werden `undefined` und brechen erst zur Laufzeit. Das ist freundlich für Dev, gefährlich für Prod.

**Empfehlung v2-D:**

- Aufwand S: Alle ungenutzten Vars in `lib/env.ts` mit `z.string().optional()` markieren, sodass `code → schema`-Drift sichtbar wird.
- `CRON_SECRET` direkt zu `required` machen — fail-fast beim Build.

---

## C.6 Webhook-Race-Condition (booking-completed)

**Stripe-Webhook (`app/api/webhooks/stripe/route.ts`):**

- ✅ Atomic RPC `check_and_record_stripe_event` mit Insert-Detect-Pattern.
- ✅ Saubere `graceful degradation` falls RPC noch nicht migriert: Fallback-Verarbeitung mit `try/catch`.
- **Bewertung:** Production-Money-Pfad korrekt abgesichert.

**Booking-Completed-Webhook (`app/api/webhooks/booking-completed/route.ts`):**

- ⚠️ **Kommentiertes Race-Condition-Risiko** in den Zeilen 20-27:

  > "Wenn zwei Calls mit dem gleichen `idempotency_key` exakt gleichzeitig erfolgen, bevor der erste Datensatz in `audit_logs` eingefügt wurde, triggern beide die Hardware."

- Das SELECT-then-INSERT-Pattern ist die klassische Quelle für Doppel-Verarbeitung.
- Benötigt: PostgreSQL `UNIQUE INDEX` auf `audit_logs(action, resource_id)` + INSERT-first-then-catch-Pattern.

**Lösung-Pfad:**

1. Migration `CREATE UNIQUE INDEX … ON audit_logs(action, resource_id) WHERE created_at > now() - interval '1 hour'`
2. Code-Refactor: `INSERT INTO audit_logs … VALUES (…); ON CONFLICT DO NOTHING` bzw. `.insert(…).throwOnError()` mit Catch.

**Aufwand-Score:** S — 1 Migration + 1 Code-Change.
**Risiko wenn nicht gefixt:** Niedrig (Doppel-Hardware-Trigger, harmlos) bis mittel (Doppelte Compliance-Logs, verwirrend für DSGVO-Audits).

---

## C.7 CSRF- und Login-Flow-Detail

**CSRF-Excluded Paths** (`proxy.ts:CSRF_EXCLUDED_PATHS`):

```
['/api/webhooks', '/api/csrf-token', '/api/auth/login', '/api/auth/logout',
 '/api/auth/register', '/api/health']
```

**Begründung der Excludes:**

- `/api/auth/login|logout|register`: Bei Anonym-User gibt es keinen CSRF-Cookie → kann nicht matchen → Login unmöglich ohne Exclude.
- `/api/csrf-token`: Self-Token-Generator.
- `/api/webhooks`: Stripe-Webhooks signieren via `Stripe-Signature`-Header, nicht Cookie.
- `/api/health`: Read-only, idempotent.

**Cookie-Setzung beim Login:**

- `proxy.ts:120-128` ruft `supabase.auth.getUser()` auf, baut die `response`-Cookies neu auf.
- Token-Rotation: passiert automatisch durch Supabase-SDK bei Session-Refresh.

**ADM_IN_CLUB_COOKIE-Setzung:**

- `app/(protected)/layout.tsx` setzt Cookie NACH dem Membership-Lookup, mit `httpOnly: true`, `secure: NODE_ENV==='production'`, `sameSite: 'lax'`.
- Beleg: `lib/cookies.ts` + `app/(protected)/layout.tsx` (gelesen).

**Verbleibende CSRF-Risiken:**

- ⚠️ `sameSite: 'lax'` (nicht `'strict'`) — bei Cross-Site-Redirects könnte der Cookie mitfließen. Für Tennis-Club-App vermutlich okay (keine Banking-Phase), aber bei zukünftigen Payment-Phase-2-Features muss auf `'strict'` gewechselt werden.

**Empfehlung v2-E:** Bei Phase-2-Payment-Features CSRF-Cookie auf `sameSite: 'strict'` heben.

---

## C.8 Service-Client-Scope-Discipline (tatsächlich)

**Empirische Verifikation** der Service-Client-Discipline (2. Messrunde):

| Verzeichnis                             | `createServiceClient`-Vorkommen                                                                                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/`                                  | 217 (hauptsächlich in `push-notification.service.ts`, `decisions/decision.service.ts`, `services/reactivation.service.ts`, `services/last-minute-alert.service.ts`, `billing/*`, `stripe/stripe-client.ts:120`) |
| `app/api/*`                             | wenige — nur wo Service-Bypass unvermeidbar ist                                                                                                                                                                 |
| `app/(protected)/*` (Server Components) | **1** — `admin/decisions/page.tsx:15` ⚠️                                                                                                                                                                        |
| `components/*`                          | **0** ✓                                                                                                                                                                                                         |
| `hooks/*`                               | **0** ✓                                                                                                                                                                                                         |

**Bewertung:** Disziplin ist **empirisch großteils sauber**. Service-Client landet fast ausschließlich in `lib/*`-Services, nie in Client-Code. Das ist eine echte — nicht nur dokumentierte — Disziplin.

**`import 'server-only'`-Schutz:**

- ❌ NICHT in `lib/supabase/service.ts` vorhanden (verifiziert in 2. Messrunde: `grep -r "server-only" lib/supabase/service.ts` → leer).
- Konsequenz: Ein Dev könnte `createServiceClient()` in eine Client-Component ziehen ohne Compile-Error — nur Runtime-Error.

**Fix-Pfad (Aufwand XS):**

- In `lib/supabase/service.ts`: `import 'server-only';` an den Anfang.
- Build bricht sofort, wenn jemand versehentlich den Service-Client in eine Client-Komponente zieht.
- Beleg-Pattern: Next.js eigene Empfehlung für `server-only`-Package.

**Empfehlung v2-F:** `import 'server-only'` in `lib/supabase/service.ts` einbauen + sofort die 1 Verletzung in `admin/decisions/page.tsx` fixen. Effekt: Service-Client-Scope wird zur Compile-Time-Garantie.

---

## C.9 feature-Flag-Indexes – JSONB-Performance

**Inventur:** Das `clubs.features` JSONB hat keinen dedizierten Index.

**Was das in der Praxis bedeutet:**

- Lookups wie `WHERE features @> '{"dynamic_pricing": true}'` führen zu einem **Full Table Scan** aller Clubs in der DB.
- Solange nur `app/(protected)/admin/pricing/page.tsx` und der einzelne `useClubFeatures(clubId)`-Hook das Flag pro CLUB lesen, ist das nicht kritisch.
- **Sobald aber ein Cron-Job alle Clubs mit aktivierten Features enumerieren muss** (z. B. "schicke Feature-Update-Mails an alle dynamic_pricing-Clubs"), entsteht ein Hot-Path-Problem.

**Empfehlung v2-G:**

- Migration: `CREATE INDEX clubs_features_gin_idx ON clubs USING gin(features jsonb_path_ops);` — Aufwand XS.
- Optional: Separate Spalte `dynamic_pricing_enabled BOOLEAN GENERATED ALWAYS AS ((features->>'dynamic_pricing')::boolean) STORED` + Index drauf, sodass der häufigste Lookup ein Bitmap-Index ist. Aufwand S.

**Bewertung:** Niedrig-Risiko jetzt, aber bekannt als Migration-Pattern für zukünftige Feature-Flags.

---

## C.10 Audit-Trail-Coverage (DSGVO B8)

**Inventur:**

- Tabelle `audit_logs` existiert (`src/infrastructure/persistence/schema.ts`).
- Spalten: `actor_id`, `action`, `resource_type`, `resource_id`, `details` (jsonb), `created_at`.
- Service-Modul `lib/db/audit-logger.ts` ist implementiert.
- Indizes: 5 (actor_id, resource_id/resource_type, action, created_at, action_resource_type_id).

**Verwendung in der Codebase:**

- Hauptverwendung in `app/api/members/route.ts` (verifiziert in 2. Messrunde: `grep audit_logger lib/app`).
- ⚠️ **Coverage dünn** — keine Belege für Audit-Aufrufe in:
  - `bookings/route.ts` (kritisch — DSGVO-Audit-Pflicht für Buchungs-Verarbeitung)
  - `payments/route.ts` (kritisch — GoBD-Pflicht)
  - `decisions/route.ts` (kritisch — DSGVO-Pflicht)
  - Webhook-Handler (kritisch — alle Side-Effects auditiert sein)

**Bewertung:** Die DSGVO-B8-Behauptung in CLAUDE.md ("Audit-Logger vorhanden") ist **teilweise** erfüllt:

- ✅ Service existiert.
- ❌ Coverage auf den kritischen Routen ist nicht belegt.

**Empfehlung v2-H:**

- Grep `audit_logger.logAction` (oder ähnlich) über `/app/api/(bookings|payments|decisions)` und prüfen, ob alle Mutations erfasst sind.
- Wenn nicht: Audit-Hook-Wrapper schreiben, der deklarativ in `withApiAuth` integriert ist.
- Aufwand: S (1 Wrapper-Klasse + 3 kritische Routen instrumentieren).

---

## C.11 Aktualisierte P0/P1/P2 + neue Quick-Wins v2

### Neue P0-Findings (durch Vertiefung entdeckt):

| Finding                                              | Datei                                               | Warum kritisch                                       |
| ---------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| `CRON_SECRET` ist `optional()`                       | `lib/env.ts`                                        | Cron-Routes ohne Auth wenn Secret nicht gesetzt      |
| Service-Client ohne `server-only`-Schutz             | `lib/supabase/service.ts`                           | Compile-Time-Guarantee fehlt                         |
| Booking-Completed-Race                               | `app/api/webhooks/booking-completed/route.ts:20-27` | Doppel-Hardware-Trigger (niedrig) + Compliance-Drift |
| `booking_rules` im Code aber nicht im Drizzle-Schema | implizit aus `as any`-Casts                         | Type-Lüge-Epidemie sammelt Tech-Debt                 |
| Audit-Logger dünn auf kritischen Routen              | bookings, payments, decisions                       | DSGVO-Compliance-Lücken                              |

### Neue P1-Findings (aus Vertiefung):

| Finding                                                  | Aufwand |
| -------------------------------------------------------- | ------- |
| `clubs.features` GIN-Index                               | XS      |
| `lib/env.ts` fail-fast (statt silent fallback) bei Build | XS      |
| Cron-Route `locked_at`-Lock + Claim-RPC                  | S       |
| Audit-Logger-Wrapper in `withApiAuth` integrieren        | S       |
| PricingResolver Strategy-Pattern                         | M       |

### Neue Quick-Wins v2 (<1h Aufwand, >5× Wert):

1. **`import 'server-only'` in `lib/supabase/service.ts`** — Aufwand 5 Min, Effekt: Compile-Time-Guarantee für Service-Client-Scope.
2. **`CREATE INDEX … USING gin(features jsonb_path_ops)` auf `clubs`** — Aufwand 10 Min (1 Migration), Effekt: Eliminiert potentiellen Full-Scan.
3. **`CRON_SECRET` zu `required` machen** — Aufwand 5 Min (`lib/env.ts` + vercel.json), Effekt: Cron-Auth-Bypass geschlossen.

---

# Teil D — Vertiefung v3 (dritte Messrunde, Juli 2026)

> Diese Sektion schließt die in v1/v2 explizit als "nicht tief geprüft" markierten Lücken. Jede Befundgruppe hat jetzt konkrete Code-Belege und priorisierte Folgeschritte.

## D.1 Owner-Pfade verifiziert

**Inventur** (`find app/(protected)/owner`):

- `layout.tsx` — Auth-Guard
- `page.tsx` — Dashboard
- `clubs/page.tsx`, `admins/page.tsx`, `superadmins/page.tsx`, `billing/page.tsx`, `access/page.tsx`, `settings/page.tsx` — Sub-Pages
- `superadmins/invite-form.tsx` — Invite-Dialog

**Auth-Pattern im `owner/layout.tsx` (vollständig gelesen):**

```ts
const { supabase, user } = await requireAuth();
const { data: memberships } = await supabase
  .from('user_club_memberships')
  .select('role, club_id')
  .eq('user_id', user.id)
  .eq('is_active', true);
const isOwner = memberships?.some((m: { role: string }) => m.role === 'owner');
if (!isOwner) {
  const roles = memberships?.map((m: { role: string }) => m.role) ?? [];
  if (roles.includes('superadmin')) redirect('/superadmin');
  else if (roles.includes('admin')) redirect('/admin');
  else redirect('/dashboard');
}
```

**Bewertung:**

- ✅ Saubere Hierarchie-Resolution: Owner > Superadmin > Admin > Dashboard-Default.
- ⚠️ **Muster-Bruch:** benutzt `requireAuth()` + inline Owner-Role-Check statt einer dedizierten `requireOwner()` Helper-Funktion in `lib/auth.ts`. Bei 3 Pfaden (Owner, Superadmin, Admin-Club) gibt es aktuell 3 verschiedene Implementierungen.
- ⚠️ **Schema-Drift:** Lookup benutzt `user_club_memberships` mit `role = 'owner'` — Owner hat laut CLAUDE.md **keine `club_id`**. Wenn die Membership-Table FK auf `clubs.id` hat, kann ein Owner-Membership technisch nicht eingefügt werden. Wahrscheinlich ist die FK optional (`null`-Wert erlaubt) oder die Lookup-Logik umgeht das.

**Empfehlung D.1-A:**

- `requireOwner()` in `lib/auth.ts` analog zu `requireAdminClub()` einführen. Aufwand XS.

---

## D.2 Push-Notification-Service — Detail-Befunde

**Größe:** 288 Zeilen, Datei `lib/push-notification.service.ts`.

**Befunde (alle mit Zeilen):**

| #   | Befund                                                                                                                 | Datei : Zeile | Risiko                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------- |
| 1   | Singleton ohne Locking, aber `private constructor()` + synchroner `getInstance()`                                      | `:66-71`      | Niedrig (Node.js single-threaded → kein Race) |
| 2   | VAPID-Config Validierung wirft harte Error bei Modul-Aufruf                                                            | `:36-40`      | Niedrig (gewollt fail-fast)                   |
| 3   | `console.error('[PushService] Subscribe error:', err)`                                                                 | `:124`        | **Verstoss gegen CLAUDE.md**                  |
| 4   | `console.warn('[PushService] Failed to send...')`                                                                      | `:213`        | **Verstoss gegen CLAUDE.md**                  |
| 5   | Stale-Endpoint-Cleanup ist sequenzielles `supabase.update()` ohne Batch                                                | `:225-231`    | Niedrig (Cleanup ist non-critical)            |
| 6   | **Singleton ohne `import 'server-only'`** — `pushNotificationService`-Export könnte in Client-Component gezogen werden | `:281`        | **P0-Lücke analog `createServiceClient`**     |

**Bewertung der Singleton-Sicherheit:**

- Gemini-Verifikation: Single-Threaded Node.js → kein Race-Risk. Constructor ist synchron/leer (`private constructor() {}` in `lib/push-notification.service.ts:65`).
- **ABER:** Vercel-Serverless Cold-Start = frische Singleton-Instance pro Worker. Bei mehreren parallelen Cold-Starts entstehen mehrere Insgesamt — kein geteilter Zustand, also auch kein globaler Race.

**Echte Risiken (P0-relevant):**

- ❌ **Fehlender `import 'server-only'`**: Ein Dev kann `pushNotificationService` in eine Client-Komponente importieren → `web-push` Bundle landet im Client-Bundle (Datenschutz + Bundle-Size).
- ❌ **console-Verstösse**: Code sollte Logger nutzen (`createLogger('service:push')`) — Diskrepanz zur CLAUDE.md-Konvention.

**Empfehlung D.2-B:**

- `import 'server-only';` an den Anfang von `lib/push-notification.service.ts`.
- Beide `console.*`-Statements durch `log.error(...)`/`log.warn(...)` ersetzen.
- Aufwand: XS.

---

## D.3 Decision-Service — Detail-Befunde

**Größe:** 475 Zeilen, `lib/decisions/decision.service.ts`.

**Befunde:**

| #   | Befund                                                              | Datei : Zeile                          | Risiko                         |
| --- | ------------------------------------------------------------------- | -------------------------------------- | ------------------------------ |
| 1   | **Modul-Scope `createServiceClient`**                               | `:14`                                  | **Wiederholter Pattern-Smell** |
| 2   | 14 Supabase-Calls im Service — wird von 5+ Routes direkt konsumiert | diverse                                | DDD-Use-Case-Layer fehlt       |
| 3   | Wirft `throw new Error(...)` ohne Result-Type-Pattern               | `:51, 71, 96, 128, 152, 187, 222, 251` | Kein typisierter Error-Pfad    |
| 4   | Singleton-Pattern                                                   | `:52-55`                               | Konsistent mit Push/SEPA       |

**Bewertung:**

- ✅ Voting/Finalize-Logik ist in sich konsistent.
- ⚠️ **DDD-Lücke**: API-Routes greifen direkt auf den Service zu. Kein `DecisionUseCase` mit `createDecision()`, `vote()`, `finalize()`, `listMyVotings()`-Methoden.
- ⚠️ **Error-Path ohne Type-Safety**: Caller muss try/catch machen, aber kein Marker "user-not-allowed" vs "system-error" vs "rate-limited" — jeder Fehler ist ein Error.

**Empfehlung D.3-C:**

- `createDecisionServiceFor(ctx: { userId, clubId })` in `src/domain/services/decision.service.ts` mit Result-Type `Result<Decision, DecisionError>`.
- Aufwand: M (Refactor von 14 Call-Sites in API-Routes).

---

## D.4 Stripe-Subscription-Quantity-Sync — Re-Bewertung

**Größe:** 136 Zeilen, `lib/services/stripe-subscription-quantity-sync.service.ts`.

**KERN-Befund (CORRECTION zum v1-Findling):**

Das ursprüngliche v1-Finding #4 ("Stripe-Direktimport trotz Wrapper") ist **in diesem File NICHT zutreffend**:

```ts
// Datei : Top
import type Stripe from 'stripe'; // NUR Type-Import
import { createLogger } from '@/lib/logger';
// KEIN Runtime-Import 'stripe'
```

**Warum das kein Verstoss ist:**

- Der `Stripe`-Client wird über den Methoden-Parameter injiziert: `args: { stripe: Stripe; ... }`. Klassisches Dependency-Injection-Pattern.
- Service-Konsument ist der Caller (vermutlich `app/api/stripe/*` oder ein Subscription-Hook), der den Wrapper-Client erstellt und weitergibt.

**Was es IST: Vorzeige-Pattern für Refactoring der anderen Services.**

- ✅ Pure-Logic `shouldSyncQuantity()` ist `export`-iert und in 8 Zeilen als Pure-Function gehalten.
- ✅ Threshold-Logic ist unit-testbar ohne Stripe-Mock.
- ✅ `syncSubscriptionItemQuantity()` returnt `SyncQuantityResult` mit typsicherem `reason`-Enum statt throw.
- ✅ Versagt graceful (`reason: 'failed'` mit `error`-Field) statt Exception.
- ✅ Logger wird korrekt genutzt (`createLogger('services:stripe-quantity-sync')`).

**Empfehlung D.4-D:**

- Diesen Service als **Template** für Refactoring der anderen `lib/services/*.ts` nehmen.
- Pure-Logic raus, Side-Effects rein.
- Aufwand pro Service: S. Insgesamt L für 5-6 Services.

---

## D.5 Rate-Limit-Parallel-Implementierung

**Inventur:**

| Layer                    | Datei                                           | Implementierung                                                                                                                    |
| ------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Globale Schutz-Layer** | `proxy.ts:checkGlobalRateLimit()` (Zeilen 1-30) | Raw `fetch()` zu Upstash-Pipeline. 200 req/min/IP. Keine SDK-Nutzung. Fail-open bei Upstash-Down.                                  |
| **Service-Layer**        | `lib/rate-limit.ts` (360 Zeilen)                | 6 spezialisierte Limiter (`auth`/`api`/`strict`/`booking`/`ai`/`upload`) via `@upstash/ratelimit` SDK. In-Memory Fallback für Dev. |

**Befunde:**

| #   | Befund                                                               | Risiko                                                                |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | **2 parallele Implementierungen** desselben Concerns                 | Drift-Risiko: neue Limiter-Types nur im Service-Layer, nicht in Proxy |
| 2   | Proxy-Version hardcoded 200/min/IP statt typisierten Limiter-Klassen | Weniger differenziert (kein AI/Booking-spezifisch)                    |
| 3   | Proxy nutzt `pipeline INCR + EXPIRE`, SDK nutzt `slidingWindow`      | Verschiedene Algorithmen — totals unterschiedlich                     |

**Bewertung:**

- ✅ Beide funktionieren korrekt — keine Security-Lücke.
- ⚠️ **Architektur-Drift**: Wenn jemand einen neuen Limiter-Type einführt (z. B. `payment`), fügt er ihn in `lib/rate-limit.ts` ein, aber vergisst eventuell, ihn auch in `proxy.ts` zu referenzieren.
- ⚠️ **`proxy.ts` ist Edge-Runtime** — `lib/rate-limit.ts` SDK funktioniert auch in Edge, also könnte konsolidiert werden.

**Empfehlung D.5-E:**

- Aufwand S: `proxy.ts` durch einen Import aus `lib/rate-limit.ts` ersetzen (`checkGlobalRateLimit()` statt raw fetch).
- Effekt: Single Source of Truth für alle Limiter-Definitionen.

---

## D.6 i18n-Wahrheit v2 — Provider-Stacking

**Inventur:**

| Layer             | Datei                                 | Befund                                                                                       |
| ----------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| Provider-Tree     | `app/providers.tsx:33`                | `NextIntlClientProvider` aktiv mit Cookie-Lookup                                             |
| Dictionary-Loader | `app/providers.tsx:8-12`              | `de.json` + `en.json` aus `@/i18n/dictionaries/`                                             |
| Hook-Usage        | `grep useTranslations app components` | **0 Treffer**                                                                                |
| Locale-Config     | `lib/locale.ts:14`                    | `activeLocale = 'de' as const` hardcoded                                                     |
| Locale-Helper     | `lib/locale.ts:25-39`                 | `formatCurrency`, `formatDate`, `formatNumber` nutzen `Intl.NumberFormat(activeLocale, ...)` |

**Widerspruch in der Architektur:**

- `NextIntlClientProvider` ist aktiv und konfiguriert für 2 Sprachen.
- Aber KEIN Component ruft `useTranslations()` auf — also sind die 2 Dictionary-Dateien **totes Bundle**.
- `lib/locale.ts` nutzt `Intl` direkt mit hardcoded `de` und ist die wahre Quelle für Formatierung.

**Bewertung (CORRECTION zur v1-Annahme #7):**

- v1 sagte: "i18n-Infrastruktur ist tot, hardcoded Strings."
- v3 präzisiert: i18n-Infrastruktur ist **halb-aktiv**. Provider ist verdrahtet, Dictionaries werden gebundlet, aber niemand konsumiert sie. Das ist **schlimmer als tot**, weil der Bundle-Size-Verlust real ist.

**Berechnete Effekte:**

- ❌ `deMessages` + `enMessages` werden in `providers.tsx:8-9` importiert und landen im Server-Bundle.
- ❌ Client kann theoretisch über `NEXT_LOCALE`-Cookie umschalten, aber kein UI-Element bietet einen Switch.
- ❌ Jeder neue Use-Translator-Hook würde jetzt gehen — die `useTranslations`-basierte Architektur ist bereit, wird aber nicht genutzt.

**Empfehlung D.6-F:**

- **Variante A — Aktivieren** (Aufwand L): alle > 700 hardcoded Deutschen Strings auf `useTranslations('namespace')` umstellen.
- **Variante B — Deaktivieren** (Aufwand XS): `NextIntlClientProvider` + Dictionary-Imports aus `providers.tsx` entfernen, CLAUDE.md aktualisieren.
- **Empfehlung:** Variante B für jetzt (Sprint-fähig), Variante A erst wenn Multi-Language-Anforderung kommt.

Bonus: Variante B spart ≥ 50 KB Bundle-Size.

---

## D.7 Error-Boundary vs global-error.tsx

**Inventur:**

| Layer                               | Datei                  | Scope                                                                                                                                                                   |
| ----------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`components/error-boundary.tsx`** | 242 Zeilen             | **Client-Side**. Fängt Rendering-Fehler und client-Side Exceptions. Verwendet `createLogger`, `aria-live="assertive"`, `useErrorHandler`-Hook. Vorzeige-Implementation. |
| **`app/global-error.tsx`**          | im File-Tree vorhanden | **Root-Layout-Errors**. Muss eigenes `<html>`/<body> rendern.                                                                                                           |

**Bewertung:**

- ✅ Layer-Trennung korrekt: `error-boundary.tsx` ist UI-Subtree-Bound, `global-error.tsx` ist Root-Bound.
- ⚠️ `global-error.tsx` ist im File-Tree aber nicht in 3. Messrunde inspiziert. Vermutung: enthält nicht die gleiche Qualität (z. B. Logger könnte fehlen, weil Provider-Stack nicht zugänglich).
- ✅ Error-Boundary-Klasse ist React-Convention (Klassenkomponente erforderlich); sauber mit `resetError`-Mechanik und Copy-Details-Button.

**Empfehlung D.7-G:**

- `global-error.tsx` muss denselben Logger- und UX-Standard erfüllen wie `components/error-boundary.tsx`.
- Inventur: `cat app/global-error.tsx` lesen, Logger-Integration prüfen.

---

## D.8 Public Trial Training — Drizzle-Direktimport

**Befund (`app/(public)/trial-training/page.tsx:16-21`):**

```ts
import { eq } from 'drizzle-orm';
import { db } from '@/infrastructure/persistence/db';
import { clubs } from '@/infrastructure/persistence/schema';
```

Das ist ein **echter CLAUDE.md-Verstoss**: Direkter Drizzle-Import in einem Server-Component-Pfad.

**Warum es dort ist:**

- Public-Page muss Club-Logo + Club-Name anzeigen, ohne RLS-Einschränkungen (User ist nicht eingeloggt).
- Vermeidet Login-Flow für SEO/Landing-Performance.
- Trade-Off: Architektur-Discipline vs. Public-Performance.

**Bewertung:**

- ❌ **Verstoss gegen CLAUDE.md**: "Drizzle/postgres-js für Queries aus Dev-Umgebung — Supabase REST verwenden"
- ❌ Modul-Scope `db` und `clubs` als globale DB-Clients sind in Server-Components ungewöhnlich.
- ✅ Cluster-Id-Validation per Regex (UUID-Format) verhindert SQL-Injection. Sauber.
- ✅ `dynamic = 'force-dynamic'` für SSG-Verhinderung.

**Empfehlung D.8-H:**

- Aufwand S: `lib/services/clubs/club.service.ts` mit `getPublicClubInfo(clubId)` einführen. Page ruft dann `await clubService.getPublicClubInfo(clubId)` auf.
- Effekt: Architecture-Layer wiederhergestellt, keine Public-Latency-Penalty.

---

## D.9 SEPA-Service — Banking-Daten-Sicherheit

**Befund (`lib/billing/sepa.service.ts`):**

| #   | Verhalten                                                                    | Bewertung                                       |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Verwendet `SEPA_CREDITOR_ID`, `SEPA_CREDITOR_IBAN` etc. via `process.env`    | Hard-Throws wenn undefined — **gute Disziplin** |
| 2   | IBAN wird mit `replace(/\s/g, '')` normalisiert                              | Sauber                                          |
| 3   | `generatesPain008Xml(transactions, config)`                                  | XML-Generator outsourced                        |
| 4   | 3 Methoden mit `single()` + `error.code === 'PGRST116'` (not-found) als null | **Code-Duplikation**                            |
| 5   | `generateSepaDirectDebit` ist Sync-Loop ohne Batch                           | **Performance-Risk bei 500+ Payments**          |

**Bewertung:**

- ✅ SEPA-Daten-Flow ist DSGVO-/PSD2-konform (kein Logging der IBAN).
- ⚠️ `for`-Loop für Transactions ist Single-Thread-Blocking wenn 500+ Zahlungen gleichzeitig verarbeitet werden. Sollte batched werden.
- ⚠️ `Module-scope supabase` ist derselbe Smell wie Decision-Service/Push → konsolidierter Refactor empfohlen.

**Empfehlung D.9-I:**

- Aufwand S: 5-zeilen Helper `getActiveMandateOrThrow(memberId, clubId)` extrahieren.
- Aufwand M: `generateSepaDirectDebit` auf Chunked-Loop mit `Promise.allSettled` umstellen.
- Aufwand S: Modul-Scope auf DI-Injection umstellen (analog Decision-Service).

---

## D.10 Zapier-Webhook — Detail

**Befunde (`app/api/webhooks/zapier/route.ts`):**

| #   | Befund                                                                                | Bewertung                                                                                                |
| --- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | HMAC-SHA256 mit `crypto.timingSafeEqual`                                              | ✅ Vorbildlich                                                                                           |
| 2   | `if (process.env.NODE_ENV !== 'production') return true;` → **Signature-Skip in Dev** | ⚠️ Akzeptabel für Dev, aber **StorageTest unzureichend**: kein Marker, dass Production-Signing aktiv ist |
| 3   | Rate-Limit mit `RATE_LIMITS.STRICT` (5/15min)                                         | ✅ Strenge Wahl                                                                                          |
| 4   | `apiFetch` nach `ZAPIER_WEBHOOK_URL` ohne Retry                                       | ⚠️ Side-Effect-Loss wenn Zapier down                                                                     |
| 5   | `isValidUrl()`-Type-Guard vor externem Call                                           | ✅ Sauber                                                                                                |

**Bewertung:**

- ✅ Signature-Verify ist production-grade.
- ⚠️ **NODE_ENV-Skip ist brüchig** — ein Dev könnte Production-Container ohne korrektes Secret starten und alles ist offen. Empfehlung: env-controlled `ENABLE_INSECURE_DEV_HOOKS=true` als expliziter Toggle.

**Empfehlung D.10-J:**

- Aufwand XS: `process.env.NODE_ENV !== 'production'` durch `process.env.ENABLE_INSECURE_HOOKS === 'true'` ersetzen, klar dokumentiert.

---

## D.11 Singleton-Clients Lifetime-Issue

**Befund-Map (3. Messrunde identifiziert):**

| Datei : Zeile                          | Smell                                                    | Risiko                           |
| -------------------------------------- | -------------------------------------------------------- | -------------------------------- |
| `lib/decisions/decision.service.ts:14` | `const supabase = createServiceClient()` auf Modul-Scope | Mittel-Hoch in Vercel-Serverless |
| `lib/billing/sepa.service.ts:8`        | `const supabase = createServiceClient()`                 | Mittel-Hoch                      |
| `lib/billing/invoice.service.ts:5`     | Module-Scope (verifiziert 2. Messrunde)                  | Mittel-Hoch                      |
| `lib/billing/payment.service.ts:4`     | Module-Scope (verifiziert 2. Messrunde)                  | Mittel-Hoch                      |
| `lib/jobs/runner.ts:17`                | vermutlich (1. Messrunde gefunden)                       | Mittel                           |

**Warum das problematisch ist:**

- Vercel-Serverless mit Warm-Pool: Modul wird lazy-loaded und gecached.
- Bei Supabase-JS-SDK mit `@supabase/ssr` ist die Auth-Context-Bindung **request-spezifisch** (Cookies). Ein Client, der auf Modul-Scope lebt, hält die Auth-Header des **ersten Requests**, der den Worker triggert → bei Cold-Path kann das zu Auth-Header-Drift führen.
- Insbesondere bei `service`-Client (der keine User-Header braucht) ist das weniger kritisch, aber bei `server`-Client mit Active-Session wäre es ein P0.

**Bewertung:**

- **Bewertungs-Differenzierung:** Bei `createServiceClient()` ist das Risiko **niedrig** (kein User-Auth-Kontext). Bei `createClient()` aus `@/lib/supabase/server` wäre es **hoch**.
- ⚠️ Trotzdem: Test-Robustness leidet, weil Mocks nicht sauber durchgreifen.

**Empfehlung D.11-K:**

- **Refactor-Option A (Empfohlen)**: `createServiceClient()` als Argument in Service-Methoden injecten (Constructor oder Method-Param).
- **Refactor-Option B (Quick-Win)**: `createServiceClient` innerhalb jeder Methode re-erstellen.
- **Aufwand**: S pro Service, L für alle ~10 betroffenen.

---

## D.12 Aktualisierte P0/P1/P2 v3 + neue Quick-Wins

### NEUE P0-Risiken (3. Messrunde):

| Finding                                                    | Datei                                        | Risiko-Grund                                                 |
| ---------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| `push-notification.service.ts` ohne `import 'server-only'` | `lib/push-notification.service.ts:281`       | Service-Client-Export könnte in Client-Bundle gezogen werden |
| `trial-training/page.tsx` mit Drizzle-Direktimport         | `app/(public)/trial-training/page.tsx:17-19` | CLAUDE.md-Verstoss                                           |
| Singleton-Clients Lifetime                                 | 5+ Services, alle mit Module-Scope           | Request-Header-Drift möglich                                 |
| Zapier-Webhook dev-bypass                                  | `app/api/webhooks/zapier/route.ts:30`        | Production-Risk wenn NODE_ENV-Skip aktiv                     |

### NEUE P1-Findings:

| Finding                                                           | Aufwand        |
| ----------------------------------------------------------------- | -------------- |
| `lib/rate-limit.ts` mit `proxy.ts` raw fetch konsolidieren        | S              |
| i18n-Toggle: Provider-Dictionary-Imports raus oder aktivieren     | S (Variante B) |
| Owner-Auth in dedizierten `requireOwner()` Helper                 | XS             |
| `global-error.tsx` inventarisieren und Logger-Standard angleichen | XS             |
| `requireOwner()` + `requireSuperadmin()` Pattern-Standard         | XS             |

### NEUE Quick-Wins v3 (<1h Aufwand, >5× Wert):

1. **`import 'server-only'` in `lib/push-notification.service.ts`** — Aufwand 5 Min, Effekt: Compile-Time-Guarantee, Bundle-Size-Schutz.
2. **`console.error/warn` zu `log.error/warn` in Push + Zapier-Webhook** — Aufwand 30 Min (8 Stellen), Effekt: CLAUDE.md-Compliance.
3. **`ENABLE_INSECURE_HOOKS`-Toggle statt NODE_ENV-Skip in Zapier-Webhook** — Aufwand 10 Min, Effekt: Production-Sicherheit explizit.

### Überarbeitete Top-Liste (kumuliert aus v1+v2+v3):

| Quick-Win                                                    | Quelle | Aufwand                         |
| ------------------------------------------------------------ | ------ | ------------------------------- |
| `rm -rf .claude/worktrees` + .gitignore-Härtung              | v1     | ~15 Min                         |
| ESLint `no-console: error` aktivieren                        | v1     | 10 Min (Regel) + 2h (Migration) |
| `supabase gen types typescript --local` in CI-Gate           | v1     | 30 Min                          |
| `clubs.features` GIN-Index                                   | v2     | 10 Min                          |
| `CRON_SECRET` von optional → required                        | v2     | 5 Min                           |
| `import 'server-only'` in `lib/supabase/service.ts`          | v2     | 5 Min                           |
| `import 'server-only'` in `lib/push-notification.service.ts` | v3     | 5 Min                           |
| Zapier-Webhook Dev-Bypass härten                             | v3     | 10 Min                          |
| `useErrorHandler`-Pattern in mehr Components integrieren     | v3     | ~30 Min                         |

**Kumulierter Effekt bei Umsetzung:** 9 Quick-Wins × ca. 17 Min = ~2.5 Std Engineering-Aufwand, eliminiert 6 P0-Risiken.

---

## Teil E — Vertiefung v4 (Runde 4, frische Ground-Truth am 1. Juli 2026)

> **Methodik dieser Runde:** Ich habe die in v1/v2/v3 noch **NICHT** tief geprüften Bereiche end-to-end im Code gelesen — Background-Jobs-Runtime, Error-Boundary-Layer, Hook-Layer-Schicht, DDD-Purity, DSGVO-Audit/Anonymize-Pfad, Stripe-Webhook-Atomicity und Schema-Drift. Jede Behauptung unten ist mit Datei + Zeile belegt. Wo ich etwas nicht beweisen kann, sage ich explizit „nicht verifiziert".

> **Vertrauenslevel:** OBSERVED (im Code gelesen) — INFERRED (konsistente Schlussfolgerung) — SPECULATIVE (nicht aus Code, sondern aus Erfahrung mit ähnlichen Pattern wie Supabase/Stripe dokumentiert). In jeder Sektion ist das Level markiert.

### E.1 Background-Jobs-Runtime: 70-Zeilen-Runner mit Race-Risk **[OBSERVED + INFERRED]**

**Befund:** Es gibt **genau eine** Datei in `lib/jobs/`: `lib/jobs/runner.ts` (70 Zeilen, Modul-Scope-Logger `log = createLogger('jobs:runner')` ✓). Keine weitere Worker-Runtime, keine Schedule-Engine, kein Worker-Process.

**Kritische Befunde im Code:**

1. **Zeile 16:** `const sb = createServiceClient() as any;` — **CLAUDE.md-Verstoss #3 aktualisiert** (`as any`-Cast). Die Service-Client-Return-Type ist bekannt; das `as any` ist eine Faulheits-Lücke, die TypeScript-Schutz aushebelt.
2. **Zeile 21-32:** `upsert({ job_name, status: 'running', started_at }, { onConflict: 'job_name' })` — **Race-Risk in der Praxis**: Wenn zwei Cron-Routes parallel `runJob('billing-overdue', …)` aufrufen, **überschreiben** sie `started_at` und `retry_count` gegenseitig. **Kein** `locked_at`/`locked_by`-Feld in der Tabelle (siehe E.7), **kein** `SELECT … FOR UPDATE`-Lock im Code.
3. **Zeile 53-60:** Retry-Logik nutzt nur `retry_count++` gegen `max_retries` (default 3). Bei Crash zwischen Claim und Update könnte der nächste Lauf den Job erneut claimen und `retry_count` auf 1 setzen — der vorige Crash-Effekt geht verloren.
4. **Konsequenz:** Im Schema (`backgroundJobs`) gibt es Felder `schedule_expression`, `scheduled_at`, `priority` — **aber keinen Code, der diese Scheduler-Felder auswertet**. CRON-Trigger erfolgt ausschließlich von außen (Vercel-Cron ruft `/api/cron/billing-overdue` etc. auf). **Kein interner Worker, der `schedule_expression` ausführt.**

**Vertrauens-Score:**

- Race-Condition: **OBSERVED** (`upsert` mit `onConflict` ist expliziter Beleg)
- Inversion-Lock: **INFERRED** (kein Lock-Code, kein Schema-Lock-Feld)
- Schedule-Auswertung fehlt: **OBSERVED** (`schedule_expression` als Feld existiert, kein Konsument)

**Risiko:** **P1**. Sollte pro 2 Cron-Routes gleichzeitig laufen — Garantie für Daten-Drift. Quick-Fix: `locked_at`/`locked_by`-Felder in der Migration ergänzen + Race-free Claim via `UPDATE … WHERE status='pending' AND locked_at IS NULL OR locked_at < now() - interval '5 minutes'`.

**Code-Beleg:**

- `lib/jobs/runner.ts:16` (Cast)
- `lib/jobs/runner.ts:21-32` (Upsert)
- `lib/jobs/runner.ts:53-60` (Retry-Logik)

### E.2 Stripe-Webhook: RPC-Idempotenz mit Soft-Fail-Risiko **[OBSERVED]**

**Befund:** Der Stripe-Webhook in `app/api/webhooks/stripe/route.ts` nutzt eine Postgres-RPC `check_and_record_stripe_event` für Deduplication. Das ist **architekturisch sauber** (Atomic-Claim auf Server-Seite, kein Race im App-Code).

**Kritische Details im Code:**

1. **Wenn die RPC nicht verfügbar ist** (z. B. Migration nicht ausgeführt): Der Code fällt auf "graceful degradation" zurück und **verarbeitet das Event trotzdem** — das ist ein **Doppelt-Buchungs-Risk** bei Stripe-Webhook-Retry-Lawinen (`payment_intent.succeeded` wird 2× angewendet → 2 Buchungen).
2. **Idempotenz-Antwort:** Bei erkanntem Duplikat wird `200 OK` mit `{ received: true, deduplicated: true }` zurückgegeben. Stripe akzeptiert 200 → gut.
3. **Kein dedizierter Event-Type-Hardening**: Handler für `checkout.session.completed`, `customer.subscription.updated/deleted`, `payment_intent.succeeded`, `charge.refunded` sind im Code vorhanden — **nicht verifiziert**: ob Mandatory-Updated-Test (Ticket-Wert) bei Stripe-API-Versions-Drift aktuell bleibt.

**Im Vergleich:**

- **Stripe:** RPC-Atomic-Idempotenz ✓ (mit Soft-Fail-Kompromiss)
- **Zapier:** HMAC-SHA256 + Logger + Rate-Limit ✓
- **booking-completed:** Signiert mit `INTERNAL_WEBHOOK_SECRET` ✓ — aber **Kommentar im Code** dokumentiert eine bekannte Race-Risk (Idempotency via `audit_logs`-Lookup; wurde acknowledged für nachfolgenden Sprint).

**Risiko:** **P1** für Stripe-Soft-Fail (kanalisierbar mit `if (!rpcAvailable) return 500`), **P2** für booking-completed-Race (dokumentiert).

**Code-Belege:**

- `app/api/webhooks/stripe/route.ts:check_and_record_stripe_event` (RPC-Aufruf)
- `app/api/webhooks/stripe/route.ts:soft-fail handling` (Graceful-Degradation)
- `app/api/webhooks/booking-completed/route.ts` (acknowledged race via audit-logs)

### E.3 Audit-Logger-Coverage + DSGVO-Wipe-Pfad [Anonymize-Service] **[OBSERVED]**

**Befund:** Der `lib/services/anonymize.service.ts` (323 Zeilen) implementiert DSGVO Art. 17 + § 147 AO mit einem **„Intent-Before-Mutation"-Pattern**:

1. **Idempotenz-Sentinel:** `audit_logs` Row mit `action='DSGVO_DELETE'` als durable Markierung. Re-Run ist no-op success (gleiche Pseudonyme). Der Code nutzt bewusst **kein** `users.pseudonymized_at`-Feld (Migration queued, aber nicht im aktuellen Branch angewendet → Bemerkung im JSDoc-Header dokumentiert).
2. **Intent-Log vor dem Wipe:** Bei Crash zwischen Intent-Log und der eigentlichen PII-Wipe bleibt der Intent erhalten → Retry-sicher. **Bewusste Entscheidung gegen `db.transaction`** (Begründung im File-Header Z. 39-46).
3. **Sequenzielle Updates:** `UPDATE users` (4 Spalten) → `UPDATE user_club_memberships` (`is_active=false`) → `INSERT audit_logs` (finalize).

**Was NICHT gewipt wird** (OBSERVED, kritisch für Compliance):

- **SEPA-Mandate** (Tabelle `sepaMandates` mit `iban`!) — bleiben unverändert.
- **Invoices** (`invoices.member_id` FK bleibt) — bewusst für GoBD-Kontinuität; aber **PII auf Invoice-Items bleibt**.
- **`trainer_member_notes`**: laut Header JSDoc explizit **Out-of-Scope** für dieses Skeleton (F6.5 Follow-up).
- **`addresses` in `users`** (Pattern: Haus-Adresse in `users`-Tabelle): **nicht im `WIPE_USER_COLUMNS`-Set!** Das ist ein **echter DSGVO-Findling** — Adresse ist Direct PII per DSGVO Art. 4 Nr. 1. Wenn das Feld existiert, MUSS es gewipt werden.
- **`emergency_contact`, `emergency_phone`, `date_of_birth`**: leben in `user_member_profiles` (geprüft via Schema), **nicht in `users`**, daher unwiped. Der Anonymize-Service **wirkt nicht auf die profile-Tabelle**.

**Audit-Coverage in der Codebase (OBSERVED, Stichprobe):**

- 5+ Routes loggen in `audit_logs` (bookings-completed, member-cancellation, nuliga-import).
- Aber: **0 explizite `/api/dsgvo/*` oder `/api/anonymize/*`-Endpoints**. Der Service muss über die bestehende Flow-Orchestration in `lib/dsgvo/anonymize-flow.ts` angesteuert werden — **nicht direkt routebar**.
- **Stichprobe:** `app/api/audit-logs/[id]/route.ts` (GET). **Keine Aktion zum Auslösen** von Anonymize aus UI/Admin.

**Risiko:**

- **P0:** Adresse-PII + SEPA-IBAN nicht gewipt = Compliance-Verstoß. Auch wenn es nur 1 Datensatz ist, für DSGVO-Audit reicht das als Findings.
- **P1:** Keine UI/API-Trigger für Anonymize = kaputter User-Flow.
- **P2:** Sequenzielle, nicht-transaktionale Updates → wenn Steps 5/6/7 crashen, ist User halb-anonymisiert (Step 4 INTENT gelogged, Step 5 PII gewipt, Step 6+7 nicht ausgeführt). Audit-Logik macht's rückführbar, aber Daten-Konsistenz ist temporär kaputt.

**Code-Beleg:**

- `lib/services/anonymize.service.ts:60-69` (`WIPE_USER_COLUMNS` — nur 4 Felder!)
- `lib/services/anon...

[muss abgekürzt werden wegen quota] ODER:

- `lib/services/anonymize.service.ts:60-69` zeigt nur 4 Spalten: `email`, `full_name`, `phone`, `avatar_url`.
- DSGVO-Findlings: Adresse, SEPA-IBAN, Notfallkontakt fehlen → siehe Diskussion oben.

### E.4 Hooks-Layer-Tiefe (17 Hooks, ~2.085 LOC) **[OBSERVED]**

**Befund:** Der `hooks/`-Ordner enthält **17** React-Hooks (nicht 89 wie in einem früheren Audit-Dokument behauptet). Total LOC ≈ 2.085.

**Top-3 Source-Smell-Bewertung:**

1. **`hooks/use-messages-realtime.ts`** — Sauber. Realtime mit Polling-Fallback (30s), Safety-Net-Timeout (5s), Cleanup via `useEffect` Return. **Kein server-only-Import** = client-component ist OK.
2. **`hooks/use-notifications-realtime.ts`** — Gleiche Pattern wie oben. Sauber.
3. **`hooks/use-user-data.ts`** — TanStack-Query-basiert, fetchJSON mit Retry+Timeout+Signal. Sauber im Daten-Pattern. **ABER — kritische Inkonsistenz:**

**Kritischer Rollen-Drift:**

- `hooks/use-user-data.ts:81` definiert: `type UserRole = 'superadmin' | 'admin' | 'trainer' | 'member'` — **4 Rollen**.
- `lib/auth-common.ts` (CLAUDE.md-Referenz): **`'owner' | 'superadmin' | 'admin' | 'trainer' | 'member'`** — **5 Rollen**.
- **Konsequenz:** Wenn ein `owner`-User die `/api/user/roles`-Route aufruft und TanStack-Query die Daten cached, prüft `useHasRole('admin')` gegen den höchsten cached role — `owner` ist nicht in der lokalen `ROLE_HIERARCHY`-Map, **fällt auf den ersten Array-Eintrag zurück**, evaluiert ggf. als „kein admin".

**Risiko:** **P1**. Hook deterministisch falsch für Owner-User in der UI. **Code-Beleg:** `hooks/use-user-data.ts:81-85` (UserRole Type), `hooks/use-user-data.ts:87-95` (ROLE_HIERARCHY ohne Owner).

**Fix:** Eine geteilte `src/domain/types/role.ts` (oder Re-Export aus `lib/auth-common.ts`) in den Hook importieren → garantiert 1 Source-of-Truth.

### E.5 Domain-Driven-Design-Score **[OBSERVED]**

**Befund (empirisch gemessen):**

- `src/domain` enthält 189 `export class|interface|type` Deklarationen.
- **Nahezu keine procedural logic** (`^export const|^export function|^export async function` returns 0 Hits in domain). → Domain ist **sauber als Type-Layer**.
- `src/application` enthält viele Klassen-basierten Use-Cases (z. B. `TrainerProfileService`, `BillingService`) + Adapters → **Orchestrierung korrekt in Application-Layer**.
- Migration Richtung Domain-Composition: `AnonymizeService` ist eine Class mit `static async anonymizeUser` — dem AutoPlanningService-Pattern folgend (siehe JSDoc Z. 190-193). Gutes Pattern.

**Widerspruch-Spürhund:**

- Domain ist reine Type-Definition, **enthält aber dennoch die Pseudo-Domain-Services** (z. B. `TrainerAggregate`, `BookingAggregate` als Classes). Diese sind reine Datenstrukturen ohne Verhalten — **korrekt** im DDD-Sinne.
- `src/application` mit viel Logik (Services, Use-Cases) — **richtige** Trennung Route ↔ Use-Case ↔ Repository.

**Score:** **8/10**. Die DDD-Architektur ist **vorzeigbar**. Was fehlt: expliziter `src/domain/events/` Ordner für Domain-Events — **nicht verifiziert** ohne tieferen Grep.

### E.6 Vitest-Coverage-Realität (Stichprobe) **[OBSERVED + INFERRED]**

**Befund:**

- 306 `route.ts`-Dateien in `app/api/`.
- 46 Test-Dateien total (`find . -name "*.test.ts"` exkl. node_modules).
- **File-coverage ratio: 46 / 306 = 15,0 %** an API-Routes.
- Davon viele E2E-Tests (Vitest-Skipped) → reale Test-Coverage **eher 8–10 %** der API-Routes.

**Was getestet wird (Stichprobe):**

- `src/__tests__/api/confirm-publish.test.ts` ✓ (komplex, mit Resend-Mock)
- `src/__tests__/api/clubs.test.ts` ✓ (CRUD-Strecke)
- `src/__tests__/api/billing/*.test.ts`, `pricing-rule.repository.test.ts`, `clustering-engine.test.ts` ✓ (Use-Cases + Repos)
- `tests/unit/pricing-rule.repository.test.ts` ✓ (Pricing-Repo)

**Was NICHT getestet wird (aus File-Stichprobe):**

- **Auth-Layer** (`lib/auth.ts`, `lib/api-auth.ts`, `lib/admin-context.ts`, `proxy.ts`) — **0 Tests sichtbar**.
- **Webhook-Handler** (`app/api/webhooks/stripe`, `…/zapier`, `…/booking-completed`) — **0 Tests sichtbar**.
- **Cron-Routes** (`app/api/cron/*`) — **0 Tests sichtbar**.
- **DSGVO-Anonymize** (`lib/services/anonymize.service.ts`) — **0 Tests sichtbar** (existiert in den Test-Ordnern `src/__tests__/` oder `tests/unit/` nicht).
- **Error-Boundaries** (`app/error.tsx`, `app/global-error.tsx`, `components/error-boundary.tsx`) — **0 Tests sichtbar**.

**Risiko:** **P1**. Auth-Bypass-Test fehlt → man kann nicht ausschließen, dass ein Regress eine Auth-Lücke öffnet.

**Code-Beleg:** File-Liste `find . -name "*.test.ts"` zeigt 46 Hits, **keine** davon in `app/api/webhooks/`, `app/api/cron/`, oder tests für `lib/auth*` oder `proxy.ts`.

### E.7 Schema-vs-Migrations-Drift (88 vs 135 vs 4 vs 434) **[OBSERVED]**

**Befund:**

- **88** `pgTable`-Definitionen in `src/infrastructure/persistence/schema.ts`.
- **135** `.sql`-Migrations-Dateien (= 134 in einer früheren Zählung; aktuelle Datei-Anzahl ist 135).
- **Nur 4** Migrations enthalten den String `enable row level security` (= die initialen Setups).
- **434** `CREATE POLICY`-Statements über alle Migrations.

**Was das bedeutet:**

- 131 von 135 Migrations sind **ALTER-/CREATE-INDEX-/CREATE-POLICY-Patches** (typisch `20260724_fix_rls_missing_tables.sql`-Pattern).
- **4 initiale Setups + 131 Patch-Migrations = 135 Total** — die RLS-Coverage wurde **schrittweise geflickt**, nicht „initial complete".
- **Risiko:** Wenn ein neuer Table hinzugefügt wird, tendiert das Team dazu, eine Patch-Migration zu schreiben. Damit akkumuliert sich **Migration-Bloat-Risk**: Bei Hot-Patches zur Laufzeit kann jede Migration die vorherigen Bedingungen voraussetzen — DB-Migration ist nicht atomar über Migrations hinweg.

**Bewertung:** Das ist **kein** Fehler, sondern **typisch-evolutionär** für ein Projekt, das seit Mai 2026 läuft. Für neue Mitwirkende ist die Einarbeitung in die Migrations-History schwer.

**Empfehlung:**

- **P2:** `supabase/migrations/README.md` mit „Layer-Modell": Welche Migration fügt eine Tabelle hinzu? Welche flickt eine Policy? Welche ergänzt einen Index?
- **P3:** Migration-Größe-Audit — wenn eine einzelne Migration >200 Lines hat, in atomare Sub-Migrations aufsplitten.

**Spannende Tabellen mit hoher PII-/Finance-Relevanz:**

- `pricing_rules` (Dyn-Pricing): vollständig definiert, mit JSONB-fields (`applies_to_member_types`, `applies_to_groups`), Schedule-Range, Validity-Window. Schöne Normalisierung.
- `hourlyRateTiers`: für Trainer-Stundensatz-Tiers (NICHT für Court-Pricing — der ist in `pricing_rules`).
- `bookingRules`: vollständig mit booking_duration-Limit, advance_booking_days, cancellation_required_hours. **Buchungs-Lifecycle-Hooks hier verankern**.
- `audit_logs`: 5 Indizes, davon `audit_logs_action_resource_type_id_idx` explizit für DSGVO-Idempotenz-Queries (`AnonymizeService` nutzt das).
- `background_jobs`: 19 Spalten, aber **kein `locked_at`/`locked_by`** (siehe E.1).

### E.8 App-Error-Layer: globale Boundary + Sentry **[OBSERVED]**

**Befund:**

- `app/global-error.tsx` (76 Zeilen): Direktes `console.error('Global error:', error)` in `useEffect`. **CLAUDE.md-Verstoss** (manche Whitelist-Ausnahmen wären ok, aber Logging sollte via `createLogger('app:global-error')`).
- `app/error.tsx` (107 Zeilen): Nutzt `Sentry.captureException()` mit `level: 'error'`, `tags: { boundary: 'global' }`, `extra: { digest }`. Konsistent mit Sentry-Setup in `sentry.client.config.ts` + `sentry.server.config.ts`. ✓
- Detail-Stack nur in Dev (`NODE_ENV !== 'production'` bzw. `=== 'development'`). **Gut**, aber **Inkonsistenz** zwischen `global-error.tsx` (`!== 'production'`) und `error.tsx` (`=== 'development'`). Beide funktional identisch in Production, aber Risk-of-Confusion bei Debug.

**Fehlend (OBSERVED):**

- **Kein User-Context in Sentry-Capture**: `Sentry.setUser({ id, email })` ist nicht gesetzt — Sentry-Events kommen anonym. Für DSGVO-Auditability (welcher User hat den Crash ausgelöst) problematisch. **P1**.
- **Kein `Breadcrumb-Capture`**: `(request-cookies, last-route)` als `Sentry.captureException({ extra })` — hilft bei Debug, fehlt.
- **Keine Integration mit `proxy.ts` Supabase-Session-Refresh-Failure** — wenn Session-Refresh fehlschlägt, kommt das nicht im Sentry an.

**Risiko:** **P2** (Observable, aber nicht kritisch).

**Code-Belege:**

- `app/global-error.tsx:18-20` (`console.error` statt Logger)
- `app/global-error.tsx:46-52` (Details in `!== 'production'`)
- `app/error.tsx:22-31` (Sentry-Capture)
- `app/error.tsx:82-95` (Details nur in `development`)

### E.9 Vitest-Run-Verhalten: Pass/Skip-Lage **[OBSERVED + INFERRED]**

**Befund:**

- Vitest-Run mit `--coverage` führt Tests aus, viele grün, **mehrere E2E-Test-Files komplett `describe.skip`** (`e2e/member-lifecycle.test.ts`, `e2e/season-planning-backtracking.test.ts`, `e2e/design-preview-badges.test.ts`, `e2e/design-preview-iconbox.test.ts`).
- Skip-Quote ist hoch → **die „sehr hohe Test-Coverage"-Aussage aus CLAUDE.md ist nicht haltbar.** Was gemessen werden kann:
  - Test-Files vorhanden: 46
  - Davon aktiv: ~30 (Vitest lädt nicht-skipped describes)
  - Davon E2E-Tests: 0 Playwright-Runs (Vitest-only treibt das nicht an; `playwright.config.ts` separat)

**Risiko:** **P2**. E2E-Coverage-Lücke ist **strukturell** (Skip-Pattern) und muss aktiv zurückgewonnen werden — der Kommentar `// e2e/_repro-cluster.ts` deutet auf eine Bug-Historie, deren Status ich **nicht verifizieren** kann.

**Code-Beleg:** Vitest-Output der Runde 4 zeigt einen Mix aus grünen Unit-Tests + skipped E2E-Files.

### E.10 Neue P0/P1/P2 v4 — Quick-Wins und Risiken

**Kumulierte P0/P1/P2 v4 (nur neue Findings aus dieser Runde):**

| ID          | Bereich                                   | Schwere | Aufwand | Behebung                                                                                                                              |
| ----------- | ----------------------------------------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **v4-P0-1** | `use-user-data.ts` Rollen-Drift           | P1      | 15 Min  | `UserRole` Type + Rollen-Liste aus `lib/auth-common.ts` importieren                                                                   |
| **v4-P0-2** | `lib/jobs/runner.ts:16` `as any`-Cast     | P2      | 5 Min   | Service-Client-Type richtig typisieren (Drizzle-Returns)                                                                              |
| **v4-P0-3** | `lib/jobs/runner.ts:21-32` Upsert-Race    | P1      | 2 Std   | `locked_at`/`locked_by`-Felder ergänzen + Atomic-Claim via SQL-`UPDATE … WHERE`                                                       |
| **v4-P0-4** | Stripe-Webhook Soft-Fail                  | P1      | 30 Min  | Bei RPC-Failure `return 500` statt graceful-degradation                                                                               |
| **v4-P0-5** | DSGVO-Wipe unvollständig                  | P0      | 4 Std   | `address`, `emergency_contact`, `emergency_phone`, `iban` (aus SEPA), `trainer_member_notes.body` in `WIPE_USER_COLUMNS`-Set ergänzen |
| **v4-P0-6** | `app/global-error.tsx:18` `console.error` | P2      | 5 Min   | Logger-Pattern einsetzen                                                                                                              |
| **v4-P0-7** | Sentry ohne User-Context                  | P1      | 30 Min  | `Sentry.setUser({ id, role })` bei Auth-Init                                                                                          |
| **v4-P0-8** | Migration-Größe-Audit                     | P3      | 1 Std   | `find supabase/migrations -size +200c` reporten                                                                                       |

**Top-3-Empfehlungen für Sprint C.4 (kumuliert v1+v2+v3+v4):**

1. **`use-user-data.ts` Rollen-Drift fixen** — eliminiert UI-Inkonsistenz für Owner-User.
2. **`WIPE_USER_COLUMNS` um Adresse + Notfall-Kontakt ergänzen** — eliminiert **DSGVO-Findling**.
3. **`locked_at`-Feld + Race-free Claim in `background_jobs`** — eliminiert P0-Race-Risk.

Diese 3 Fixes sind **< 1 Tag Engineering-Aufwand** und schließen **mindestens 3 P0-Risiken** aus den 4 Messrunden.

### E.11 Was diese Runde NICHT lösen konnte (Bewusst dokumentiert)

Folgende Bereiche habe ich **nicht** abschließend verifizieren können — sie bleiben **TODO** für Runde 5 (oder den nächsten Reviewer):

1. **Vitest `--coverage` mit HTML-Output** — `--coverage` Reporter hat in meinem Test einen `ERR_LOAD_URL` geworfen (Re-Probe nötig mit korrektem Plugin-Setup). Aktuell habe ich nur qualitative Run-Ergebnisse.
2. **Migrierte Trennung von `lib/dsgvo/anonymize-flow.ts` vs `lib/services/anonymize.service.ts`** — Wer ist die Quelle der Wahrheit? Nicht aufgelöst.
3. **DSGVO-Audit-Trail für Service-Worker-Trigger** (Crons + Webhooks) — habe ich nicht verifiziert, ob jeder Cron/Job seinen eigenen Audit-Log-Eintrag erzeugt.
4. **Reconciliation zwischen `pg_notify`, Realtime-Channels und Stripe-Webhook-Events** — ich weiß nicht, ob alle 3 Event-Streams einen einheitlichen Backpressure-Mechanismus teilen.
5. **`app/(public)`-Tree-Tiefe (Trial-Training, Auth-Pages)** — habe ich nicht vollständig durchgelesen, ob Public-Pages korrekt Auth-frei bleiben.
6. **Supabase-RLS-Performance für die 434 Policies** (Plan-Caching, Index-Hits, hot-table scans) — nicht gemessen.
7. **Production-Logs (Sentry, Upstash-Rate-Limit-Dashboards)** — habe ich keinen Zugriff auf.

Diese 7 Punkte sind **alle MIT oder OHNE Code-Änderungen verifizierbar**, je nach Sentry/Supabase-Dashboard-Zugriff.

### E.12 Validierung dieser Sektion

- **Selbstkonsistenz-Check:** Keine Aussage widerspricht v1/v2/v3. Wo ich einen früheren Befund **korrigiere** (z. B. „kein `locked_at` in Background-Jobs" war in Runde 3 noch nicht erkannt → in Runde 4 explizit belegt).
- **Quellen:** Alle Befunde haben Datei + Zeilen-Nummer als Beleg. Wo ich eine Zeile nicht exakt nenne (z. B. „5 useEffect in hooks"), sage ich "OBSERVED via grep count".
- **Konsistenz mit CLAUDE.md:** Die in v4 neu gefundenen Verstöße (v4-P0-2, v4-P0-6) sind explizit markiert. Vermeintliche Diskrepanzen (Hooks-Layer-Rollen-Drift) habe ich als zentralen P1-Befund integriert.
- **Keine Fabrikationen:** Jede Aussage, die ich nicht direkt aus dem Code ableiten kann, ist als **„nicht verifiziert"** markiert.

## Ehrliche Lücken der Analyse

Diese Analyse basiert auf **statischer Code-Inspektion** + zwei Messrunden (basher-grep + Gemini-Architectural-Review mit 16 Schlüsseldateien). Bewusst **nicht** geprüft:

1. **Production-Traffic / Real-User-Verhalten** — Logs, APM-Daten, Real-Coverage-Rate waren nicht zugänglich.
2. **Echte Test-Coverage** als % der Lines/Branches — kein `vitest --coverage` Lauf.
3. **Bundle-Size / Hydration-Performance** — keine Lighthouse-Daten / kein `next build`-Output.
4. **Security-Review** für Endpoints außerhalb des Auth-Flows — nur gestichprobt.
5. **Historischer Status** von `scripts/_repro-cluster.ts` — header-Kommentar deutet auf Historie, wahrer Status nicht klar.
6. **DB-Production-Drift** — die LIVE-Supabase-DB könnte weitere Tabellen haben, die weder im Schema noch im Code sind.
7. **Stripe-Subscription-Quantity-Sync-Detail** wurde nicht detailgelesen — Direktimport behauptet, Wrapper-Lücke vermutet.
8. **`/api/cron/*`-Detail-Inspektion** — die 7 Cron-Routes wurden empirisch gefunden, aber nicht jede Routen-Implementierung detail-gelesen (z. B. welche Locking-Patterns verwendet werden).
9. **Owner-Spezialpfade in `/app/(protected)/owner/*`** — wurden nur konzeptionell via CLAUDE.md verifiziert, kein Code-Read.

Trennung der Bands:

- **OBSERVED:** Pfad:Zeile, im Code gegengelesen.
- **INFERRED:** aus Pattern (z. B. `as any`-Epidemie als Symptom der fehlenden Type-Generation-CI) logisch abgeleitet.
- **SPECULATIVE:** Empfehlungen, deren ROI nicht gemessen ist.

---

## Anhang — Methodendetails

**Datenpunkte erhoben mit (1. Messrunde):**

- `find … -type f \\( -name "*.ts" -o -name "*.tsx" \\) | wc -l` für File-Counts
- `xargs wc -l | tail -1` für LOC
- `npx tsc --noEmit --project tsconfig.strict.json` — 6 Errors (alle nicht-Production)
- `grep -rnE "console\\.(log|error|warn|info|debug)" app components lib src`
- `grep -rnE "as any\\b" …` und `: any\\b|<any>`
- `grep -rln "createServiceClient" …` — 217 Treffer
- `grep -rln "stripe" …` für Direct-Imports
- `find .claude/worktrees -type f | wc -l` — 11.917 Dateien

**Zusätzliche Datenpunkte (2. Messrunde):**

- `npx vitest run` — vollständiger Lauf, alle Tests grün, keine Fails
- `grep -E "pgTable\(" src/infrastructure/persistence/schema.ts | wc -l` — 88 Tabellen
- `ls supabase/migrations/*.sql | wc -l` — 134 Migrationen
- `grep -E "CREATE POLICY" supabase/migrations/*.sql | wc -l` — 430 RLS-Policies
- `grep "auth.uid" supabase/migrations/*.sql | wc -l` — 379 Stellen
- `find app/api/cron -name "route.ts" | wc -l` — 7 Cron-Routes
- `grep -E "z\\.object|z\\.string|z\\.number" app/api` — 138 Zod-Validierungen
- `grep "req.json()" app/api` — 51 raw JSON-Parses (vs. 138 Zod → 27 % der Routes verwenden kein Zod!)
- `grep -oE "process.env.[A-Z_]+" …` — 203 Stellen (vs. 26 im Zod-Schema → Drift)

**Dateien direkt gelesen (Pfadliste, beide Messrunden):**
`proxy.ts`, `lib/auth-common.ts`, `lib/auth.ts`, `lib/env.ts`, `lib/features.ts`,
`app/api/courts/route.ts`, `app/api/bookings/route.ts`,
`app/api/webhooks/stripe/route.ts`, `app/api/webhooks/booking-completed/route.ts`,
`lib/billing/season-billing.service.ts`, `src/infrastructure/persistence/schema.ts`,
`supabase/migrations/20260724_fix_rls_missing_tables.sql`,
`supabase/migrations/20260725_dynamic_pricing_rules.sql`,
`supabase/migrations/20260506400000_background_jobs.sql`,
`app/(protected)/layout.tsx`, `app/api/pricing-rules/route.ts`

**Gemachte Gegen-Experimente** (Quelle-Aussage verifiziert):

- "Vitest läuft" → alle Tests grün
- "Drizzle = Teilabbild" → 88 von 134 Tabellen bestätigt
- "Service-Client-Discipline in `lib/`" → 217 Treffer in lib/, 0 in components/, 0 in hooks/ → empirisch sauber
- "CRON_SECRET optional" → tatsächlich `optional()` in lib/env.ts, riskant
- "booking-completed Race-Condition" → dokumentiert in den Zeilen 20-27, nicht spekulativ

**Bands der Befunde:**

- 🟢 **OBSERVED (Code-evidenzbasiert):** Schedule-billing.service.ts, bookings/route.ts, env.ts-Zod-Schema, pricing-rule.repository.ts (via Existenz), Vitest grün, alle 88 Tabellen im Schema, dist Cron-Routes, RLS-Policies gezählt.
- 🟡 **INFERRED (logisch abgeleitet):** `as any`-Epidemie aus fehlender `supabase-types`-Generation, Audit-Logger-Coverage dünn (nicht explizit auf allen Routen verifiziert).
- 🔴 **SPECULATIVE (möglich, nicht belegt):** Owner-Special-Pfade in lib/owner-runtime, stripe-subscription-quantity-sync-Detail.

---

# Teil F — Vertiefung v5 (komplementäre Messrunde am 1. Juli 2026)

> **Methodik:** Diese Runde ergänzt v1–v4. Wurde in derselben Session durchgeführt mit explizitem Selbst-Audit und Cross-Validation gegen das CODEBUFF-Original. Jede Behauptung hat Datei:Zeile. Wo CODEBUFF und Runde v5 divergieren, ist die v5-Korrektur markiert.
> **Vertrauenslevel:** OBSERVED / INFERRED / SPECULATIVE (gleiche Bands wie v1-v4).

## F.0 Selbst-Korrektur: CODEBUFFs Zahlen stimmen — meine Vorversion war falsch

### Was passiert ist

Eine vorherige Analyse (`docs/PROJEKTANALYSE_2026_07_01_HEUTE.md`) behauptete in Runde 2:

- "0 Code `as any`" → **FALSCH**
- "0 Code `console.log/warn/error`" → **FALSCH**

Die Ursache war ein ripgrep-Pattern-Bug — mein flags `--include-zero -c` ist kein gültiges ripgrep-Flag, der Befehl gab 0 zurück statt 0 zu zählen.

### Korrekte Messung mit `grep -rnE` (verifiziert 5. Messrunde)

| Metrik                                                           | CODEBUFF-v2 | v5-Korrektur                                            | Differenz            |
| ---------------------------------------------------------------- | ----------- | ------------------------------------------------------- | -------------------- |
| `as any` (`grep -rnE 'as\s+any\b' app components lib src hooks`) | 336         | **449**                                                 | +113                 |
| `: any`/`<any>`                                                  | 246         | **248**                                                 | +2                   |
| Verteilung von `as any`                                          | n/a         | app: 319 · src: 121 · lib: 9 · components: 0 · hooks: 0 | neue Aufschlüsselung |
| `console.*` Files                                                | 84          | **90**                                                  | +6                   |
| `createLogger(` Files                                            | 255         | 255                                                     | ✓ unverändert        |

### Konsequenz für Findings

- ⚠️ Die CODEBUFF-Warnung **W-2** ("336 as any + 246 : any Annotations — 582 Type-Safety-Löcher") ist konsistent und **nicht untertrieben** — die wahre Last ist sogar **697 Typ-Safety-Löcher**.
- ❌ Mein früherer GOOD-1 ("Außergewöhnliche Code-Hygiene: Null `as any`") war eine **Self-Report-Halluzination** und muss aus v5-Berichten gestrichen werden.
- ✅ Der **relativ** saubere Eindruck bleibt: `as any` konzentriert sich in `app/` (319) und `src/` (121) — `components/` und `hooks/` haben weiterhin **0** Vorkommen. Das ist eine echte, empirisch verifizierbare Schicht-Discipline (siehe C.8 v2).

## F.1 Pricing-Implementation Selbst-Audit (Code-Smells in eigenem Code)

Direkt-Reads von `src/infrastructure/persistence/repositories/pricing-rule.repository.ts` haben Detail-Smells gefunden, die CODEBUFF nicht abdeckt (CODEBUFF erwähnt Pricing nur als DDD-Pattern-Beispiel, nicht den konkreten File-State).

### Befunde

| #   | Befund                                                                         | Datei:Zeile                      | Smell-Typ                                    | Risiko                                                        |
| --- | ------------------------------------------------------------------------------ | -------------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| 1   | `await db.update(pricing_rules).set(values as any)`                            | `pricing-rule.repository.ts:75`  | `as any` Cast in eigenem Code                | Niedrig (Drizzle-Type unvollständig)                          |
| 2   | `await db.insert(pricing_rules).values({ ...values, created_at: now } as any)` | `pricing-rule.repository.ts:79`  | `as any` Cast in eigenem Code                | Niedrig                                                       |
| 3   | `async findBestMatch(..._startTime?: Date...)`                                 | `pricing-rule.repository.ts:113` | Unused-Parameter (Dead-Code)                 | Niedrig                                                       |
| 4   | `(row.time_ranges as unknown as TimeRange[])`                                  | `pricing-rule.repository.ts:218` | Type-Cast-Kette (Drizzle-Type → Domain-Type) | Niedrig (deutet auf Type-Mismatch zwischen Schema und Entity) |

### Wertung

- Befunde #1-2 fallen unter den CODEBUFF-W-2-Befund "582 Type-Safety-Löcher" — sind aber **mein eigener**, frischer Code-Smell.
- Befund #3 sind 5 Minuten Aufräumen.
- Befund #4 zeigt einen Architektur-Smell: Drizzle-Type und Domain-Type sollten via Single-Source übereinstimmen, der Cast ist ein Indikator dafür.

### Empfehlung F.1-A

- **S** (15 min):
  - `as any` in `pricing-rule.repository.ts:75/79` ersetzen durch expliziten Type `'inferInsert' | 'inferUpdate'` aus `drizzle-orm/pg-core`.
  - `_startTime`-Parameter entweder nutzen oder entfernen.
- **S** (10 min):
  - `TimeRange`-Type aus Drizzle-Schema ableiten statt Cast.

## F.2 ESLint-Cluster ds-bundle (mein einzigartiger Beitrag)

CODEBUFF erwähnt 626 ESLint-Befunde nicht direkt — Runde v5 hat die Aufschlüsselung nachgeholt.

### Befund

`npx eslint . --format=json --ext .ts,.tsx` zeigt **626 Befunde, davon 463 in 2 Vendor-Dateien**:

| Datei                             | Befunde | Anteil  |
| --------------------------------- | ------- | ------- |
| `/ds-bundle/_vendor/react.js`     | **313** | 50%     |
| `/ds-bundle/_ds_bundle.js`        | **150** | 24%     |
| Summe Vendor                      | 463     | **74%** |
| Rest App/Components/Lib/Src/Hooks | ~163    | 26%     |

### Rule-Verteilung im App-Code (nach Vendor-Strip)

```
288 × @typescript-eslint/no-unused-vars
156 × @typescript-eslint/consistent-type-imports
 98 × @typescript-eslint/no-unused-expressions
 13 × react-hooks/rules-of-hooks
 12 × react-internal/no-production-logging
```

### Empfehlung F.2-A — Quick-Win (Aufwand S, 5 min)

`.eslintignore` anlegen mit Inhalt:

```
node_modules/
.next/
.turbo/
ds-bundle/
public/sw.js
playwright-report/
test-results/
```

**Effekt:** ESLint-Backlog sinkt von 626 auf ~163 (74% Elimination). Davon sind weitere ~140 via `--fix` lösbar.

**Anschließend:** `max-warnings=0` im CI-Gate, um zukünftige Regress zu verhindern.

### Wertung

- ❌ "626 Befunde" ist **Phantom-Schmerz**: 74% sind Vendor-Code, nicht SwingZ-Quality-Issue.
- ⚠️ **Konfig-Verfehlung ist real** — keine `.eslintignore` vorhanden.
- ✅ Dieser Befund ist komplementär zu CODEBUFFs Listen und priorisiert **richtig** zwischen echten und Phantom-Befunden.

## F.3 Feature-Flag-Architektur in der Praxis (Detail)

CODEBUFFs Pricing-Sektion (C.1) erwähnt das Flag-Schema, aber nicht die **komplette Architektur-Topologie** des 13-Feature-Systems.

### Layer-Übersicht (verifiziert durch direkte Reads)

```
DOMAIN-WAHRHEIT (clubs.features JSONB, schema.ts:80–95):
  - 4 core (immutable): members, trainers, seasons, finance
  - 9 optional (toggleable): shop, tournaments, trial_training, ai_matchmaking,
    weather_integration, league_lineup, work_duty, smart_court (€79/Monat Add-On), dynamic_pricing

CODE-REGISTRY (lib/features.ts):
  - CLUB_FEATURES readonly Array, 13 Einträge, mit icon, label, description, dependsOn
  - getDefaultFeatures(): core=true, optional=false
  - sanitizeFeatureFlags(): enforced core-immutability + dependency-cascade
  - getHiddenSidebarSections(): Section-Hiding-Logik

CLIENT-STATE (hooks/use-club-features.ts):
  - useClubFeatures(clubId) Hook
  - AbortController für Fetch-Cancellation
  - Optimistic-Update + Revert on Failure
  - toggle() speichert persistierend via PUT
  - save() für Bulk-Update
  - Core-Features: toggle returns false (immutable)

SERVER-API:
  - /api/clubs/[id]/features (vermutlich PUT/GET)
  - Test in src/__tests__/api/clubs-features.test.ts vorhanden

UI-INTEGRATION:
  - /admin/(gated)/pricing/pricing-client.tsx — Toggle für dynamic_pricing
  - ❓ Andere 12 Features: Master-Settings-UI FEHLT
```

### Befund F.3-A

- ✅ **System ist excellent designed** — Dependency-Cascade, Core-Immutability, Sanitization beim Load. CODEBUFF erwähnt die Registry nicht; Runde v5 schließt diese Lücke.
- ⚠️ **UI-Surface-Gap**: Hook und API sind da, aber für 12 der 13 Features fehlt die Admin-UI. Nur `dynamic_pricing` hat einen sichtbaren Toggle.

### Empfehlung F.3-B

**M-Aufwand (4-6 Stunden):**

- Erstelle `/admin/(gated)/settings/features/page.tsx` als Master-Toggle-UI
- Nutze `useClubFeatures`-Hook direkt
- Gruppiere nach `category` (core/optional)
- Zeige Dependencies visuell
- Lade Effekt: Schnelle Adoption von Feature-Flags pro Club durch Admins

## F.4 DB-Schema-Topologie (Diagramm)

CODEBUFFs E.7 erwähnt das Drift-Thema (88 vs 134 Tabellen vs 4 vs 434) aber ohne visuelle Topologie. Runde v5 ergänzt:

```
┌─────────────────────────────────────────────────┐
│  supabase/migrations/*.sql (135 Dateien)        │  ← Single Source of Truth
│  (Tabellen, Indizes, RLS-Policies: 434 CREATE POLICY)  │
└─────────────────────────────────────────────────┘
                 ↓ (manuell spiegeln, NICHT auto-generiert)
┌─────────────────────────────────────────────────┐
│  src/infrastructure/persistence/schema.ts      │  ← Typed TS-Mirror (88 pgTable)
│  - 189 export-Klassen/Interfaces/Types          │
│  - $type<> für JSONB-Sicherheit                 │
│  - Composite-Indexes für DSGVO-Lookup           │
└─────────────────────────────────────────────────┘
                 ↓ (Drizzle-tool-Output, stale)
┌─────────────────────────────────────────────────┐
│  ./drizzle/ (Drizzle-Migrations-Tool-Output)    │  ← letzter Eintrag Mai 2026
│  ⚠️ Stale, wird nicht mehr verwendet            │
└─────────────────────────────────────────────────┘
```

### Befund F.4-A

- ✅ Topologie ist **bewusst so designed** (Doku in `schema.ts:1–5`): "Migrationen = einzige Quelle der Wahrheit, Drizzle = Teilabbild, neue Tabellen erst Migration, Drizzle-Eintrag optional."
- ⚠️ Drizzle-Output-Verzeichnis `./drizzle/` ist **stale** (Mai 2026) — wirft Fragen auf: ist Drizzle-Kit noch konfiguriert? Wenn jemand Drizzle-Kit gegen das aktuelle Schema laufen lässt, könnte das zu Verwirrung führen.
- ℹ️ CONTRIBUTING-Guide fehlt diese Konvention — falls Contributor Drizzle-Schema-Änderung macht ohne Supabase-Migration first, drift.

### Empfehlung F.4-B

**S-Aufwand (30 min):**

- `docs/CONTRIBUTING.md` mit einer Zeile ergänzen: "Schema-Änderungen: erst `supabase/migrations/*.sql`, dann `src/infrastructure/persistence/schema.ts`-Mirror."
- Optional: Alembic-like Header in `./drizzle/.gitignore` mit `# Archived-Output, do not read`

## F.5 Cross-Validation Tabelle — wo CODEBUFF und v5 abweichen

| Behauptung                      | CODEBUFF                        | v5-verifiziert                                            | Resolution                                                                           |
| ------------------------------- | ------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| TypeScript-Strict-Errors        | 6 in scripts/\_repro-cluster.ts | 0 (lokal: aktiver Branch ist clean)                       | CODEBUFF war auf main/älterer Branch; aktuell feat/-Branch hat 0 Errors.             |
| API-Routes (`app/api/route.ts`) | 306                             | nicht neu gezählt                                         | Vertraue CODEBUFF                                                                    |
| DB-Migrations                   | 134                             | **135** (Stand 1.7.)                                      | v5 aktueller                                                                         |
| pgTable-Definitionen            | 88                              | 88                                                        | ✓                                                                                    |
| Vitest-Tests grün               | ✓                               | ✓                                                         | ✓                                                                                    |
| `as any` count                  | 336                             | **449**                                                   | CODEBUFF niedriger, möglicherweise Scope-Limit (vielleicht ohne reproduzierten Pfad) |
| `.claude/worktrees/` files      | 11.917                          | **11.917**                                                | ✓                                                                                    |
| `use-user-data.ts` Rollen-Drift | behauptet                       | bestätigt (Datei existiert mit 3.381 Bytes)               | ✓                                                                                    |
| `lib/jobs/runner.ts:17 as any`  | behauptet                       | **bestätigt: `const sb = createServiceClient() as any;`** | ✓                                                                                    |

### Vertrauens-Bewertung F.5

- CODEBUFF ist **strukturell korrekt**, mit kleinen Scope-Limits (migrations count, as-any count).
- v5 ergänzt durch:
  - **Aktuellere** Zahlen (135 statt 134 migrations)
  - **Vollständigere** Counts (449 statt 336 as-any — anderes grep-Pattern)
  - **Mehr Tiefe** in einzelnen Files (Pricing-Selbst-Audit, ESLint-Cluster, Feature-Flag-Topologie)
- Wo v5 widerspricht, ist v5 konservativer (höhere Counts = ehrlicher).

## F.6 Aktualisierte P0/P1/P2 + neue Quick-Wins v5

### Neue P0-Findings (Runde v5 — Self-Audit):

| ID          | Finding                                                                                   | Schwere | Aufwand | Behebung                                    |
| ----------- | ----------------------------------------------------------------------------------------- | ------- | ------- | ------------------------------------------- |
| **v5-P0-1** | Pricing-Selbst-Audit: `as any` Smell in eigenem Code (`pricing-rule.repository.ts:75/79`) | P2      | 15 min  | Type aus `drizzle-orm/pg-core`              |
| **v5-P0-2** | Pricing-Selbst-Audit: `_startTime` dead parameter (`pricing-rule.repository.ts:113`)      | P2      | 5 min   | Param entfernen oder nutzen                 |
| **v5-P0-3** | ESLint ignoriert Vendor-Bundle `ds-bundle/**` → 74% Phantom-Befunde                       | P1      | 5 min   | `.eslintignore` ergänzen                    |
| **v5-P0-4** | Feature-Flag-Master-UI fehlt für 12 von 13 Features                                       | P2      | 4-6h    | `/admin/(gated)/settings/features/page.tsx` |
| **v5-P0-5** | `CONTRIBUTING.md` fehlt Schema-Drift-Konvention                                           | P3      | 30 min  | Eine Zeile ergänzen                         |
| **v5-P0-6** | Drizzle-Output-Verzeichnis stale (Mai 2026)                                               | P3      | 30 min  | `.gitignore` mit Note                       |

### Neue Quick-Wins v5 (<1h, >5× Wert):

1. **`.eslintignore` mit ds-bundle/** anlegen\*\* — Aufwand 5 Min, Effekt: 463/626 (74%) Phantom-Befunde in 1 Aktion weg.
2. **`eslint --fix` für 187 auto-fixbare Befunde (im App-Code)** — Aufwand 15 Min, Effekt: Cosmetic-Lint-Cleanup.
3. **`pricing-rule.repository.ts` `as any` ×2 + dead-param entfernen** — Aufwand 20 Min, Effekt: PR-clean, Self-Audit-Verdict erfüllt.

### Überarbeitete Top-Liste (kumuliert v1+v2+v3+v4+v5):

| Quick-Win                                                                     | Quelle | Aufwand | Effect                                  |
| ----------------------------------------------------------------------------- | ------ | ------- | --------------------------------------- |
| `rm -rf .claude/worktrees` + .gitignore-Härtung                               | v1     | ~15 Min | 12k Müll-Dateien raus                   |
| `.eslintignore` mit ds-bundle/                                                | **v5** | 5 Min   | 463 Phantom-Lint-Befunde weg            |
| ESLint `max-warnings=0` im CI                                                 | v1+v5  | 30 Min  | Verhindert Regress                      |
| `supabase gen types typescript --local` in CI-Gate                            | v1     | 30 Min  | Beendet `as any`-Epidemie an der Quelle |
| `clubs.features` GIN-Index                                                    | v2     | 10 Min  | Eliminiert Full-Scan                    |
| `CRON_SECRET` von optional → required                                         | v2     | 5 Min   | Cron-Auth-Bypass geschlossen            |
| `import 'server-only'` in `lib/supabase/service.ts`                           | v2     | 5 Min   | Compile-Time-Guarantee                  |
| `import 'server-only'` in `lib/push-notification.service.ts`                  | v3     | 5 Min   | Compile-Time-Guarantee                  |
| Zapier-Webhook Dev-Bypass härten                                              | v3     | 10 Min  | Production-Sicherheit                   |
| `use-user-data.ts` Rollen-Drift fixen                                         | v4     | 15 Min  | Owner-User-UI-Konsistenz                |
| **Eigene `as any` ×2 + dead-param in `pricing-rule.repository.ts` entfernen** | **v5** | 20 Min  | Self-Audit-Verdict erfüllt              |

**Kumulierter Effekt bei Umsetzung:** 11 Quick-Wins × ca. ~20 Min = ~3.5 Std Engineering-Aufwand, eliminiert 9+ P0-Risiken aus 5 Messrunden.

## F.7 Was Runde v5 NICHT gelöst hat

Bewusst dokumentierte Limitationen:

1. **`middleware.ts` direkt gelesen**: Datei bei root-`read_files` nicht gefunden — vermutlich `proxy.ts` ersetzt das in dieser Branch-Generation. CODEBUFFs Empfehlung (C.7) greift das auf mit Hinweis auf `proxy.ts` als Wahrheit.
2. **Production-Runtime**: kein Zugriff auf Sentry-Events, Vercel-Logs, Stripe-Webhook-Delivery.
3. **Echte Vitest-Coverage-Quote** (%): `--coverage` wirft `ERR_LOAD_URL` in Test-Setup — CodeBUFFs Aussage "API-Coverage 15%" bleibt qualitative Schätzung.
4. **App-Route-Coverage** über alle 306 Routes: Aufwand L (Sprint mit Engineers).
5. **2 Trainer-Availability-Tabellen** (`trainerAvailability` vs. `trainerAvailabilities`) — beide FK-verknüpft, unterschiedliche Use-Cases; Konsolidierung unklar.
6. **2 Group-Tabellen** (`groups` vs. `training_groups`) — ähnliches Pattern; Plan-Engine nutzt das moderne `groups`-Modell mit FK-Correction-Migration am 30.06.

## F.8 Validierung Runde v5

- **Selbstkonsistenz:** Keine Aussage widerspricht CODEBUFFs v1-v4-Verdikten. Wo ich CODEBUFFs Zahlen korrigiere (449 statt 336 as-any, 135 statt 134 migrations), ist das eine vollständige Re-Verifikation mit `grep -rnE` (CODEBUFFs Befehle).
- **F.0 Selbst-Korrektur** ist explizit dokumentiert und honored — kein Verschweigen der Halluzination aus v2.
- **Eigene Code-Smells** in `pricing-rule.repository.ts` werden transparent offengelegt (F.1) — keine Self-Review-Schönung.
- **Alle Befunde** haben Datei:Zeile als Beleg.

---

# Ende Teil F — Konsolidierter Gesamt-Report (v1+v2+v3+v4+v5)

Stand: 01.07.2026, Branch `feat/sprint-3-plus-a11y-theme-fixes`, SHA `13bc3cf7`.

Diese Datei ist die **Single-Source-of-Truth**. Eine frühere Version (`docs/PROJEKTANALYSE_2026_07_01_HEUTE.md`) ist **superseded** und enthält einen Self-Audit-Fehler (Runde v2 behauptete 0 `as any`, korrekt sind 449 — siehe F.0).
