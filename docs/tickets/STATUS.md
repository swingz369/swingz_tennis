# Status-Übersicht

> Aggregiert aus dem vollständigen Ticket-Set.
> Stand: 2026-06-26 · Gesamt: 85 Tickets

## Verteilung

- **✅ DONE**: 23
- **🔶 PARTIAL**: 12
- **❌ TODO**: 50

## ❌ TODO (50)

- **[1.2.1](q1/1.2.1.md)** _(Q1/1.2 KI-Premium-Sichtbarkeit)_ — ROI-Stat-Berechnung  
  → „`lib/season-planning/analytics.ts` neu erstellen mit Funktion `computeRoiStats(dryRunResult)`; Anzeige in `app/(protected)/admin/seasons/[id]/planning/page.tsx` ergänzen."
- **[1.2.2](q1/1.2.2.md)** _(Q1/1.2 KI-Premium-Sichtbarkeit)_ — Upsell-Modal Premium  
  → „Komponente `components/season-planning/premium-upsell.tsx` neu erstellen; in Planning-Page nach erstem Lock-Step triggern."
- **[1.2.3](q1/1.2.3.md)** _(Q1/1.2 KI-Premium-Sichtbarkeit)_ — Pricing-Page Refresh  
  → „`app/landing/pricing/page.tsx` neu (aktuell nur `app/landing/page.tsx` ohne Pricing-Unterseite)."
- **[1.2.4](q1/1.2.4.md)** _(Q1/1.2 KI-Premium-Sichtbarkeit)_ — Onboarding-Tour KI-Engine  
  → „`components/onboarding-tour/season-planning-tour.tsx` neu erstellen (Verzeichnisstruktur existiert möglicherweise noch nicht)."
- **[1.3.2](q1/1.3.2.md)** _(Q1/1.3 nuLiga-Hardening)_ — Snapshot-Tests gegen HTML-Fixtures  
  → „`tests/unit/nuliga-scraper.test.ts` neu erstellen mit HTML-Fixtures in `tests/fixtures/nuliga/`."
- **[1.3.3](q1/1.3.3.md)** _(Q1/1.3 nuLiga-Hardening)_ — CSV-Import-Fallback (Risiko-Mitigation)  
  → „Beide Dateien neu anlegen (Backend-Route + Admin-UI-Komponente)."
- **[1.4.1](q1/1.4.1.md)** _(Q1/1.4 Quick-Wins)_ — Light/Dark-Mode-Toggle  
  → „`components/layout/theme-toggle.tsx` neu + Provider in `app/layout.tsx`. Hinweis: Brand-Design ist sehr 'dark-first' — Toggle ggf. mit Pricing-Tier koppeln."
- **[1.4.3](q1/1.4.3.md)** _(Q1/1.4 Quick-Wins)_ — Push-Opt-In Modal  
  → „Eigenes Opt-in-Modal (möglicherweise als Erweiterung des vorhandenen `pwa-install-prompt.tsx`)."
- **[1.4.4](q1/1.4.4.md)** _(Q1/1.4 Quick-Wins)_ — Matchmaking-Empty-State Polish  
  → „Inhaltliche Empty-State-Variante im matchmaking-panel.tsx hinzufügen."
- **[2.1.2](q2/2.1.2.md)** _(Q2/2.1 Live-Match-Tracking)_ — POST `/api/matches` Route  
  → „`app/api/matches/route.ts` neu — POST + Validierung, optionaler FK auf `match_results`."
- **[2.1.3](q2/2.1.3.md)** _(Q2/2.1 Live-Match-Tracking)_ — Live-Match-Scoring-UI  
  → „`components/matches/live-score.tsx` neu. Komponente integriert mit `/api/matches` POST."
- **[2.1.4](q2/2.1.4.md)** _(Q2/2.1 Live-Match-Tracking)_ — Match-History GET `/api/matches`  
  → „In gleicher Datei wie 2.1.2 (GET/POST in derselben Route-Datei)."
- **[2.1.5](q2/2.1.5.md)** _(Q2/2.1 Live-Match-Tracking)_ — Match-Completion Push  
  → „Helper `notifyMatchCompleted(match)` im push-notification.service."
- **[2.2.1](q2/2.2.1.md)** _(Q2/2.2 ELO-System)_ — DB-Trigger für ELO-Update  
  → „Migration mit Trigger-Funktion + elo.service.ts mit `updateElo(playerId, opponentId, won)` (pure function)."
