# SwingZ — Marktreife-Audit (2026-07-01)

> 11-Domänen-Analyse via paralleler Subagents. Reine Analyse, keine Code-Änderungen in diesem Durchgang.
> Tooling-Vorlauf: `npx tsc --noEmit` sauber (0 Errors), `npm audit` 6 Schwachstellen (5 moderate, 1 high — alle transitiv/nicht praktisch ausnutzbar, siehe Domäne 2), 306 API-Routes, 185+ `console.*`-Vorkommen.

## Reifegrad-Scorecard

| #   | Domäne                             | Reifegrad | Kernaussage                                                                                                                              |
| --- | ---------------------------------- | :-------: | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Mandantentrennung                  |    2/4    | RLS-Policies korrekt, aber Drizzle-Routes (RLS-Bypass via `postgres`-Rolle) haben einen echten Cross-Tenant-Write-Bug + Read-IDOR-Muster |
| 2   | Auth & Security                    |  **3/4**  | Solide — alle 15 verdächtigen Routes verifiziert, keine Blocker. Beste Domäne im Audit                                                   |
| 3   | Billing-Lebenszyklus               |    2/4    | Webhook-Idempotenz vorbildlich, aber Plan-Wechsel dupliziert Abos und kein Dunning bei Zahlungsausfall                                   |
| 4   | Datenintegrität & Nebenläufigkeit  |    2/4    | Haupt-Buchungspfad robust (FOR UPDATE + GIST-Exclusion), aber nuLiga-Import täuscht Erfolg vor + Timezone-Inkonsistenz                   |
| 5   | Externe Abhängigkeiten & Resilienz |    2/4    | nuLiga-Scraper/Schedule-Generator vorbildlich, Gemini-Calls aber ohne Timeout/Rate-Limit; reale (geringe) Prompt-Injection-Fläche        |
| 6   | Code-Architektur-Konsistenz        |    2/4    | Clean-Architecture-Schicht real, aber nur bei ~20% der Routes genutzt; Kerndomänen (Bookings, Billing, Matches) umgehen sie              |
| 7   | Test & Qualitätssicherung          |  **1/4**  | Suite ist aktuell rot (65/1511 Tests fehlschlagend), Multi-Tenant-Tests beide rot, keine CI-Gate                                         |
| 8   | Performance & Skalierbarkeit       |    2/4    | Pagination/Caching-Utilities existieren, werden aber kaum genutzt; `lib/server-cache.ts` ist komplett totes Gerüst                       |
| 9   | Accessibility & i18n               |    2/4    | a11y-Sprint war technisch gut, aber auf neue Infrastruktur beschränkt — Bestandsfläche (Admin-Modals) nicht migriert                     |
| 10  | Betriebsreife & Incident-Fähigkeit |    2/4    | Bausteine (Sentry, Backup, Health-Check) überraschend weit, aber nicht end-to-end verdrahtet/verifiziert                                 |
| 11  | DSGVO & Recht                      |  **1/4**  | Impressum mit Platzhalterdaten, kein Cookie-Consent trotz aktivem GA-Tracking, Google Gemini fehlt in der Datenschutzerklärung           |

**Gesamtbild: Ø 1,9/4.** Kein Bereich bei 0 (keine Totalausfälle), aber auch nur einer über 2 — solide Einzelmuster, die nicht flächendeckend durchgesetzt sind.

---

## Blocker-Liste (12, verkaufs-/betriebskritisch)

### Geld

1. **Plan-Wechsel dupliziert Abos** (Domäne 3) — `app/api/stripe/subscribe/route.ts:81-96` erstellt bei Starter→Professional immer eine neue Checkout-Session statt `stripe.subscriptions.update()` mit `proration_behavior`. Altes Abo läuft parallel weiter → Doppelbelastung. Aufwand: M (1–2 Tage).
2. **Kein Dunning** (Domäne 3) — `app/api/webhooks/stripe/route.ts` hat keinen `invoice.payment_failed`-Case. `subscription_status=past_due/unpaid` wird nirgends zur Zugriffssperre geprüft (`app/(protected)/admin/(gated)/layout.tsx:9-37` prüft nur `setup_completed_at`). Kunde mit fehlschlagender Zahlung bleibt bis zu 2–4 Wochen (Stripe Smart Retries) voll aktiv. Aufwand: M (1–2 Tage).

