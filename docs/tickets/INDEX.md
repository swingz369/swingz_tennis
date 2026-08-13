# Ticket-Tracking Index

> ⚠️ **Eingefroren (Stand Juni 2026) — nicht mehr gepflegt.** Dieses Ticket-System bildet den
> Ist-Zustand nicht mehr ab und `INDEX.md`/`STATUS.md` widersprechen sich gegenseitig. Die
> aktuelle, konsolidierte Übersicht offener Punkte liegt in [`docs/OPEN_ITEMS.md`](../OPEN_ITEMS.md).
> Diese Dateien nur noch als historisches Inventar lesen.

> Quelle: [`docs/UMSETZUNGSPLAN_PROJEKTANALYSE.md`](../UMSETZUNGSPLAN_PROJEKTANALYSE.md) + [`docs/roadmap/IMPLEMENTATION_TICKETS_Q3_2026.md`](../roadmap/IMPLEMENTATION_TICKETS_Q3_2026.md)  
> Stand: 2026-06-26 · Gesamt: 85 Tickets  
> Status-Legende: ✅ DONE · 🔶 PARTIAL · ❌ TODO · 📅 PLANNED

## Cross-Cutting (9 Tickets)

- 🔶 **[B1](cross/B1.md)** — Bundle-Analyzer CI-Integration
- 🔶 **[B2](cross/B2.md)** — `next-intl`-Strategie klären (entfernen ODER aktivieren)
- ✅ **[B3](cross/B3.md)** — Service-Client-Audit-Dokumentation
- ✅ **[B4](cross/B4.md)** — Rate-Limiting auf Member-API-Routes
- 🔶 **[B5](cross/B5.md)** — Sentry-Coverage Audit + Synthetic Test pro Quartal
- ✅ **[B6](cross/B6.md)** — Quartals-Roadmap-Review
- ❌ **[B7](cross/B7.md)** — Decisions/Voting Sichtbarkeits-Boost + Demo-Video
- ❌ **[B8](cross/B8.md)** — DSGVO-Audit-Trail für Lese-PII-Zugriffe (A4)
- ❌ **[B9](cross/B9.md)** — Pen-Test vor Q2-Auslieferung (Live-Tracking)

## Old Plan (14 Tickets)

- ✅ **[A1](old-plan/A1.md)** — Rate-Limit zentralisieren
- ✅ **[A2](old-plan/A2.md)** — Ämterbasierte Permissions (verteilt auf F4.4)
- 🔶 **[A3](old-plan/A3.md)** — nuLiga-Adapter härten (deckt sich mit Epic 1.3)
- ❌ **[A4](old-plan/A4.md)** — DSGVO-Read-Audit-Trail
- ❌ **[F1](old-plan/F1.md)** — DATEV-CSV-Export
- ❌ **[F10](old-plan/F10.md)** — Wallet-Pass (Apple/Google)
- ❌ **[F11](old-plan/F11.md)** — Echte Job-Queue (BullMQ o.ä.)
- ❌ **[F12](old-plan/F12.md)** — Churn-Prediction
- ❌ **[F2](old-plan/F2.md)** — Übungsleiterpauschale
- ✅ **[F3](old-plan/F3.md)** — GoBD-Doku
- ❌ **[F5](old-plan/F5.md)** — Turnier-Auslosung
- ✅ **[F7](old-plan/F7.md)** — Drizzle-Schema-Drift (deckt sich mit Epic 1.1)
- ❌ **[F8](old-plan/F8.md)** — SMS/WhatsApp-Benachrichtigungen
- 🔶 **[F9](old-plan/F9.md)** — LK-Berechnung

## Q1 (30 Tickets)

- ✅ **[1.0.1](q1/1.0.1.md)** — Service-Client-Inventur
- 🔶 **[1.0.2](q1/1.0.2.md)** — Service-Client-Klassifizierung (Auto-Detection + Lint)
- ✅ **[1.0.3](q1/1.0.3.md)** — Policy-Empfehlung pro Route
- 🔶 **[1.1.1](q1/1.1.1.md)** — `email_queue`-Schema auf Drizzle ergänzen
- ✅ **[1.1.2](q1/1.1.2.md)** — `groups`-Schema auf Drizzle ergänzen
- 🔶 **[1.1.3](q1/1.1.3.md)** — `email_campaigns`-Schema auf Drizzle ergänzen
- ✅ **[1.1.4](q1/1.1.4.md)** — `nuliga-scraper` von supabase-js auf Drizzle migrieren
- ✅ **[1.1.5](q1/1.1.5.md)** — AI-Schemas-Migration auf Drizzle
- ✅ **[1.1.6](q1/1.1.6.md)** — Bundle-Analyzer einführen
- 🔶 **[1.1.7](q1/1.1.7.md)** — `next-intl`-Strategie klären
- ❌ **[1.2.1](q1/1.2.1.md)** — ROI-Stat-Berechnung
- ❌ **[1.2.2](q1/1.2.2.md)** — Upsell-Modal Premium
- ❌ **[1.2.3](q1/1.2.3.md)** — Pricing-Page Refresh
- ❌ **[1.2.4](q1/1.2.4.md)** — Onboarding-Tour KI-Engine
- 🔶 **[1.3.1](q1/1.3.1.md)** — Retry-Logik + Layout-Alarm
- ❌ **[1.3.2](q1/1.3.2.md)** — Snapshot-Tests gegen HTML-Fixtures
- ❌ **[1.3.3](q1/1.3.3.md)** — CSV-Import-Fallback (Risiko-Mitigation)
- ✅ **[1.3.4](q1/1.3.4.md)** — Cron-Health-Check Route
- ❌ **[1.4.1](q1/1.4.1.md)** — Light/Dark-Mode-Toggle
- ✅ **[1.4.2](q1/1.4.2.md)** — PWA-Install-Banner für iOS
- ❌ **[1.4.3](q1/1.4.3.md)** — Push-Opt-In Modal
- ❌ **[1.4.4](q1/1.4.4.md)** — Matchmaking-Empty-State Polish
- ✅ **[F4.1](q1/F4.1.md)** — Matchday-Aufstellung API + UI
- ✅ **[F4.2](q1/F4.2.md)** — Matchday-Ergebnis-Erfassung API + UI
- ❌ **[F4.3](q1/F4.3.md)** — Heimspiel-Workflow + Bewirtung
- ✅ **[F4.4](q1/F4.4.md)** — Ämterflag „Mannschaftsführer" (A2)
- ❌ **[F6.1](q1/F6.1.md)** — Anonymize-Service skelettieren
- ✅ **[F6.2](q1/F6.2.md)** — PII-Mapping dokumentieren
- ❌ **[F6.3](q1/F6.3.md)** — Audit-Eintrag bei Anonymisierung
- ❌ **[F6.4](q1/F6.4.md)** — E2E-Test: User löschen → PII raus, Rechnungen pseudonymisiert