- **[2.2.2](q2/2.2.2.md)** _(Q2/2.2 ELO-System)_ — ELO-Anzeige im Member-Profil  
  → „Section in member-profile.tsx ergänzen (Datei existiert)."
- **[2.2.3](q2/2.2.3.md)** _(Q2/2.2 ELO-System)_ — Verbands-LK-Separation  
  → „Zwei separate Cards/Sections im Profil."
- **[2.2.4](q2/2.2.4.md)** _(Q2/2.2 ELO-System)_ — Backing-Test für ELO-Algorithmus  
  → „`tests/unit/lib/elo.test.ts` neu."
- **[2.3.1](q2/2.3.1.md)** _(Q2/2.3 Spieler-Profile v2)_ — Profil-Page Mobile-First Redesign  
  → „Neue Page als Alternative zum bestehenden `app/(protected)/member/profile/page.tsx` (oder vollständig ersetzen)."
- **[2.3.2](q2/2.3.2.md)** _(Q2/2.3 Spieler-Profile v2)_ — Head-to-Head View  
  → „Komponente neu erstellen; Aggregation im Server oder Client."
- **[2.3.3](q2/2.3.3.md)** _(Q2/2.3 Spieler-Profile v2)_ — Saison-Bilanz  
  → „Server-Komponente mit Drizzle-Aggregation."
- **[2.3.4](q2/2.3.4.md)** _(Q2/2.3 Spieler-Profile v2)_ — „Fordern"-Button in Open-Matches-Liste  
  → „Inline-Button in open-matches.tsx ergänzen."
- **[2.4.1](q2/2.4.1.md)** _(Q2/2.4 Capacitor Mobile App)_ — Capacitor-Wrapper initialisieren  
  → „`npx cap init`, capacitor.config.ts generieren, iOS/Android-Targets hinzufügen."
- **[2.4.2](q2/2.4.2.md)** _(Q2/2.4 Capacitor Mobile App)_ — Native Push-Bridge  
  → „Plugin installieren, lib/push-notification.service.ts erweitern."
- **[2.4.3](q2/2.4.3.md)** _(Q2/2.4 Capacitor Mobile App)_ — App-Icons + Splash  
  → „App-Icons generieren (1024×1024 Master + adaptive)."
- **[2.4.4](q2/2.4.4.md)** _(Q2/2.4 Capacitor Mobile App)_ — App Store Listing  
  → „Texte, Screenshots, Pricing einreichen."
- **[2.4.5](q2/2.4.5.md)** _(Q2/2.4 Capacitor Mobile App)_ — Capacitor Build CI  
  → „GitHub-Action definieren."
- **[2.5.1](q2/2.5.1.md)** _(Q2/2.5 Marketing-Wins)_ — Last-Minute-Alerts  
  → „Hook in booking-cancel + lib/push-notification.service."
- **[2.5.2](q2/2.5.2.md)** _(Q2/2.5 Marketing-Wins)_ — Inaktivitäts-Reaktivierung  
  → „Cron-Route + Vercel Cron-Job definieren."
- **[2.5.3](q2/2.5.3.md)** _(Q2/2.5 Marketing-Wins)_ — Newsletter-Wizard  
  → „Wizard-Page + Resend-Integrations-Komponente."
- **[3.1.1](q3/3.1.1.md)** _(Q3/3.1 Smart-Court API)_ — Hardware-Adapter-Interface  
  → „`lib/hardware/adapter.ts` neu erstellen (Plugin-Interface)."
- **[3.1.2](q3/3.1.2.md)** _(Q3/3.1 Smart-Court API)_ — Buchung-zu-Hardware-Webhook  
  → „Webhook-Route + Adapter-Implementierungen."
- **[3.1.3](q3/3.1.3.md)** _(Q3/3.1 Smart-Court API)_ — Smart-Court-Admin-UI  
  → „Admin-Page neu erstellen."
- **[3.1.4](q3/3.1.4.md)** _(Q3/3.1 Smart-Court API)_ — Smart-Court Premium-Pricing  
  → „lib/features.ts Add-On-Feature-Flag + Owner-Billing Page."
