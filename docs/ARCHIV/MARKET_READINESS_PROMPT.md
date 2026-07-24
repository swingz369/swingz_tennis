# Prompt: Vollständige Marktreife-Analyse SwingZ

> Wiederverwendbarer Analyse-Prompt (erstellt 2026-07-02). In einer frischen Session ausführen.
> Ergebnis wird in `docs/MARKET_READINESS_AUDIT-<Datum>.md` festgehalten.

---

## Auftrag

Führe eine gründliche, tiefe Analyse der gesamten SwingZ-Codebase durch mit dem Ziel **Marktreife und Verkaufsbereitschaft**.

**Regeln:**

1. **Keine Sekundärquellen:** Verlasse dich NICHT auf bestehende .md-Dateien (Reports, Audits, Design-Docs). Jede Aussage muss durch Evidenz direkt aus Code, Konfiguration, Migrationen oder ausgeführten Befehlen belegt sein (Datei:Zeile oder Befehl + Output).
2. **Priorisierung statt Vollständigkeit:** Nur Findings aufnehmen, die eine Handlung auslösen. Jedes Finding mit Schweregrad (Blocker / Hoch / Mittel / Niedrig) und konkretem Fix.
3. **Score vergeben:** 0–100 nach Produktions-Audit-Bändern (0–49 Blocked, 50–69 Risky, 70–84 Launchable with caveats, 85–100 Strong). Score-Caps: Auth-Lücken auf sensiblen Daten, nicht-idempotente Payment-Webhooks, exponierte Secrets oder fehlender Rollback-Pfad → max 69. CI nicht grün oder kaufkritischer Pfad nicht E2E-getestet → max 84.

## Prüfbereiche

### 1. Technische Basis

- `npx tsc --noEmit` — muss 0 Errors ergeben
- `npx vitest run` — Unit-Test-Status
- `npx playwright test --list` — E2E-Abdeckung der kaufkritischen Pfade (Registrierung, Buchung, Bezahlung, Admin-Onboarding)
- CI-Workflows vorhanden und grün?

### 2. Sicherheit & Auth

- Alle API-Routes: `withApiAuth`/`verifyRole` bzw. Public-Status bewusst gesetzt? Ungeschützte Routes auflisten und einzeln bewerten (bewusst public vs. Lücke).
- `proxy.ts`: Route-Protection vollständig? CSRF aktiv?
- `createServiceClient()` nur server-seitig? RLS-Policies decken das Mandanten-Modell (Club-Isolation) ab?
- Rate Limiting auf Auth-/Public-Endpoints (Login, Trial-Training, Kontakt)?
- Cron-/Webhook-Routes durch Secret bzw. Signatur geschützt?
- Secrets: nichts im Client-Bundle, nichts in Git.

### 3. Stripe / Billing

- Webhook: Signatur-Verifikation (`constructEvent`) VOR Payload-Nutzung? Idempotenz (Event-ID-Dedupe gegen doppelte/verspätete Events)?
- Checkout-Flow end-to-end funktionsfähig? Test-/Live-Mode getrennt?
- Subscription-Lifecycle: Kündigung, Zahlungsfehler, Downgrade behandelt?

### 4. Rechtliches (DE-Markt, verkaufskritisch)

- Impressum, Datenschutzerklärung, AGB vorhanden und verlinkt?
- Cookie-Consent falls Tracking; AV-Vertrag-Fähigkeit (DSGVO Art. 28) für B2B-Kunden
- Double-Opt-In bei E-Mail-Erfassung (Trial-Training)? Account-Löschung (DSGVO Art. 17)?

### 5. Betrieb

- `lib/env.ts`: alle Pflicht-Variablen validiert, fail-fast?
- Health-Check-Endpoint? Error-Reporting (Sentry o.ä.)? Strukturierte Logs ohne PII-Leaks?
- Migrationen: laufen sauber vorwärts, Rollback-Pfad dokumentiert? Backup-/Restore-Strategie?

### 6. Produkt & UX (Verkaufsbereitschaft)

- Onboarding: Kann ein neuer Verein ohne Handarbeit von Registrierung → bezahltes Abo → produktive Nutzung kommen?
- Landing Page: Pricing klar, CTA funktioniert, mobil nutzbar, SEO-Basics (Meta, OG, Sitemap, robots)?
- Leere-/Fehler-/Lade-Zustände auf Kernseiten; deutsche Fehlermeldungen durchgängig
- Support-Pfad: Kontakt, Passwort-Reset

### 7. Multi-Tenancy & Skalierung

- Club-Datenisolation nachweisbar (RLS + App-Layer club_id-Filter auf Hot Paths)?
- N+1-Queries / fehlende Indizes auf Buchungen/Kalender?

## Output-Format

`docs/MARKET_READINESS_AUDIT-<Datum>.md` mit:

1. Eine Zeile: `Audit: <Score>/100, <Band>, <die zwei wichtigsten Risiken>`
2. **Blocker** (müssen vor Verkauf gefixt werden)
3. **Hochwertige Fixes** (heben den Score)
4. **Geprüfte Evidenz** (Dateien, Befehle, Outputs)
5. **Fehlende Evidenz** (was Confidence erhöhen würde)
6. **Nächster Schritt** (genau eine konkrete Aktion)