## Q2 (21 Tickets)

- ✅ **[2.1.1](q2/2.1.1.md)** — DB-Schema `match_results` + `match_sets`
- ❌ **[2.1.2](q2/2.1.2.md)** — POST `/api/matches` Route
- ❌ **[2.1.3](q2/2.1.3.md)** — Live-Match-Scoring-UI
- ❌ **[2.1.4](q2/2.1.4.md)** — Match-History GET `/api/matches`
- ❌ **[2.1.5](q2/2.1.5.md)** — Match-Completion Push
- ❌ **[2.2.1](q2/2.2.1.md)** — DB-Trigger für ELO-Update
- ❌ **[2.2.2](q2/2.2.2.md)** — ELO-Anzeige im Member-Profil
- ❌ **[2.2.3](q2/2.2.3.md)** — Verbands-LK-Separation
- ❌ **[2.2.4](q2/2.2.4.md)** — Backing-Test für ELO-Algorithmus
- ❌ **[2.3.1](q2/2.3.1.md)** — Profil-Page Mobile-First Redesign
- ❌ **[2.3.2](q2/2.3.2.md)** — Head-to-Head View
- ❌ **[2.3.3](q2/2.3.3.md)** — Saison-Bilanz
- ❌ **[2.3.4](q2/2.3.4.md)** — „Fordern"-Button in Open-Matches-Liste
- ❌ **[2.4.1](q2/2.4.1.md)** — Capacitor-Wrapper initialisieren
- ❌ **[2.4.2](q2/2.4.2.md)** — Native Push-Bridge
- ❌ **[2.4.3](q2/2.4.3.md)** — App-Icons + Splash
- ❌ **[2.4.4](q2/2.4.4.md)** — App Store Listing
- ❌ **[2.4.5](q2/2.4.5.md)** — Capacitor Build CI
- ❌ **[2.5.1](q2/2.5.1.md)** — Last-Minute-Alerts
- ❌ **[2.5.2](q2/2.5.2.md)** — Inaktivitäts-Reaktivierung
- ❌ **[2.5.3](q2/2.5.3.md)** — Newsletter-Wizard

## Q3 (7 Tickets)

- ❌ **[3.1.1](q3/3.1.1.md)** — Hardware-Adapter-Interface
- ❌ **[3.1.2](q3/3.1.2.md)** — Buchung-zu-Hardware-Webhook
- ❌ **[3.1.3](q3/3.1.3.md)** — Smart-Court-Admin-UI
- ❌ **[3.1.4](q3/3.1.4.md)** — Smart-Court Premium-Pricing
- ❌ **[3.6.1](q3/3.6.1.md)** — Pay-per-Active-Member-Pricing
- ❌ **[3.6.2](q3/3.6.2.md)** — Pricing-Page Communication
- ❌ **[3.6.3](q3/3.6.3.md)** — Owner-Billing-Dashboard Update

## Roadmap (4 Tickets)

- 🔶 **[TICKET-001](roadmap/TICKET-001.md)** — Verzugszins-Mahnwesen nach §288 BGB
- 🔶 **[TICKET-002](roadmap/TICKET-002.md)** — Beschlussdatenbank digital (BGB §§ 32, 33)
- ✅ **[TICKET-003](roadmap/TICKET-003.md)** — Medenspiel-CSV-Export für Verbände
- 🔶 **[TICKET-W2-CAST-CLEANUP](roadmap/TICKET-W2-CAST-CLEANUP.md)** — Wave-2 Cast-Cleanup Complex Routes
- ❌ **[TICKET-billing-tables-rls-scoping](roadmap/TICKET-billing-tables-rls-scoping.md)** — Abrechnungstabellen: Superadmin-Scoping + auth.uid()-Bug
- ❌ **[TICKET-mandatory-subscription-onboarding](roadmap/TICKET-mandatory-subscription-onboarding.md)** — Abo zur Voraussetzung machen statt Freemium-Default (Trial/Grace-Period/Bestandskonten klären)