- **[3.6.1](q3/3.6.1.md)** _(Q3/3.6 Pricing-Tier-Update)_ — Pay-per-Active-Member-Pricing  
  → „Stripe-Quantity-basiertes Pricing; Webhook-Update."
- **[3.6.2](q3/3.6.2.md)** _(Q3/3.6 Pricing-Tier-Update)_ — Pricing-Page Communication  
  → „`app/landing/pricing/page.tsx` neu (siehe 1.2.3)."
- **[3.6.3](q3/3.6.3.md)** _(Q3/3.6 Pricing-Tier-Update)_ — Owner-Billing-Dashboard Update  
  → „Dashboard-Karte mit Member-Count-Multiplikator."
- **[A4](old-plan/A4.md)** _(Old Plan/A4 DSGVO-Audit)_ — DSGVO-Read-Audit-Trail  
  → „Wie B8 — gemeinsam umsetzen."
- **[B7](cross/B7.md)** _(Cross-Cutting/B7 Decisions)_ — Decisions/Voting Sichtbarkeits-Boost + Demo-Video  
  → „Video auf landing-page ergänzen; UI-Promo-Banner."
- **[B8](cross/B8.md)** _(Cross-Cutting/B8 DSGVO-Audit)_ — DSGVO-Audit-Trail für Lese-PII-Zugriffe (A4)  
  → „`lib/db/audit-logger.ts` neu; Middleware für PII-Routes."
- **[B9](cross/B9.md)** _(Cross-Cutting/B9 Pen-Test)_ — Pen-Test vor Q2-Auslieferung (Live-Tracking)  
  → „Vendor aussuchen + Zeitfenster in Q2."
- **[F1](old-plan/F1.md)** _(Old Plan/F1 DATEV)_ — DATEV-CSV-Export  
  → „Konkrete Datei-Targets fehlen — mit Finanz-Team absprechen."
- **[F10](old-plan/F10.md)** _(Old Plan/F10 Wallet-Pass)_ — Wallet-Pass (Apple/Google)  
  → „Konzept + Library-Auswahl."
- **[F11](old-plan/F11.md)** _(Old Plan/F11 Job-Queue)_ — Echte Job-Queue (BullMQ o.ä.)  
  → „Vendor-Auswahl BullMQ vs Inngest."
- **[F12](old-plan/F12.md)** _(Old Plan/F12 Churn-Prediction)_ — Churn-Prediction  
  → „Konzept erstellen, Q3+."
- **[F2](old-plan/F2.md)** _(Old Plan/F2 Übungsleiterpauschale)_ — Übungsleiterpauschale  
  → „In Fee-Konfiguration (`app/(protected)/admin/settings/`) integrieren."
- **[F4.3](q1/F4.3.md)** _(Q1/F4 Mannschafts-Modul)_ — Heimspiel-Workflow + Bewirtung  
  → „Bewirtungs-Tab-Komponente + Heimspiel-Workflow-Page definieren, Datei-Targets fehlen noch."
- **[F5](old-plan/F5.md)** _(Old Plan/F5 Turnier-Auslosung)_ — Turnier-Auslosung  
  → „Konzept erstellen — Datei-Targets fehlen."
- **[F6.1](q1/F6.1.md)** _(Q1/F6 DSGVO-PII-Anonymisierung)_ — Anonymize-Service skelettieren  
  → „`lib/services/anonymize.service.ts` neu — Voraussetzung für Q2-Epic 2.1."

- **[F6.4](q1/F6.4.md)** _(Q1/F6 DSGVO-PII-Anonymisierung)_ — E2E-Test: User löschen → PII raus, Rechnungen pseudonymisiert  
  → „E2E-Spec schreiben sobald F6.1 existiert."
- **[F8](old-plan/F8.md)** _(Old Plan/F8 SMS/WhatsApp)_ — SMS/WhatsApp-Benachrichtigungen  
  → „Vendor wählen + lib/push-notification erweitern."

## 🔶 PARTIAL (12)

- **[1.0.2](q1/1.0.2.md)** _(Q1/1.0 Service-Client-Audit)_ — Service-Client-Klassifizierung (Auto-Detection + Lint)  
  → „ESLint-Regel-Implementierung verifizieren, ggf. in ESLint-Konfig aktivieren."