### Sicherheit/Daten

3. **Cross-Tenant Write** (Domäne 1) — `PATCH /api/clubs/[id]` prüft nur die globale Rollen-Hierarchie, nicht ob die Club-ID zum anfragenden Admin gehört. Läuft über Drizzle/`postgres`-Rolle (RLS-Bypass). Repro: Admin von Club A sendet `PATCH /api/clubs/<Club-B-UUID>` → manipuliert fremden Verein. Aufwand: S (1–2h).
4. **nuLiga-Import täuscht Erfolg vor** (Domäne 4) — `app/api/admin/nuliga/import/route.ts:50-83` nutzt `upsert(..., onConflict: 'league_id,name')`, aber `teams`/`match_days` haben keinen passenden UNIQUE-Constraint. Der `error`-Rückgabewert wird nicht ausgelesen; Zähler wird trotzdem bedingungslos inkrementiert. API meldet "3 importiert" bei 0 geschriebenen Zeilen. Aufwand: M (Constraint-Migration + Error-Handling, 0,5–1 Tag).

### Betrieb

5. **Sentry nicht verdrahtet** (Domäne 10) — `app/global-error.tsx:22` loggt nur `console.error` statt `Sentry.captureException`. Kritische, nicht abgefangene Client-Fehler landen nirgends im Monitoring. Aufwand: 15 Min.
   - Zusätzlich: kein `withSentryConfig()`-Wrapper in `next.config.js` → fehlendes Source-Map-Upload/Release-Tracking, Stacktraces in Prod vermutlich unbrauchbar. Aufwand: 0,5 Tag.
6. **Backup ohne Restore-Pfad** (Domäne 10) — `app/api/cron/backup/route.ts` exportiert täglich 37 Tabellen als JSON, aber es existiert kein Restore-Skript und keine Doku dazu. Backup ohne verifizierten Restore-Weg ist im Ernstfall wertlos. Aufwand: 1–2 Tage.

### Recht (keine Rechtsberatung — technische Befunde)

7. **Impressum mit Platzhalterdaten** (Domäne 11) — `app/impressum/page.tsx:61-96`: "Musterstraße 1, 12345 Musterstadt", kein Handelsregistereintrag, keine USt-IdNr., keine namentlich genannte Vertretungsberechtigung. Aufwand: 1h (sobald echte Firmendaten vorliegen).
8. **Kein Cookie-Consent trotz aktivem GA-Tracking** (Domäne 11) — `components/analytics-provider.tsx:29-51` lädt Google Analytics ungebremst, kein Consent-Banner im gesamten Repo gefunden. TTDSG/DSGVO-Verstoß auf Landing + `/trial-training`. Aufwand: 4–8h.
9. **Datenschutzerklärung ohne echte Sub-Processor** (Domäne 11) — `app/datenschutz/page.tsx:140-159` bleibt generisch ("zertifizierter Zahlungsdienstleister" statt Stripe), **Google Gemini fehlt komplett** obwohl personenbezogene Daten in die USA fließen (KI-Matchmaking/Churn-Prediction). Widerspricht `app/privacy/page.tsx:94-96` ("Daten verlassen die EU nicht"). Aufwand: 4–6h + rechtlicher Review Drittlandtransfer.

### Qualitätssicherung

10. **Multi-Tenant-Isolation-Tests sind beide rot** (Domäne 7) — `tests/unit/app/api/clubs/[id]/hardware-vendor/route.test.ts` und `src/__tests__/api/clubs-features.test.ts` schlagen fehl. Die einzige automatisierte Verifikation der wichtigsten Sicherheitseigenschaft liefert aktuell kein grünes Ergebnis (vermutlich Mock-Leak zwischen Tests, nicht Prod-Bug — aber unverifiziert). Aufwand: 0,5–1 Tag.
11. **Keine CI-Gate** (Domäne 7) — `.github/workflows/` enthält nur `db-audit.yml`/`perf-bench.yml`, kein Workflow führt `tsc`/`vitest`/`playwright` aus. Pre-Commit-Hook prüft nur Lint, keine Tests; `--no-verify` umgeht ihn. 65 fehlschlagende Tests blockieren kein Deployment. Aufwand: 0,5 Tag.
12. **Admin-Onboarding effektiv ungetestet** (Domäne 7) — einziger Test ist `tests/e2e/onboarding-wizard.spec.ts`, env-gated (`TEST_ADMIN_EMAIL/PASSWORD`), läuft in keiner Standard-CI-Umgebung. Aufwand: 2–3 Tage für Unit/Integration-Tests.

