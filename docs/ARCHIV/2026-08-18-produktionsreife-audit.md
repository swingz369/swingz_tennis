# Produktionsreife-Audit — 18.08.2026

> **Art:** Archiv (einmaliger Snapshot, nicht pflegen). Unabhängig vom bestehenden
> `docs/PRODUKTIONSREIFE.md` erstellt — jeder Punkt unten wurde am Code selbst
> geprüft, nicht aus der Doku übernommen.
>
> **Verifikation, die diesem Audit zugrunde liegt:**
>
> - `pnpm typecheck` → 0 Errors
> - `pnpm test:run` → 106 Testdateien, 1557 Tests grün, 10 skipped
> - `git ls-files` → nur `.env.example` ist getrackt; `.env.local`/`.env.prod.local`
>   sind gitignored
> - Keine hartkodierten Secrets in `app/` und `lib/` gefunden (Regex-Scan)

---

## P0 — kritisch (Geld-/Datenpfad, sofort beheben)

### 1. SECURITY-DEFINER-RPCs sind an `anon`/`authenticated` vergeben (RLS-Bypass)

`supabase/migrations/00000000000000_baseline_2026-08-16.sql` vergibt für nahezu
**jede** Funktion `GRANT ALL … TO "anon"` und `TO "authenticated"` — auch für
`SECURITY DEFINER`-Funktionen, die als Owner (`postgres`) laufen und damit RLS
umgehen. Konkret:

```sql
-- Zeile 12964 f.
GRANT ALL ON FUNCTION "public"."check_and_record_stripe_event"(...) TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_record_stripe_event"(...) TO "authenticated";
```

