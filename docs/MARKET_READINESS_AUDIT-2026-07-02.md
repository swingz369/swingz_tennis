# Marktreife-Audit SwingZ — 2026-07-02

> Ausgeführt nach `docs/MARKET_READINESS_PROMPT.md`. Alle Aussagen aus frischer Code-Evidenz (Datei:Zeile bzw. Befehl), keine Übernahme aus älteren .md-Reports.

---

## Audit: 72/100, Launchable with caveats — die zwei wichtigsten Risiken: 84 rote Unit-Tests (14 Testdateien) und fehlender AV-Vertrag (DSGVO Art. 28) für den B2B-Verkauf an Vereine.

**Score-Begründung:** Keiner der harten Caps (Auth-Lücke, nicht-idempotente Payment-Webhooks, exponierte Secrets) greift. Cap bei 84 greift: Tests nicht grün (84 failed / 1398 passed) und kein CI-Workflow, der Build + Tests bei jedem Push verifiziert (`.github/workflows/` enthält nur `db-audit.yml` und `perf-bench.yml`); zusätzlich 4 E2E-Tests als broken geskippt (Commit `13bc3cf7`). Abzüge darunter für die rote Testsuite, die B2B-Rechtslücke (AVV) und Release-Hygiene (419 uncommittete Änderungen auf Feature-Branch).

---

## Blocker (vor Verkauf fixen)

1. **AV-Vertrag (Auftragsverarbeitung, DSGVO Art. 28) fehlt komplett.**
   Evidenz: `grep -riE "auftragsverarbeitung|av-vertrag|avv" app/ components/` → 0 Treffer.
   Vereine verarbeiten Mitglieder-Personendaten über SwingZ → SwingZ ist Auftragsverarbeiter. Ohne AVV darf ein Verein rechtlich nicht unterschreiben. Fix: AVV-Dokument (Muster z.B. von Bitkom) als Seite/PDF bereitstellen und im Onboarding/AGB verlinken.