---

## Querschnittsmuster (Hoch/Mittel, wiederkehrend über mehrere Domänen)

- **RLS-Bypass ist systemisch, nicht nur Blocker #3.** Alle Drizzle-Routes (`src/infrastructure/persistence/db.ts`) laufen über die `postgres`-Rolle und umgehen RLS vollständig. Domäne 1 fand ein weiteres Read-IDOR-Muster über `app/api/schedule/route.ts`, `app/api/groups/route.ts`, `app/api/pricing-rules/route.ts`, `app/api/analytics/route.ts` — `clubId` aus Query-Param wird nicht gegen Membership geprüft.
- **Architektur-Drift.** Nur ~62/306 Routes (20%) nutzen die geplante `src/application`-Schicht. Zwei parallele Billing-Implementierungen (`lib/billing-engine.ts` vs. `src/application/services/billing.service.ts`) ohne erkennbare Konsolidierungsstrategie.
- **Utilities gebaut, aber nicht angewendet** — Muster wiederholt sich: `lib/server-cache.ts` (Performance) komplett ungenutzt trotz fertiger `unstable_cache()`-Konfiguration; `lib/services/anonymize.service.ts` (DSGVO) toter Code, Lösch-Endpoint nutzt eigene, schwächere Logik; `lib/db/audit-logger.ts` (DSGVO-Lese-Audit, Ticket B8/A4) nur an 2 Stellen im Code aufgerufen.
- **Timezone-Handling uneinheitlich.** `sessions.timeslot_start/end` ist naive `timestamp` (keine Zeitzone), `bookings` korrekt `timestamptz`. Season-Planning (`app/api/seasons/[id]/planning/confirm/route.ts:280-299`) baut Zeiten über lokale Server-Zeit statt Europe/Berlin-bewusst — Bug-Quelle bei DST-Umstellung.
- **a11y-/Konsistenzarbeit bleibt auf neue Infrastruktur beschränkt.** Sowohl bei Accessibility (Domäne 9: `CenteredModal` löst alte Modals nicht flächendeckend ab) als auch bei Resilienz (Domäne 5: nur 3 von 6 Cron-Jobs haben Sentry-Check-In-Monitoring) zeigt sich dasselbe Muster: neue, gute Patterns existieren, wurden aber nicht rückwirkend auf Bestandscode angewendet.

---

## Domänen-Details (Kurzfassung)

### 1 — Mandantentrennung (2/4)

Blocker: Cross-Tenant Write `PATCH /api/clubs/[id]`. Hoch: systemisches Read-IDOR über Drizzle-Routes. Mittel: `GET /api/clubs/[id]` liefert Geschäftskonfiguration fremder Clubs an jeden Member. Positiv: RLS-Policies selbst (Stichprobe `bookings`, `groups`, `clubs`, `notifications`) korrekt membership-scoped.

### 2 — Auth & Security (3/4)

Alle 15 vom Tooling-Vorlauf als "ungeschützt" markierten Routes einzeln verifiziert — **keine ist eine echte Lücke**, alle False Positives (manuelle Auth-Checks statt Standard-Wrapper). Hoch: Zapier-Webhook überspringt Signaturprüfung außerhalb `NODE_ENV=production`. Mittel: SVG-Upload beim Club-Logo ohne Sanitizing (Stored-XSS-Potenzial); CSRF-Logik doppelt implementiert (`proxy.ts` + `lib/csrf.ts`). npm-audit-Findings (dompurify/joi/postcss/undici) alle transitiv, nicht praktisch ausnutzbar.

### 3 — Billing-Lebenszyklus (2/4)

Blocker: Plan-Wechsel-Duplizierung, fehlendes Dunning. Hoch: Mitglieder-Zähler-Sync existiert (`lib/services/stripe-subscription-quantity-sync.service.ts`), läuft aber nur manuell, kein Cron; keine Idempotency-Keys bei Checkout-Session-Erstellung. Positiv: Webhook-Idempotenz (`stripe_events`-Tabelle + atomare RPC) und Signaturprüfung vorbildlich.