- **[1.1.1](q1/1.1.1.md)** _(Q1/1.1 DB-Layer-Unify)_ — `email_queue`-Schema auf Drizzle ergänzen  
  → „`as any` Casts in app/api/email-campaigns/route.ts vollständig entfernen; email-queue.service.ts skelettieren falls noch nicht Drizzle-migriert."
- **[1.1.3](q1/1.1.3.md)** _(Q1/1.1 DB-Layer-Unify)_ — `email_campaigns`-Schema auf Drizzle ergänzen  
  → „Verifizieren, dass INSERT-Pfad Drizzle nutzt (ggf. anstelle von supabase-js)."
- **[1.1.7](q1/1.1.7.md)** _(Q1/1.1 DB-Layer-Unify)_ — `next-intl`-Strategie klären  
  → „Bestehender `i18n/` Ordner existiert — klären ob aktiviert oder zur Löschung ansteht. Bundle-Größe messen."

- **[A3](old-plan/A3.md)** _(Old Plan/A3 nuLiga)_ — nuLiga-Adapter härten (deckt sich mit Epic 1.3)  
  → „Wie Epic 1.3 — CSV-Import und Snapshot-Tests ergänzen."
- **[B1](cross/B1.md)** _(Cross-Cutting/B1 Bundle-Analyzer)_ — Bundle-Analyzer CI-Integration  
  → „GitHub-Action-Snippet für build-with-analyzer."
- **[B2](cross/B2.md)** _(Cross-Cutting/B2 next-intl)_ — `next-intl`-Strategie klären (entfernen ODER aktivieren)  
  → „Wie 1.1.7 — tatsächlich aktivieren oder entfernen."
- **[B5](cross/B5.md)** _(Cross-Cutting/B5 Sentry)_ — Sentry-Coverage Audit + Synthetic Test pro Quartal  
  → „Quartals-Check einrichten."
- **[F9](old-plan/F9.md)** _(Old Plan/F9 LK-Berechnung)_ — LK-Berechnung  
  → „LK-Werte ins `players.lk_rating` schreiben (Migration nötig)."
- **[TICKET-001](roadmap/TICKET-001.md)** _(Roadmap/TICKET-001 Verzugszins-Mahnwesen)_ — Verzugszins-Mahnwesen nach §288 BGB  
  → „Unit-Tests in `tests/unit/lib/billing/verzugszins.test.ts` schreiben + E2E in `e2e/admin-dunning.spec.ts` (Roadmap-MUSS-Kriterien)."
- **[TICKET-002](roadmap/TICKET-002.md)** _(Roadmap/TICKET-002 Beschlussdatenbank)_ — Beschlussdatenbank digital (BGB §§ 32, 33)  
  → „Quorum-Berechnung in `decision.service.ts` ergänzen (backend TODO)."
- **[TICKET-W2-CAST-CLEANUP](roadmap/TICKET-W2-CAST-CLEANUP.md)** _(Roadmap/TICKET-W2 Cast-Cleanup)_ — Wave-2 Cast-Cleanup Complex Routes  
  → „W3 Cast-Cleanup: 5 weitere `as any` in anderen `app/api/leagues/`-Routes (Tickets in `route.ts` + `[id]/route.ts`)."

## ✅ DONE (23)

- **[1.0.1](q1/1.0.1.md)** _(Q1/1.0 Service-Client-Audit)_ — Service-Client-Inventur  
  → „Keine. Optional Refresh nach großen Auth/RLS-Refactors."
- **[1.0.3](q1/1.0.3.md)** _(Q1/1.0 Service-Client-Audit)_ — Policy-Empfehlung pro Route  
  → „Keine. Bei Änderungen an RLS-Policies refreshen."
- **[1.1.2](q1/1.1.2.md)** _(Q1/1.1 DB-Layer-Unify)_ — `groups`-Schema auf Drizzle ergänzen  
  → „Keine — DrizzleGroupRepository in allen Groups-Routes aktiv."
- **[1.1.4](q1/1.1.4.md)** _(Q1/1.1 DB-Layer-Unify)_ — `nuliga-scraper` von supabase-js auf Drizzle migrieren  
  → „Keine — bereits migriert."
- **[1.1.5](q1/1.1.5.md)** _(Q1/1.1 DB-Layer-Unify)_ — AI-Schemas-Migration auf Drizzle  
  → „Keine."