`check_and_record_stripe_event` (Zeile 496, `SECURITY DEFINER`) ist die
Webhook-Deduplizierung. **Jeder anonyme Aufrufer** kann über den Supabase-REST-
Endpunkt beliebige `stripe_event_id`s vorab einfügen. Trifft danach der echte
Stripe-Webhook ein, liefert die RPC `false` („schon da") und der Handler springt
den Event — **Zahlung wird nie verbucht, Buchung nie bestätigt, Rechnung nie
bezahlt.** Ein DoS direkt auf dem Geldpfad, ohne Login.

Betroffen sind **48 `SECURITY DEFINER`-Funktionen**, darunter auch
`add_balance_entry_atomic`, `create_invoice_with_items`,
`generate_season_invoices_atomic`, `create_booking_safe`, `enqueue_job`,
`claim_background_job`, `complete_job`, `fail_job`, `prune_audit_logs`,
`get_cron_failures` — allesamt per `GRANT ALL` an `anon`/`authenticated`.

Die Ursache ist die Baseline vom 16.08.2026, die offenbar den (überpermissiven)
Live-Zustand der DB abbildet. Im ursprünglichen Migrationsstand war nur
`GRANT EXECUTE … TO service_role` vorgesehen (siehe `archive/`-Migrationsdatei
`20260623_stripe_events_idempotency.sql`).

**Fix:** Neue Migration, die für alle `SECURITY DEFINER`-Funktionen die Grants
an `anon`/`authenticated` mit `REVOKE` zurücknimmt und nur `service_role`
EXECUTE lässt.

### 2. Zwei der sechs Vercel-Crons laufen de facto nicht

`vercel.json` definiert sechs Cron-Jobs. Zwei davon können so nie erfolgreich
laufen:

| Cron-Route                        | Problem                                                                                                                                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/reminders/booking-tomorrow` | Route exportiert **nur `POST`** und verlangt Admin-Auth (`withApiAuth` + `verifyRole('admin')`). Vercel Cron ruft **GET ohne Session** auf → 405 bzw. 401. **Buchungs-Erinnerungen werden nie versendet.** |
| `/api/cron/prune-audit-logs`      | Prüft nur den Header `x-cron-secret`. Vercel sendet `Authorization: Bearer <CRON_SECRET>` → immer 401. **Audit-Log-Bereinigung läuft nie.**                                                                |

Der Totmannschalter in `/api/health` (`recordHeartbeat('cron-booking-reminders')`
bzw. `cron-prune-audit-logs`) wird dadurch nie gefüttert — die Jobs werden als
`unbekannt` geführt, ohne dass je ein Alarm käme.

**Fix:** `booking-tomorrow` auf GET + `CRON_SECRET`-Auth umstellen (wie die
anderen Cron-Routen) oder einen separaten Trigger bauen; `prune-audit-logs` auf
`Authorization: Bearer` umstellen.

### 3. Keine Staging-/Preview-Umgebung

`vercel.json`:

```json
"ignoreCommand": "test \"$VERCEL_ENV\" != \"production\""
```

überspringt **alle** Nicht-Production-Deploys. Es gibt also keinen Preview-/
Staging-Deploy, auf dem vor dem Merge verifiziert werden kann — jeder Merge auf
`main` geht unmittelbar live. Kombiniert mit der Auslieferungsregel in
`AGENTS.md` heißt das: kein Rückzugsort zwischen „grün auf meiner Maschine" und
„läuft für alle Vereine".

**Empfehlung:** `ignoreCommand` entfernen oder zumindest einen benannten
Preview-Deploy für kritische Änderungen erzwingen.

---

## P1 — hoch

### 4. Stripe-Checkout/Subscribe ohne `idempotencyKey`

`app/api/stripe/checkout/route.ts` und `app/api/stripe/subscribe/route.ts`
rufen `stripe.checkout.sessions.create(...)` **ohne** `idempotencyKey` auf;
der Plan-Wechsel in `subscribe/route.ts` ruft `stripe.subscriptions.update(...)`
ebenfalls ohne. Bei einem Netzwerk-Retry nach Timeout entsteht eine zweite
Session bzw. wird ein Prerotation-Doppelschritt ausgelöst. Die Webhook-Seite ist
idempotent (P0-1-RPC), die Erstellungs-Seite nicht.

**Fix:** `{ idempotencyKey }` auf Basis einer stabilen, pro-Vorgang eindeutigen
ID (z. B. `bookingId`, `userId:plan:interval`) setzen.

### 5. Buchungspreis fällt hart auf €15 zurück

`app/api/stripe/checkout/route.ts`:

```ts
if (!resolvedAmount || resolvedAmount <= 0) {
  resolvedAmount = 1500; // 15 EUR default
}
```

Wenn `booking_rules` keinen Preis liefert (nicht gepflegt, andere Rolle, Query
leer), wird **stillschweigend €15** abgebucht — unabhängig vom tatsächlichen
Platzpreis. In einem Produktionssystem darf ein Preis nie still auf einen
Default fallen, der vom Kunden nicht bestätigt wurde.

**Fix:** Ohne auflösbaren Preis abbrechen (503/400) statt Default setzen, oder
den Default explizit als Vereinseinstellung führen.

### 6. Stripe-Idempotenz „fail open"

`app/api/webhooks/stripe/route.ts` fängt Fehler der RPC
`check_and_record_stripe_event` ab und verarbeitet den Event trotzdem weiter
(„graceful degradation"). Ist die `stripe_events`-Tabelle/RPC nicht da (z. B.
bei nicht angewendeter Migration), gibt es **keine** Deduplizierung im
Geldpfad. Verständlicher Kompromiss, sollte aber als explizite, überwachte
Entscheidung (Heartbeat/Alert) statt als stiller Fallback dokumentiert sein.

---

## P2 — mittel

### 7. In-Memory-Rate-Limit ist in Serverless wirkungslos

`lib/rate-limit.ts` fällt bei Upstash-Ausfall auf einen In-Memory-Store zurück.
Auf Vercel-Serverless ist der pro Invocation leer → bei Upstash-Ausfall ist
Rate-Limiting **de facto aus**. Der globale Limiter in `proxy.ts` failt genauso
open. Beides ist als „lieber durchlassen als sperren" kommentiert, aber die
Konsequenz (kein Brute-Force-Schutz bei Limiter-Ausfall) sollte bewusst
akzeptiert und idealerweise überwacht sein.

### 8. `.env.example` nicht synchron mit `lib/env.ts`

`git show HEAD:.env.example` vs. `lib/env.ts`:

- `RESEND_API_KEY` ist in `env.ts` **required** (`z.string().min(1)`), im Example
  als „Optional — Emails werden übersprungen" beschrieben.
- `CRON_SECRET` ist in `env.ts` required, im Example nur auskommentiert.
- Example nutzt `STRIPE_PRICE_PRO`/`STRIPE_PRICE_ENTERPRISE`, der Code
  `STRIPE_PRICE_SOLO_*`/`STRIPE_PRICE_SCHOOL_*` (plus Intervalle).
- Example hat `SENTRY_DSN`, der Code `NEXT_PUBLIC_SENTRY_DSN`; `SENTRY_ORG`,
  `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` fehlen im Example.
- `GOOGLE_GENERATIVE_AI_API_KEY` (aktiver KI-Provider laut `CLAUDE.md`) fehlt.

Ein neuer Dev nach Example bekommt einen Build-Fehler oder fehlende Features.

### 9. Cron-Auth in drei inkonsistenten Varianten

- `Authorization: Bearer <CRON_SECRET>`: billing-overdue, backup, nuliga-sync, reactivation
- `x-cron-secret`-Header: prune-audit-logs, check-absences
- beides: refresh-base-rates

Vercel sendet nur `Bearer`. Einzige konsistente Lösung wäre: ein gemeinsamer
Helper (z. B. `verifyCronSecret(request)`), der beide akzeptiert.

### 10. Toter, duplizierter Stripe-Webhook-Handler

`lib/stripe/stripe-client.ts` enthält `handleStripeWebhook`,
`handleCheckoutSessionCompleted`, `handlePaymentIntentSucceeded/Failed`,
`createStripeCheckoutSession`, `getStripeCheckoutSession` — die vom echten
Webhook (`app/api/webhooks/stripe/route.ts`) **nicht** genutzt werden. Es gibt
damit zwei „Quellen der Wahrheit" fürs Webhook-Handling; die tote Variante kann
bei einer späteren Änderung jemanden auf die falsche Fährte führen.

### 11. `dangerouslyAllowSVG: true` in `next.config.js`

In Kombination mit User-Uploads (Supabase Storage) ein SVG-XSS-Vektor.
`contentDispositionType: 'attachment'` mildert das für `<img>`-Quellen, hebt es
aber nicht auf. Empfehlung: SVG nur von erlaubten Hosts zulassen und
User-Upload-SVGs serverseitig sanitieren oder ausschließen.

### 12. Logging-Inkonsistenzen

- `lib/logger.ts` `createLogger('modul')`: Bei `log.error(msg, Error)` wird der
  Modulname **nicht** an den Sentry-Scope gehängt (der `Error`-Pfad ersetzt den
  Context statt ihn zu ergänzen). Modul-Tags fehlen dann genau auf dem
  Fehlerpfad.
- `proxy.ts` nutzt `console.warn` für die CSRF-Ablehnung — Verstoß gegen die
  „nie `console.*`"-Konvention; läuft an Sentry vorbei.

### 13. Secret-Backups liegen unverschlüsselt im Repo-Root

`.env.local`, `.env.prod.local` (je 191 Zeilen) sowie
`.env.local.bak-tskey` (194) und `.env.local.bak-vor-lokal-umstellung` (187)
liegen im Projekt-Root. Sie sind gitignored (Muster `.env*.bak*`, `.env*.local`),
aber ein versehentliches `git add -A`/Backup-Tooling würde die Secrets
einchecken. Empfehlung: außerhalb des Repos lagern oder löschen.

---

## Verifiziert OK (kein Handlungsbedarf)

- **Stripe-Webhook:** Signaturprüfung via `constructEvent` (`stripe-client.ts`)
  - atomare RPC-Idempotenz vorhanden.
- **`lib/supabase/service.ts`** trägt `import 'server-only'` — Service-Role-Key
  kann nicht in Client-Bundles landen.
- **CSRF:** Double-Submit-Cookie + timing-sicherer Vergleich in `proxy.ts`;
  Mutation-Routen werden abgedeckt.
- **Security-Header:** CSP (mit `script-src` ohne `unsafe-eval` in Prod), HSTS
  - `preload`, `X-Frame-Options: DENY`, `nosniff`, COOP/COEP gesetzt.
- **Sentry:** Client mit PII-/Replay-Masking, Server mit Secret-Scrubbing und
  Cron-Check-Ins.
- **Monitoring:** `/api/health` + Totmannschalter (`ops_heartbeats`) + GitHub-
  Actions-Workflow `monitor.yml` (alle 30 min, inkl. VPS-Gateway-Check).
- **CI:** typecheck + Unit-Tests + `pnpm audit --audit-level=high` +
  `migrations-from-scratch` gegen leere DB; E2E-Smoke optional.
- **`/api-docs` & Swagger-Spec:** in Produktion korrekt `notFound()` bzw. auf
  admin/superadmin beschränkt.
- **Env-Validierung:** Zod, kritische Secrets required, `emptyStringAsUndefined`.
- **Keine hartkodierten Secrets** in `app/` und `lib/` gefunden.

---

## Nicht geprüft (ehrliche Grenzen dieses Audits)

- **Vollständige Einzeldurchsicht aller ~300 API-Routen** auf korrekten
  `withAuth`-Einsatz: geprüft wurden die zentralen Wrapper (`api-auth.ts`,
  `proxy.ts`) und die Geld-/Cron-/Backup-Routen. Die zentrale Architektur
  (ein Wrapper statt per-Route-Logik) spricht für Abdeckung, ersetzt aber
  keine Einzelprüfung.
- **Live-DB-Abgleich der RLS-Policies:** Die Baseline wurde als Datei geprüft,
  nicht gegen die laufende Produktions-DB (`pg_policies`). Der Befund #1 ist so
  gravierend, dass ein Live-Abgleich empfohlen ist.
- **Browser-/Mobil-Durchlauf** und reale Zahlungs-Testläufe (kein Sandbox-Zugriff).