### 4 — Datenintegrität & Nebenläufigkeit (2/4)

Blocker: nuLiga-Import-Fehlschreibung. Hoch: Timezone-Inkonsistenz `sessions` vs. `bookings`; `courts` löscht per CASCADE historische Buchungen. Mittel: schwächerer Race-Schutz bei `/api/bookings/direct` vs. Hauptpfad; fehlende Indizes auf Nebenfeature-FKs; `clubs.default_hourly_rate` ohne CHECK-Constraint. Positiv: Haupt-Buchungspfad (`create_booking_safe` RPC) mit `FOR UPDATE` + Capacity-Check + GIST-Exclusion + Trigger — Defense-in-Depth vorbildlich.

### 5 — Externe Abhängigkeiten & Resilienz (2/4)

Hoch: kein Timeout bei Gemini-Calls (`lib/ai/schedule-generator-v2.ts`, `app/api/seasons/planning/ai-analysis/route.ts`). Mittel: kein Rate-Limit auf KI-Analyse-Route (Kostenkontrolle fehlt); nur 3/6 Cron-Jobs mit Sentry-Check-In; Resend-Fehler werden komplett verschluckt (`email.service.ts:461-463`, zusätzlich `console.error` statt `createLogger`). Prompt-Injection real vorhanden (Mitgliedernamen fließen ungefiltert in Prompts), Auswirkung aber gering verifiziert (kein `dangerouslySetInnerHTML`, kein automatischer DB-Schreibpfad). nuLiga-SSRF-Verdacht entkräftet (Hostname-Whitelist greift am Fetch-Zeitpunkt). `/api/ai/matchmaking` und `/api/ai/churn-prediction` sind trotz Namen reine deterministische Algorithmen ohne Gemini-Aufruf.

### 6 — Code-Architektur-Konsistenz (2/4)

62/306 Routes (20%) nutzen `src/application`; Kerndomänen (Bookings, Billing, Matches/Ligen) laufen am Clean-Architecture-Layer vorbei über einen parallelen `lib/`-Service-Stack. Zwei konkurrierende Billing-Architekturen ohne Logik-Duplikation, aber unklare Konvention für neue Features. 3/20 Stichproben-Components komplett tot (`admin-hero-header.tsx`, `trainer-member-note.tsx`, `qr-checkin.tsx`) — hochgerechnet ~15–20 verwaiste Dateien im Projekt. `apiFetch`-Konvention gut eingehalten (nur 10 Ausreißer). Logging-Verstöße breit gestreut (63% der 89 betroffenen Dateien haben nur 1 Vorkommen) — Fix erfordert viele kleine Edits statt weniger Hotspots.

### 7 — Test & Qualitätssicherung (1/4)

117 Testdateien / 1.275 Source-Dateien, ~1.511 Einzeltests — substanzielle Basis, aber Suite aktuell rot (16/94 Dateien, 65 Tests). Blocker: Multi-Tenant-Tests rot, keine CI-Gate. Hoch: Skip-Commit (`13bc3cf7`) unvollständig — 4 weitere Testdateien mit demselben `@midscene`-Root-Cause weiterhin rot; Payment-Flow-Integration teilweise rot (SEPA/Pain.008 Steps 6+7); Admin-Onboarding praktisch ungetestet. Mittel: kein zentraler RBAC-Matrix-Test für die 5-Rollen-Hierarchie; 58 `test.skip()` in E2E-Specs sind überwiegend Laufzeit-Conditional-Skips, maskieren potenziell Regressionen.

### 8 — Performance & Skalierbarkeit (2/4)

_(Statische Analyse, kein Lighthouse-Lauf in diesem Durchgang.)_ Hoch: N+1-Queries im Superadmin-Dashboard und Tenants-Übersicht (2 identische Implementierungen, eine davon in falschem Pfad); `lib/server-cache.ts` vollständig ungenutzt trotz fertiger Konfiguration — häufig gelesene Daten (Branding, Feature-Flags) gehen bei jedem Request voll gegen die DB. Mittel: nur 5/306 Routes nutzen `getPagination`; Rich-Text-Editor (Tiptap) ohne Dynamic Import; Landing Page komplett als eine große Client-Component ohne RSC-Aufteilung. 57 `force-dynamic`-Exporte größtenteils gerechtfertigt (Auth-Session-Reads).