2. **Unit-Testsuite rot: 84 failed / 1398 passed / 29 skipped (14 von 94 Testdateien fehlgeschlagen).**
   Evidenz: `npx vitest run`, Dauer 233 s; Beispiel-Failure: `tests/unit/app/api/webhooks/booking-completed/route.test.ts:182` („Unexpected-table-in-mock: bookings" — Mock kennt die `bookings`-Tabelle nicht, d.h. Tests hinken dem Code hinterher).
   Eine rote Suite macht jede Regression unsichtbar. Fix: die 14 Dateien reparieren oder Mocks aktualisieren, bis `vitest run` grün ist.

3. **Keine CI-Pipeline für Build + Tests.**
   Evidenz: `.github/workflows/` = nur `db-audit.yml`, `perf-bench.yml`.
   Jeder Deploy geht ungeprüft raus (Vercel baut zwar, aber ohne Testlauf). Fix: ein Workflow mit `tsc --noEmit` + `vitest run` + Playwright-Smoke auf PR/main. (Hätte Blocker 2 verhindert.)

## Hochwertige Fixes (heben den Score)

1. **4 geskippte E2E-Tests reparieren** (Commit `13bc3cf7`, @midscene-Abhängigkeit entfernt) — der kaufkritische Pfad braucht grüne E2E-Abdeckung; `tests/e2e/billing-flow.spec.ts` existiert bereits.
2. **Sitemap fehlt** — `app/sitemap.ts` anlegen (robots.txt existiert: `public/robots.txt`). Für SEO/Auffindbarkeit der Landing Page.
3. **Trial-Training ohne echtes Double-Opt-In** — `app/api/public/trial-training/route.ts:91` sendet nur eine Bestätigungs-Mail (fire-and-forget), Daten werden davor gespeichert. Für werbliche Folge-Mails DOI nachrüsten.
4. **`app/api/bookings/validate-series/route.ts:33`** — `club_id`/`court_id` kommen aus dem Request-Body ohne Membership-Prüfung. RLS (User-Kontext-Client) begrenzt den Schaden, aber App-Layer-Check auf Club-Zugehörigkeit ergänzen.
5. **419 uncommittete Änderungen** auf `feat/sprint-3-plus-a11y-theme-fixes` (`git status --short | wc -l`) — Release-Stand nicht reproduzierbar. Committen, PR, mergen.
6. **Rollback-/Backup-Dokumentation** — 102+ Migrationen, kein dokumentierter Rollback-Pfad oder Supabase-Backup-/Restore-Prozess gefunden. Eine Seite Runbook genügt.

## Was geprüft wurde und in Ordnung ist (Kurzform)

| Bereich          | Befund                                                                                                                                                                                                               | Evidenz                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| TypeScript       | 0 Errors                                                                                                                                                                                                             | `npx tsc --noEmit` → Exit 0                                                                           |
| Stripe-Webhook   | Signatur (`constructStripeEvent`) + Event-ID-Idempotenz (RPC `p_event_id`, „already processed — skipping")                                                                                                           | `app/api/webhooks/stripe/route.ts:34–65`                                                              |
| Stripe-Lifecycle | `checkout.session.completed`, `subscription.updated/.deleted`, `invoice.payment_failed`, `charge.refunded`, `payment_intent.payment_failed` behandelt                                                                | `app/api/webhooks/stripe/route.ts:68–128`                                                             |
| Weitere Webhooks | Zapier: HMAC-SHA256, timing-safe; booking-completed: HMAC fail-closed + Idempotenz-Key                                                                                                                               | `app/api/webhooks/zapier/route.ts:32–65`, `app/api/webhooks/booking-completed/route.ts:123–133`       |
| API-Auth         | 306 Routes; die 12 ohne Auth-Wrapper sind bewusst public (csrf-token, public/\*, auth/login) oder anders gesichert (Cron: `Bearer CRON_SECRET`, Webhooks: HMAC, messages/read + validate-series: inline `getUser()`) | Einzeldurchsicht der 12 Routes                                                                        |
| Debug-Endpoint   | `api/debug/auth` in Produktion gesperrt (404)                                                                                                                                                                        | `app/api/debug/auth/route.ts:13–16`                                                                   |
| CSRF             | Token-Cookie + Header-Validierung, timing-safe, Ausnahmen nur für signaturbasierte Routes                                                                                                                            | `proxy.ts:34–151`                                                                                     |
| Rate Limiting    | `lib/rate-limit.ts`; aktiv auf Login (AUTH), Trial-Training (BOOKING), Kontakt (STRICT), Registrierung (STRICT)                                                                                                      | `app/api/auth/login/route.ts:11`, `app/api/public/register/route.ts:11` u.a.                          |
| ENV-Validierung  | Zod, kritische Vars required (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`)                                                                            | `lib/env.ts:19–48`                                                                                    |
| Service-Client   | Kein `createServiceClient` in Client-Komponenten                                                                                                                                                                     | grep über `"use client"`-Dateien → 0 Treffer                                                          |
| RLS              | 120× `ENABLE ROW LEVEL SECURITY` in `supabase/migrations/`                                                                                                                                                           | grep-Count                                                                                            |
| Error-Reporting  | Sentry installiert und konfiguriert (Client + Server)                                                                                                                                                                | `package.json:135`, `sentry.client.config.ts`, `sentry.server.config.ts`                              |
| Health-Check     | `/api/health` mit echtem Supabase-Ping, 503 bei Fehler                                                                                                                                                               | `app/api/health/route.ts`                                                                             |
| Rechtliches      | Impressum, Datenschutz, AGB als Seiten vorhanden + verlinkt; Cookie-Consent-Banner; Account-Löschung `app/api/user/delete`                                                                                           | `app/impressum/`, `app/datenschutz/`, `app/terms/page.tsx:76`, `components/cookie-consent-banner.tsx` |
| E2E-Bestand      | 2088 Tests in 30 Dateien, inkl. `billing-flow.spec.ts`                                                                                                                                                               | `npx playwright test --list`                                                                          |

## Unit-Tests

`npx vitest run`: **84 failed | 1398 passed | 29 skipped** (94 Testdateien, davon 14 rot). Details siehe Blocker 2.

## Fehlende Evidenz

- **E2E-Lauf-Ergebnis**: nur `--list` ausgeführt, kein Volllauf (Zeit/Token). Ein grüner Lauf von `billing-flow.spec.ts` gegen Staging würde die Confidence deutlich heben.
- **Produktions-Smoke**: swingz.vercel.app wurde nicht live geprüft (Landing, Checkout mit Stripe-Testkarte).
- **RLS-Wirksamkeit**: 120 RLS-Statements gezählt, aber keine Cross-Tenant-Penetrationsprobe (als User von Club A Daten von Club B anfragen).
- **Supabase-Backup-Konfiguration**: nur im Dashboard sichtbar, nicht im Repo.

## Nächster Schritt

Die 14 roten Unit-Testdateien grün machen (`npx vitest run`), danach sofort CI-Workflow anlegen (`.github/workflows/ci.yml` mit `tsc --noEmit` + `vitest run` auf PR), damit die Suite nie wieder unbemerkt rot wird.