- **[1.1.6](q1/1.1.6.md)** _(Q1/1.1 DB-Layer-Unify)_ — Bundle-Analyzer einführen  
  → „Keine — Analyzer ist konfiguriert; regelmäßig in CI laufen lassen."
- **[1.3.4](q1/1.3.4.md)** _(Q1/1.3 nuLiga-Hardening)_ — Cron-Health-Check Route  
  → „Alert-Logik (3-fail-Schwelle) verifizieren."
- **[1.4.2](q1/1.4.2.md)** _(Q1/1.4 Quick-Wins)_ — PWA-Install-Banner für iOS  
  → „Keine."
- **[2.1.1](q2/2.1.1.md)** _(Q2/2.1 Live-Match-Tracking)_ — DB-Schema `match_results` + `match_sets`  
  → „Keine — match_results-Migration live; Supabase-Block in types/supabase.ts manuell eingetragen (TODO: regenerieren)."
- **[A1](old-plan/A1.md)** _(Old Plan/A1 Rate-Limit)_ — Rate-Limit zentralisieren  
  → „Keine."
- **[A2](old-plan/A2.md)** _(Old Plan/A2 Permissions)_ — Ämterbasierte Permissions (verteilt auf F4.4)  
  → „Keine — siehe F4.4 für Detail."
- **[B3](cross/B3.md)** _(Cross-Cutting/B3 Service-Audit)_ — Service-Client-Audit-Dokumentation  
  → „Keine."
- **[B4](cross/B4.md)** _(Cross-Cutting/B4 Rate-Limit)_ — Rate-Limiting auf Member-API-Routes  
  → „Keine — vermutlich bereits in api-fetch integriert."
- **[B6](cross/B6.md)** _(Cross-Cutting/B6 Roadmap-Review)_ — Quartals-Roadmap-Review  
  → „Keine."
- **[F3](old-plan/F3.md)** _(Old Plan/F3 GoBD)_ — GoBD-Doku  
  → „Keine."
- **[F4.1](q1/F4.1.md)** _(Q1/F4 Mannschafts-Modul)_ — Matchday-Aufstellung API + UI  
  → „Keine — API gerade W2 cast-cleanup."
- **[F4.2](q1/F4.2.md)** _(Q1/F4 Mannschafts-Modul)_ — Matchday-Ergebnis-Erfassung API + UI  
  → „Keine — API gerade W2 cast-cleanup. UI-Komponenten ggf. ergänzen falls noch nicht vorhanden."
- **[F4.4](q1/F4.4.md)** _(Q1/F4 Mannschafts-Modul)_ — Ämterflag „Mannschaftsführer" (A2)  
  → „Keine."
- **[F6.2](q1/F6.2.md)** _(Q1/F6 DSGVO-PII-Anonymisierung)_ — PII-Mapping dokumentieren  
  → „Keine."
- **[1.3.1](q1/1.3.1.md)** _(Q1/1.3 nuLiga-Hardening)_ — Retry-Logik + Layout-Alarm  
  → „Retry-Wrapper (1+3 Versuche, exp. backoff 500/1k/2k/4k, cap 8s) + Sentry.withScope-Layout-Alarm bei leerem Parse. 10/10 Vitest grün (vi.useFakeTimers)."
- **[F6.3](q1/F6.3.md)** _(Q1/F6 DSGVO-PII-Anonymisierung)_ — Audit-Log-Composite-Index  
  → „Migration `20260626_audit_logs_dsgvo_idx.sql` legt `audit_logs_action_resource_type_id_idx` ON (action, resource_type, resource_id) an. Skaliert das F6.1-Idempotenz-Query von BitmapAnd+SequentialScan auf Index-only-Scan. LEFTMOST-PREFIX: column order matches WHERE-clause in anonymize.service.ts. Drizzle-Schema-Callback nachgezogen für künftige `drizzle-kit generate` Alignments."
- **[F7](old-plan/F7.md)** _(Old Plan/F7 Drizzle-Schema-Drift)_ — Drizzle-Schema-Drift (deckt sich mit Epic 1.1)  
  → „Keine — regelmäßig in CI laufen lassen."
- **[TICKET-003](roadmap/TICKET-003.md)** _(Roadmap/TICKET-003 Medenspiel-CSV)_ — Medenspiel-CSV-Export für Verbände  
  → „Keine — Backend + Unit-Tests grün. Nice-to-have: BTV/WTV/HTV-Adapter."