### 9 — Accessibility & i18n (2/4)

_(Statische Analyse, kein Live-Screenreader-/Kontrast-Test.)_ Hoch: zwei handgerollte Admin-Modals (`admin-trial-approvals.tsx`) ohne Focus-Trap/`role="dialog"` — genau das Muster, das `CenteredModal` ablösen sollte; harte englische Strings in shadcn-Primitiven (`dialog.tsx` "Close", `breadcrumb.tsx` "Home"/"Breadcrumb", ein `"Loading..."`-State). Mittel: Suchfelder nur mit Placeholder statt Label (8 Dateien); 2 Kontrastrisiken (`text-gray-400` ohne dark-Pendant). Positiv: Formulare durchgängig korrekt gelabelt, keine `<div onClick>`-Antipatterns, keine fehlenden `alt`-Attribute, globale ARIA-Live-Infrastruktur (`AriaLiveProvider`, `SonnerAriaBridge`) sauber gemountet.

### 10 — Betriebsreife & Incident-Fähigkeit (2/4)

Blocker: Sentry im Errorboundary nicht verdrahtet, kein `withSentryConfig`, Backup ohne Restore-Pfad. Hoch: `.env.example` nicht synchron mit `lib/env.ts` (fehlt u.a. `CRON_SECRET`, `GOOGLE_GENERATIVE_AI_API_KEY`, mehrere Stripe-Preis-IDs); keine erkennbare Staging-Umgebung; keine Runbooks für Incident-Fälle. Mittel: Feature-Flags zu grob für globalen Kill-Switch (nur pro Club); Logging-Korrelation uneinheitlich (manche Routes ohne club_id/user_id im Log); CSV-Bulk-Import ohne Wiederaufnahme-Logik bei Timeout. Positiv: `/api/health` vorhanden und sinnvoll, Backup-Cron und Sentry-Grundkonfiguration weiter fortgeschritten als der Reifegrad vermuten lässt — reines Verdrahtungsproblem.

### 11 — DSGVO & Recht (1/4)

_(Keine Rechtsberatung.)_ Blocker: Impressum-Platzhalter, fehlender Cookie-Consent, unvollständige Sub-Processor-Liste. Hoch: DSGVO-Lese-Audit-Trail (Ticket B8/A4) bestätigt weiterhin offen — `logPiiRead()` nur an 2 Stellen aufgerufen; Löschfunktion vorhanden aber unvollständig (SEPA/IBAN bleibt ungewiped, korrekter `anonymize.service.ts` wird nicht genutzt); kein AVV-Template im Repo für Vereinskunden. Mittel: Newsletter-Feature ohne Double-Opt-In. Positiv: Grundstruktur der Datenschutzerklärung (Verantwortlicher, Betroffenenrechte, Speicherdauer) inhaltlich vorhanden, nur Sub-Processor-Details fehlen.

---

## Empfehlung: Go-mit-Auflagen

Kein struktureller Totalschaden — die Architektur trägt, aber mehrere konkrete, gut eingrenzbare Lücken müssen vor dem ersten zahlenden Kunden geschlossen werden. Geschätzter Gesamtaufwand für alle 12 Blocker: **~8–12 Personentage**, keiner davon ist architektonisch riskant.

**Top 5 nach Risiko-Reduktion/Aufwand:**

1. Cross-Tenant-Write-Fix (`PATCH /api/clubs/[id]`) — 1–2h, schließt eine reale Sicherheitslücke
2. Sentry-Wiring (`global-error.tsx` + `next.config.js`-Wrapper) — <1 Tag, macht Produktionsfehler überhaupt erst sichtbar
3. Cookie-Consent-Banner — 4–8h, entfernt einen aktiv laufenden Rechtsverstoß
4. nuLiga-Import-Fix (Constraint + Error-Handling) — 0,5–1 Tag, verhindert stillen Vertrauensverlust bei Kunden
5. Dunning-Handler (`invoice.payment_failed` + Zugriffssperre) — 1–2 Tage, schließt direkten Umsatzverlust

Danach: CI-Gate einziehen (0,5 Tag) und Multi-Tenant-Tests grün bekommen — beides niedriger Aufwand, aber Voraussetzung dafür, dass zukünftige Änderungen nicht unbemerkt neue Blocker dieser Art einführen.
