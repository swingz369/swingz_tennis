#!/usr/bin/env python3
"""
generate-tickets.py

Erzeugt pro Ticket aus
  - docs/UMSETZUNGSPLAN_PROJEKTANALYSE.md
  - docs/roadmap/IMPLEMENTATION_TICKETS_Q3_2026.md
eine Tracking-Markdown-Datei unter docs/tickets/{quarter}/{id}.md.

Zusätzlich:
  - docs/tickets/INDEX.md   (alphabetisch + nach Quartal gruppiert)
  - docs/tickets/STATUS.md  (Status-Übersicht, nach Status sortiert)

Aufruf: python3 scripts/generate-tickets.py
"""
from __future__ import annotations
import os
import sys
from pathlib import Path
from collections import defaultdict
from datetime import date

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "tickets"
TODAY = date.today().isoformat()

STATUS_ICON = {"DONE": "✅", "PARTIAL": "🔶", "TODO": "❌", "PLANNED": "📅"}
FILE_ICON = {"OK": "✓", "MISS": "✗", "PARTIAL": "⚠"}

# ═══ Schemas ═══
# Quarters: "q1" / "q2" / "q3" / "cross" / "old" / "roadmap" (Bucket für alte/alte Tickets)
#
# Pro Ticket:
#   id          string  (z.B. "1.0.1", "F4.3", "B5", "TICKET-001")
#   title       string
#   status      "DONE" | "PARTIAL" | "TODO" | "PLANNED"
#   epic        string  (z.B. "1.0 Service-Client-Audit")
#   quarter     string  ("Q1" / "Q2" / "Q3" / "Cross-Cutting" / "Old Plan" / "Roadmap")
#   aufwand     string  (z.B. "6 h")
#   ziel        string  (Wert-Versprechen in 1 Satz)
#   files       list[(file_path, status)]
#   criteria    list[str]
#   deps        list[str]  (Ticket-IDs die VORHER fertig sein müssen)
#   next_action string  (was als nächstes zu tun ist, ggf. mit Owner-Hinweis)
#   oos         list[str]  (optional, Out-of-Scope)

TICKETS: list[dict] = []


def t(d: dict) -> None:
    TICKETS.append(d)


# ──────────────────────────────────────────────────────────────────────────────
# Q1
# ──────────────────────────────────────────────────────────────────────────────

# Epic 1.0 — Service-Client-Audit
t(dict(id="1.0.1", title="Service-Client-Inventur", status="DONE",
       quarter="Q1", epic="1.0 Service-Client-Audit", aufwand="6 h",
       ziel="Vollständige Liste aller `createServiceClient`-Aufrufe in app/api/** und lib/services/** mit Sicherheits-Klassifikation.",
       files=[("docs/supabase-rls-audit.md", "OK")],
       criteria=[
           "Markdown-Report existiert mit Route-Liste, RLS-Bypass-Reason und Sicherheits-Klasse",
           "Empfehlung pro Route dokumentiert",
       ],
       deps=[],
       next_action="Keine. Optional Refresh nach großen Auth/RLS-Refactors."))

t(dict(id="1.0.2", title="Service-Client-Klassifizierung (Auto-Detection + Lint)",
       status="PARTIAL", quarter="Q1", epic="1.0 Service-Client-Audit", aufwand="4 h",
       ziel="Auto-Detection der Service-Client-Aufrufe + ESLint-Hinweis bei HIGH-Risk Routen.",
       files=[("lib/supabase/audit.ts", "OK")],
       criteria=[
           "Helper `AUDIT_RISK_CATEGORIES` in lib/supabase/audit.ts vorhanden",
           "ESLint-Regel warnt bei HIGH-Risk Routes",
           "CI-Build bricht NICHT",
       ],
       deps=["1.0.1"],
       next_action="ESLint-Regel-Implementierung verifizieren, ggf. in ESLint-Konfig aktivieren."))

t(dict(id="1.0.3", title="Policy-Empfehlung pro Route", status="DONE",
       quarter="Q1", epic="1.0 Service-Client-Audit", aufwand="4 h",
       ziel="Policy-Empfehlung pro Route in `docs/supabase-rls-audit.md`.",
       files=[("docs/supabase-rls-audit.md", "OK")],
       criteria=[
           "Empfehlungen-Sektion pro Route vorhanden",
           "Mit Sicherheits-Level A/B/C klassifiziert",
       ],
       deps=["1.0.1"],
       next_action="Keine. Bei Änderungen an RLS-Policies refreshen."))

# Epic 1.1 — DB-Layer-Unify (Drizzle als Single-Source-of-Truth)
t(dict(id="1.1.1", title="`email_queue`-Schema auf Drizzle ergänzen", status="PARTIAL",
       quarter="Q1", epic="1.1 DB-Layer-Unify", aufwand="4 h",
       ziel="Drizzle-PgTable für `email_queue`, INSERT-Migration überführt.",
       files=[("src/infrastructure/persistence/schema.ts", "OK"),
              ("app/api/email-campaigns/route.ts", "OK"),
              ("lib/services/email-queue.service.ts", "MISS")],
       criteria=[
           "`grep 'as any' app/api/email-campaigns` → 0",
           "`tsc --noEmit` grün",
       ],
       deps=["1.0.1"],
       next_action="`as any` Casts in app/api/email-campaigns/route.ts vollständig entfernen; email-queue.service.ts skelettieren falls noch nicht Drizzle-migriert."))

t(dict(id="1.1.2", title="`groups`-Schema auf Drizzle ergänzen", status="DONE",
       quarter="Q1", epic="1.1 DB-Layer-Unify", aufwand="4 h",
       ziel="Drizzle-PgTable für `groups`, alle Gruppen-Routes nutzen `DrizzleGroupRepository`.",
       files=[("src/infrastructure/persistence/schema.ts", "OK"),
              ("app/api/groups/route.ts", "OK"),
              ("app/api/groups/[id]/route.ts", "OK"),
              ("app/api/groups/[id]/members/route.ts", "OK"),
              ("app/api/groups/[id]/members/[memberId]/route.ts", "OK")],
       criteria=[
           "`grep 'as any' app/api/groups/**/*.ts` → 0",
           "`tsc --noEmit` grün",
       ],
       deps=["1.0.1"],
       next_action="Keine — DrizzleGroupRepository in allen Groups-Routes aktiv."))

t(dict(id="1.1.3", title="`email_campaigns`-Schema auf Drizzle ergänzen", status="PARTIAL",
       quarter="Q1", epic="1.1 DB-Layer-Unify", aufwand="4 h",
       ziel="Drizzle-PgTable für `email_campaigns` + INSERT-migration.",
       files=[("app/api/email-campaigns/route.ts", "OK"),
              ("src/infrastructure/persistence/schema.ts", "OK")],
       criteria=[
           "`grep 'as any' app/api/email-campaigns` → 0",
           "`tsc --noEmit` grün",
       ],
       deps=["1.1.1"],
       next_action="Verifizieren, dass INSERT-Pfad Drizzle nutzt (ggf. anstelle von supabase-js)."))

t(dict(id="1.1.4", title="`nuliga-scraper` von supabase-js auf Drizzle migrieren",
       status="DONE", quarter="Q1", epic="1.1 DB-Layer-Unify", aufwand="8 h",
       ziel="5 Calls in `lib/services/nuliga-scraper.ts` umgestellt; Types bleiben.",
       files=[("lib/services/nuliga-scraper.ts", "OK")],
       criteria=[
           "Alle nuLiga-Aufrufe nutzen `db` (Drizzle)",
           "Bestehende Scraper-Tests grün",
       ],
       deps=["1.1.2"],
       next_action="Keine — bereits migriert."))

t(dict(id="1.1.5", title="AI-Schemas-Migration auf Drizzle", status="DONE",
       quarter="Q1", epic="1.1 DB-Layer-Unify", aufwand="8 h",
       ziel="`auto-planning.service.ts` und `schedule-generator-v2.ts` auf Drizzle.",
       files=[("lib/services/auto-planning.service.ts", "OK"),
              ("lib/ai/schedule-generator-v2.ts", "OK")],
       criteria=[
           "Beide Services nutzen `db` (Drizzle)",
           "`tsc --noEmit` grün",
       ],
       deps=["1.1.2"],
       next_action="Keine."))

t(dict(id="1.1.6", title="Bundle-Analyzer einführen", status="DONE",
       quarter="Q1", epic="1.1 DB-Layer-Unify", aufwand="2 h",
       ziel="@next/bundle-analyzer mit `ANALYZE=true` ENV-Flag.",
       files=[("next.config.js", "OK")],
       criteria=[
           "`ANALYZE=true npm run build` startet Analyzer",
       ],
       deps=[],
       next_action="Keine — Analyzer ist konfiguriert; regelmäßig in CI laufen lassen."))

t(dict(id="1.1.7", title="`next-intl`-Strategie klären", status="PARTIAL",
       quarter="Q1", epic="1.1 DB-Layer-Unify", aufwand="4 h",
       ziel="Entscheidung: rauswerfen (DACH-only) ODER aktivieren mit t()-Hooks.",
       files=[("i18n/", "OK")],
       criteria=[
           "Bundle-Größe gemessen",
           "Entscheidung im Changelog dokumentiert",
       ],
       deps=[],
       next_action="Bestehender `i18n/` Ordner existiert — klären ob aktiviert oder zur Löschung ansteht. Bundle-Größe messen."))

# Epic 1.2 — KI-Premium-Sichtbarkeit
t(dict(id="1.2.1", title="ROI-Stat-Berechnung", status="TODO",
       quarter="Q1", epic="1.2 KI-Premium-Sichtbarkeit", aufwand="12 h",
       ziel="Nach `runDryRun()`: „X Konflikte gelöst · Y Trainerstunden optimiert · Z Mitglieder glücklicher gemacht\".",
       files=[("lib/season-planning/analytics.ts", "MISS")],
       criteria=[
           "Stat zeigt für jede geplante Saison",
           "UI rendert die Stats in der Planning-Page",
       ],
       deps=["1.1.5"],
       next_action="`lib/season-planning/analytics.ts` neu erstellen mit Funktion `computeRoiStats(dryRunResult)`; Anzeige in `app/(protected)/admin/seasons/[id]/planning/page.tsx` ergänzen."))

t(dict(id="1.2.2", title="Upsell-Modal Premium", status="TODO",
       quarter="Q1", epic="1.2 KI-Premium-Sichtbarkeit", aufwand="8 h",
       ziel="Modal nach erstem Lock-Step („Mit KI-Plan sparst du ~X Std\") für Starter-Tier.",
       files=[("components/season-planning/premium-upsell.tsx", "MISS")],
       criteria=[
           "Modal sichtbar für Starter-Tier-Nutzer",
           "Mit Pricing-CTA verlinkt",
       ],
       deps=["1.2.1"],
       next_action="Komponente `components/season-planning/premium-upsell.tsx` neu erstellen; in Planning-Page nach erstem Lock-Step triggern."))

t(dict(id="1.2.3", title="Pricing-Page Refresh", status="TODO",
       quarter="Q1", epic="1.2 KI-Premium-Sichtbarkeit", aufwand="12 h",
       ziel="Klares Feature-Vergleich; „KI-Sportwart\"-Hero.",
       files=[("app/landing/pricing/page.tsx", "MISS")],
       criteria=[
           "Hero mit KI-Sportwart-USP",
           "Vergleichs-Tabelle Starter/Pro",
       ],
       deps=["1.2.2"],
       next_action="`app/landing/pricing/page.tsx` neu (aktuell nur `app/landing/page.tsx` ohne Pricing-Unterseite)."))

t(dict(id="1.2.4", title="Onboarding-Tour KI-Engine", status="TODO",
       quarter="Q1", epic="1.2 KI-Premium-Sichtbarkeit", aufwand="8 h",
       ziel="3-Step-Tour für erste Saisonplanung.",
       files=[("components/onboarding-tour/season-planning-tour.tsx", "MISS")],
       criteria=[
           "Tooltip-Chain funktioniert auf der Planning-Page",
       ],
       deps=["1.2.1"],
       next_action="`components/onboarding-tour/season-planning-tour.tsx` neu erstellen (Verzeichnisstruktur existiert möglicherweise noch nicht)."))

# Epic 1.3 — nuLiga-Hardening
t(dict(id="1.3.1", title="Retry-Logik + Layout-Alarm", status="PARTIAL",
       quarter="Q1", epic="1.3 nuLiga-Hardening", aufwand="8 h",
       ziel="3 Retries mit exponential backoff, Sentry-Capture bei leerem Parse.",
       files=[("lib/services/nuliga-scraper.ts", "OK"),
              ("app/api/cron/nuliga-sync/route.ts", "OK")],
       criteria=[
           "Retry-Hook im Scraper mit exponential backoff (>=3 Versuche)",
           "Sentry-Capture wird bei Parse-Fehler getriggert",
       ],
       deps=["1.1.4"],
       next_action="Retry-Logik im Scraper verifizieren + ggf. erweitern. Sentry-Capture sicherstellen (Cron-Route hat die verdrahtet)."))

t(dict(id="1.3.2", title="Snapshot-Tests gegen HTML-Fixtures", status="TODO",
       quarter="Q1", epic="1.3 nuLiga-Hardening", aufwand="8 h",
       ziel="2-3 gespeicherte HTML-Fixtures parsen, Standings assertieren.",
       files=[("tests/unit/nuliga-scraper.test.ts", "MISS")],
       criteria=[
           "Tests grün",
           "2-3 Fixtures existieren",
       ],
       deps=["1.3.1"],
       next_action="`tests/unit/nuliga-scraper.test.ts` neu erstellen mit HTML-Fixtures in `tests/fixtures/nuliga/`."))

t(dict(id="1.3.3", title="CSV-Import-Fallback (Risiko-Mitigation)",
       status="TODO", quarter="Q1", epic="1.3 nuLiga-Hardening", aufwand="16 h",
       ziel="Admin kann nuLiga-CSV hochladen, Parser füllt DB.",
       files=[("app/api/admin/nuliga/import/route.ts", "MISS"),
              ("components/admin/nuliga-import.tsx", "MISS")],
       criteria=[
           "Endpoint + UI für CSV-Upload",
           "Krisenfall-Pfad dokumentiert",
       ],
       deps=["1.3.1"],
       next_action="Beide Dateien neu anlegen (Backend-Route + Admin-UI-Komponente)."))

t(dict(id="1.3.4", title="Cron-Health-Check Route", status="DONE",
       quarter="Q1", epic="1.3 nuLiga-Hardening", aufwand="4 h",
       ziel="Heartbeat + Sentry-Monitor, Slack/Email-Alert bei 3 fehlgeschlagenen Versuchen.",
       files=[("app/api/cron/nuliga-sync/route.ts", "OK")],
       criteria=[
           "Heartbeat-Route vorhanden",
           "Sentry-Monitor verifiziert",
           "Alert-Logik bei 3 Fehlversuchen",
       ],
       deps=["1.3.1"],
       next_action="Alert-Logik (3-fail-Schwelle) verifizieren."))

# Epic 1.4 — Quick-Wins
t(dict(id="1.4.1", title="Light/Dark-Mode-Toggle", status="TODO",
       quarter="Q1", epic="1.4 Quick-Wins", aufwand="8 h",
       ziel="System-Preference + manuelle Override, persist via localStorage.",
       files=[("components/layout/theme-toggle.tsx", "MISS")],
       criteria=[
           "Toggle sichtbar",
           "Beide Themes visuell geprüft",
       ],
       deps=[],
       next_action="`components/layout/theme-toggle.tsx` neu + Provider in `app/layout.tsx`. Hinweis: Brand-Design ist sehr 'dark-first' — Toggle ggf. mit Pricing-Tier koppeln."))

t(dict(id="1.4.2", title="PWA-Install-Banner für iOS", status="DONE",
       quarter="Q1", epic="1.4 Quick-Wins", aufwand="8 h",
       ziel="Inline-Banner mit iOS-Safari-Teilen-Schritt.",
       files=[("components/pwa-install-prompt.tsx", "OK")],
       criteria=[
           "Banner erscheint auf iOS-Safari",
           "1-Click-Flow auf Android",
       ],
       deps=[],
       next_action="Keine."))

t(dict(id="1.4.3", title="Push-Opt-In Modal", status="TODO",
       quarter="Q1", epic="1.4 Quick-Wins", aufwand="4 h",
       ziel="Onboarding-Zeitpunkt statt ungefragt.",
       files=[("components/pwa-install-prompt.tsx", "OK")],
       criteria=[
           "Opt-in-Modal erscheint nach Onboarding",
           "Opt-In-Rate messbar",
       ],
       deps=["1.4.2"],
       next_action="Eigenes Opt-in-Modal (möglicherweise als Erweiterung des vorhandenen `pwa-install-prompt.tsx`)."))

t(dict(id="1.4.4", title="Matchmaking-Empty-State Polish", status="TODO",
       quarter="Q1", epic="1.4 Quick-Wins", aufwand="2 h",
       ziel="Bei 0 Kandidaten freundlicher Hinweis statt Still-Schweigen.",
       files=[("components/ai/matchmaking-panel.tsx", "OK")],
       criteria=[
           "Empty-State mit Niveau-Aufforderung",
       ],
       deps=[],
       next_action="Inhaltliche Empty-State-Variante im matchmaking-panel.tsx hinzufügen."))

# F4 — Mannschafts-Modul
t(dict(id="F4.1", title="Matchday-Aufstellung API + UI", status="DONE",
       quarter="Q1", epic="F4 Mannschafts-Modul", aufwand="30 h",
       ziel="Aufstellungs-API und UI für Trainer/Mannschaftsführer.",
       files=[("app/api/leagues/[id]/matchdays/[matchdayId]/lineup/route.ts", "OK")],
       criteria=[
           "POST validiert Zod-Schema",
           "GET liefert aktuelle Aufstellung",
           "UI vorhanden",
       ],
       deps=["F4.4"],
       next_action="Keine — API gerade W2 cast-cleanup."))

t(dict(id="F4.2", title="Matchday-Ergebnis-Erfassung API + UI", status="DONE",
       quarter="Q1", epic="F4 Mannschafts-Modul", aufwand="30 h",
       ziel="Ergebnis-Erfassung inkl. auto-aggregiertem Spieltags-Score.",
       files=[("app/api/leagues/[id]/matchdays/[matchdayId]/result/route.ts", "OK")],
       criteria=[
           "PATCH validiert Zod-Schema und aktualisiert match_days automatisch",
           "GET liefert alle Positions-Ergebnisse",
       ],
       deps=["F4.4"],
       next_action="Keine — API gerade W2 cast-cleanup. UI-Komponenten ggf. ergänzen falls noch nicht vorhanden."))

t(dict(id="F4.3", title="Heimspiel-Workflow + Bewirtung", status="TODO",
       quarter="Q1", epic="F4 Mannschafts-Modul", aufwand="20 h",
       ziel="Heimspiel-Planung mit Bewirtungs-Tab/UI.",
       files=[],
       criteria=[
           "UI für Heimspiel-Planung",
           "Bewirtungs-Tab funktional",
       ],
       deps=["F4.1", "F4.2"],
       next_action="Bewirtungs-Tab-Komponente + Heimspiel-Workflow-Page definieren, Datei-Targets fehlen noch."))

t(dict(id="F4.4", title="Ämterflag „Mannschaftsführer\" (A2)", status="DONE",
       quarter="Q1", epic="F4 Mannschafts-Modul", aufwand="16 h",
       ziel="Office-Flag-System mit `verifyOffice('mannschaftsfuehrer')` + Sanitizer.",
       files=[("lib/api-auth.ts", "OK"),
              ("lib/auth-common.ts", "OK"),
              ("app/api/admin/members/[id]/office-flags/route.ts", "OK"),
              ("tests/unit/lib/auth-common.test.ts", "OK")],
       criteria=[
           "`verifyOffice` deckt alle Ämter ab",
           "Patch-Route sanitized Office-Flags",
           "Unit-Tests grün",
       ],
       deps=[],
       next_action="Keine."))

# F6 — DSGVO-PII-Anonymisierung
t(dict(id="F6.1", title="Anonymize-Service skelettieren", status="TODO",
       quarter="Q1", epic="F6 DSGVO-PII-Anonymisierung", aufwand="8 h",
       ziel="Service, der User-Löschung PII-Anonymisierung durchführt.",
       files=[("lib/services/anonymize.service.ts", "MISS")],
       criteria=[
           "Service existiert mit `anonymizeUser(userId)` API",
           "Rechnungen werden pseudonymisiert (handelsrechtliche Aufbewahrungsfrist)",
       ],
       deps=[],
       next_action="`lib/services/anonymize.service.ts` neu — Voraussetzung für Q2-Epic 2.1."))

t(dict(id="F6.2", title="PII-Mapping dokumentieren", status="DONE",
       quarter="Q1", epic="F6 DSGVO-PII-Anonymisierung", aufwand="4 h",
       ziel="`docs/dsgvo-pii-mapping.md` mit Tabellen-/Spalten-Mapping.",
       files=[("docs/dsgvo-pii-mapping.md", "OK")],
       criteria=[
           "Mapping-Tabelle vorhanden",
           "Mit Anonymisierungs-Strategie pro Spalte",
       ],
       deps=[],
       next_action="Keine."))

t(dict(id="F6.3", title="Audit-Eintrag bei Anonymisierung", status="TODO",
       quarter="Q1", epic="F6 DSGVO-PII-Anonymisierung", aufwand="4 h",
       ziel="Bei jeder Anonymisierung wird `audit_logs` Eintrag geschrieben.",
       files=[("lib/services/anonymize.service.ts", "MISS")],
       criteria=[
           "Audit-Eintrag in `anonymizeUser()`",
           "Action-Tag `gdpr_anonymize`",
       ],
       deps=["F6.1"],
       next_action="Im Rahmen von F6.1 mit-umsetzen."))

t(dict(id="F6.4", title="E2E-Test: User löschen → PII raus, Rechnungen pseudonymisiert",
       status="TODO", quarter="Q1", epic="F6 DSGVO-PII-Anonymisierung", aufwand="8 h",
       ziel="E2E-Test der die User-Lösch-Pipeline verifiziert.",
       files=[("e2e/dsgvo-anonymize.spec.ts", "MISS")],
       criteria=[
           "E2E grün",
           "Assertions für PII-Freiheit + pseudonymisierte Rechnungen",
       ],
       deps=["F6.1", "F6.3"],
       next_action="E2E-Spec schreiben sobald F6.1 existiert."))

# ──────────────────────────────────────────────────────────────────────────────
# Q2
# ──────────────────────────────────────────────────────────────────────────────

# Epic 2.1 — Live-Match-Tracking
t(dict(id="2.1.1", title="DB-Schema `match_results` + `match_sets`", status="DONE",
       quarter="Q2", epic="2.1 Live-Match-Tracking", aufwand="12 h",
       ziel="Migration erweitert match_results-Schema; Drizzle-Schema-Erweiterung.",
       files=[("supabase/migrations/20260624_match_results.sql", "OK"),
              ("types/supabase.ts", "OK")],
       criteria=[
           "`tsc` grün",
           "RLS-Policy pro Rolle (member/admin)",
           "Migration idempotent (production-tested)",
       ],
       deps=["F6.1"],
       next_action="Keine — match_results-Migration live; Supabase-Block in types/supabase.ts manuell eingetragen (TODO: regenerieren)."))

t(dict(id="2.1.2", title="POST `/api/matches` Route", status="TODO",
       quarter="Q2", epic="2.1 Live-Match-Tracking", aufwand="12 h",
       ziel="Create-Match-Route mit Validation, winner aus score_sets abgeleitet, optional `league_match_id` reference.",
       files=[("app/api/matches/route.ts", "MISS")],
       criteria=[
           "E2E-Test: Score 6:4 7:5 → winner=right",
       ],
       deps=["2.1.1"],
       next_action="`app/api/matches/route.ts` neu — POST + Validierung, optionaler FK auf `match_results`."))

t(dict(id="2.1.3", title="Live-Match-Scoring-UI", status="TODO",
       quarter="Q2", epic="2.1 Live-Match-Tracking", aufwand="40 h",
       ziel="PWA-fähig am Platz: 2 Spieler auswählen → Sets tippen → Bestätigen, offline-queue.",
       files=[("components/matches/live-score.tsx", "MISS")],
       criteria=[
           "Funktioniert auf Mobile (touch-friendly)",
           "Offline-Queue mit Background-Sync",
       ],
       deps=["2.1.2"],
       next_action="`components/matches/live-score.tsx` neu. Komponente integriert mit `/api/matches` POST."))

t(dict(id="2.1.4", title="Match-History GET `/api/matches`", status="TODO",
       quarter="Q2", epic="2.1 Live-Match-Tracking", aufwand="8 h",
       ziel="List mit Filter pro Spieler + Pagination.",
       files=[("app/api/matches/route.ts", "MISS")],
       criteria=[
           "E2E grün",
       ],
       deps=["2.1.2"],
       next_action="In gleicher Datei wie 2.1.2 (GET/POST in derselben Route-Datei)."))

t(dict(id="2.1.5", title="Match-Completion Push", status="TODO",
       quarter="Q2", epic="2.1 Live-Match-Tracking", aufwand="4 h",
       ziel="Push an Gegner + Mitleser bei `is_official=true`.",
       files=[("lib/push-notification.service.ts", "MISS")],
       criteria=[
           "Push auf Mobile + Browser",
       ],
       deps=["2.1.3"],
       next_action="Helper `notifyMatchCompleted(match)` im push-notification.service."))

# Epic 2.2 — ELO-System
t(dict(id="2.2.1", title="DB-Trigger für ELO-Update", status="TODO",
       quarter="Q2", epic="2.2 ELO-System", aufwand="16 h",
       ziel="Trigger auf `match_results` INSERT → `players.elo_rating` UPDATE (K-Faktor 32).",
       files=[("supabase/migrations/2026xxxx_elo_trigger.sql", "MISS"),
              ("lib/services/elo.service.ts", "MISS")],
       criteria=[
           "Trigger funktioniert",
           "ELO konvergiert (Backing-Tests 2.2.4)",
       ],
       deps=["2.1.2"],
       next_action="Migration mit Trigger-Funktion + elo.service.ts mit `updateElo(playerId, opponentId, won)` (pure function)."))

t(dict(id="2.2.2", title="ELO-Anzeige im Member-Profil", status="TODO",
       quarter="Q2", epic="2.2 ELO-System", aufwand="8 h",
       ziel="ELO + Verlauf (Sparkline) im Profil.",
       files=[("components/member-profile.tsx", "OK")],
       criteria=[
           "Sparkline rendert",
       ],
       deps=["2.2.1"],
       next_action="Section in member-profile.tsx ergänzen (Datei existiert)."))

t(dict(id="2.2.3", title="Verbands-LK-Separation", status="TODO",
       quarter="Q2", epic="2.2 ELO-System", aufwand="4 h",
       ziel="SwingZ-ELO vs. DTB-LK im Profil klar getrennt.",
       files=[("components/member-profile.tsx", "OK")],
       criteria=[
           "UI-Test grün",
       ],
       deps=["2.2.2"],
       next_action="Zwei separate Cards/Sections im Profil."))

t(dict(id="2.2.4", title="Backing-Test für ELO-Algorithmus", status="TODO",
       quarter="Q2", epic="2.2 ELO-System", aufwand="8 h",
       ziel="Bekannte Szenarien: 1200 vs 1200 → Sieger 1216; 1600 vs 1200 → expected win.",
       files=[("tests/unit/lib/elo.test.ts", "MISS")],
       criteria=[
           "Tests grün",
       ],
       deps=["2.2.1"],
       next_action="`tests/unit/lib/elo.test.ts` neu."))

# Epic 2.3 — Spieler-Profile v2 + Match-History
t(dict(id="2.3.1", title="Profil-Page Mobile-First Redesign", status="TODO",
       quarter="Q2", epic="2.3 Spieler-Profile v2", aufwand="16 h",
       ziel="Hero mit ELO + letzter Match + Badges inline, Mobile-Lighthouse > 90.",
       files=[("app/(protected)/member/profile-v2/page.tsx", "MISS")],
       criteria=[
           "Mobile-Lighthouse Score > 90",
       ],
       deps=["2.2.1"],
       next_action="Neue Page als Alternative zum bestehenden `app/(protected)/member/profile/page.tsx` (oder vollständig ersetzen)."))

t(dict(id="2.3.2", title="Head-to-Head View", status="TODO",
       quarter="Q2", epic="2.3 Spieler-Profile v2", aufwand="12 h",
       ziel="Match-History zwischen 2 Spielern.",
       files=[("components/matches/head-to-head.tsx", "MISS")],
       criteria=[
           "Funktioniert (Unit + E2E)",
       ],
       deps=["2.1.4"],
       next_action="Komponente neu erstellen; Aggregation im Server oder Client."))

t(dict(id="2.3.3", title="Saison-Bilanz", status="TODO",
       quarter="Q2", epic="2.3 Spieler-Profile v2", aufwand="8 h",
       ziel="Wins/Losses pro Saison server-aggregiert.",
       files=[("app/(protected)/member/profile-v2/page.tsx", "MISS")],
       criteria=[
           "Echtzeit-Daten",
       ],
       deps=["2.3.1"],
       next_action="Server-Komponente mit Drizzle-Aggregation."))

t(dict(id="2.3.4", title="„Fordern\"-Button in Open-Matches-Liste", status="TODO",
       quarter="Q2", epic="2.3 Spieler-Profile v2", aufwand="8 h",
       ziel="Direkt-Challenge aus Liste ohne Detail-Page.",
       files=[("components/open-matches.tsx", "OK")],
       criteria=[
           "Funktioniert end-to-end",
       ],
       deps=["2.1.3"],
       next_action="Inline-Button in open-matches.tsx ergänzen."))

# Epic 2.4 — Capacitor Mobile App Wrapper
t(dict(id="2.4.1", title="Capacitor-Wrapper initialisieren", status="TODO",
       quarter="Q2", epic="2.4 Capacitor Mobile App", aufwand="8 h",
       ziel="`npx cap init`, iOS+Android Targets konfiguriert.",
       files=[("capacitor.config.ts", "MISS")],
       criteria=[
           "Builds lokal (iOS/Android)",
       ],
       deps=[],
       next_action="`npx cap init`, capacitor.config.ts generieren, iOS/Android-Targets hinzufügen."))

t(dict(id="2.4.2", title="Native Push-Bridge", status="TODO",
       quarter="Q2", epic="2.4 Capacitor Mobile App", aufwand="24 h",
       ziel="`@capacitor/push-notifications`, Web-Push + APNS-Bridge.",
       files=[],
       criteria=[
           "Push auf iOS",
       ],
       deps=["2.4.1"],
       next_action="Plugin installieren, lib/push-notification.service.ts erweitern."))

t(dict(id="2.4.3", title="App-Icons + Splash", status="TODO",
       quarter="Q2", epic="2.4 Capacitor Mobile App", aufwand="4 h",
       ziel="Standard + Sport-Icons, brand-konform.",
       files=[],
       criteria=[
           "Brand-konform",
       ],
       deps=["2.4.1"],
       next_action="App-Icons generieren (1024×1024 Master + adaptive)."))

t(dict(id="2.4.4", title="App Store Listing", status="TODO",
       quarter="Q2", epic="2.4 Capacitor Mobile App", aufwand="12 h",
       ziel="AppStore-Connect + Play-Console Listings.",
       files=[],
       criteria=[
           "Listings live",
       ],
       deps=["2.4.3"],
       next_action="Texte, Screenshots, Pricing einreichen."))

t(dict(id="2.4.5", title="Capacitor Build CI", status="TODO",
       quarter="Q2", epic="2.4 Capacitor Mobile App", aufwand="8 h",
       ziel="GitHub Action mit Testflight-Build.",
       files=[],
       criteria=[
           "CI grün",
       ],
       deps=["2.4.1"],
       next_action="GitHub-Action definieren."))

# Epic 2.5 — Marketing-Quick-Wins
t(dict(id="2.5.1", title="Last-Minute-Alerts", status="TODO",
       quarter="Q2", epic="2.5 Marketing-Wins", aufwand="20 h",
       ziel="Court-Storno → Push „Platz frei jetzt!\".",
       files=[],
       criteria=[
           "Push firing funktioniert",
       ],
       deps=["2.5.2"],
       next_action="Hook in booking-cancel + lib/push-notification.service."))

t(dict(id="2.5.2", title="Inaktivitäts-Reaktivierung", status="TODO",
       quarter="Q2", epic="2.5 Marketing-Wins", aufwand="16 h",
       ziel="Cron-Route: 14 Tage inaktiv → Push.",
       files=[("app/api/cron/reactivation/route.ts", "MISS")],
       criteria=[
           "E2E grün",
       ],
       deps=[],
       next_action="Cron-Route + Vercel Cron-Job definieren."))

t(dict(id="2.5.3", title="Newsletter-Wizard", status="TODO",
       quarter="Q2", epic="2.5 Marketing-Wins", aufwand="24 h",
       ziel="Admin-Tool mit 3 vorgefertigten Templates.",
       files=[],
       criteria=[
           "UI + Send funktional",
       ],
       deps=[],
       next_action="Wizard-Page + Resend-Integrations-Komponente."))

# ──────────────────────────────────────────────────────────────────────────────
# Q3
# ──────────────────────────────────────────────────────────────────────────────

# Epic 3.1 — Smart-Court API
t(dict(id="3.1.1", title="Hardware-Adapter-Interface", status="TODO",
       quarter="Q3", epic="3.1 Smart-Court API", aufwand="16 h",
       ziel="Plugin-Pattern: Nuki, Shelly, Loxone.",
       files=[("lib/hardware/adapter.ts", "MISS")],
       criteria=[
           "Adapter-Tests grün",
       ],
       deps=["3.2.1"],
       next_action="`lib/hardware/adapter.ts` neu erstellen (Plugin-Interface)."))

t(dict(id="3.1.2", title="Buchung-zu-Hardware-Webhook", status="TODO",
       quarter="Q3", epic="3.1 Smart-Court API", aufwand="24 h",
       ziel="Bei Buchung-Start → Licht-Code pushen.",
       files=[("app/api/webhooks/booking-completed/route.ts", "MISS")],
       criteria=[
           "Hardware-Integration E2E",
       ],
       deps=["3.1.1"],
       next_action="Webhook-Route + Adapter-Implementierungen."))

t(dict(id="3.1.3", title="Smart-Court-Admin-UI", status="TODO",
       quarter="Q3", epic="3.1 Smart-Court API", aufwand="16 h",
       ziel="Adapter-Konfiguration pro Court.",
       files=[("app/(protected)/admin/smart-court/page.tsx", "MISS")],
       criteria=[
           "UI funktioniert",
       ],
       deps=["3.1.1"],
       next_action="Admin-Page neu erstellen."))

t(dict(id="3.1.4", title="Smart-Court Premium-Pricing", status="TODO",
       quarter="Q3", epic="3.1 Smart-Court API", aufwand="8 h",
       ziel="„Smart Club\"-Bundle 79 € Add-On.",
       files=[("lib/features.ts", "OK"),
              ("app/(protected)/owner/billing/page.tsx", "OK")],
       criteria=[
           "Stripe-Webhook getestet",
       ],
       deps=["3.6.1"],
       next_action="lib/features.ts Add-On-Feature-Flag + Owner-Billing Page."))

# Epic 3.2 — Multi-Sport
t(dict(id="3.2.1", title="Court-Typ-Enum-Erweiterung", status="TODO",
       quarter="Q3", epic="3.2 Multi-Sport", aufwand="8 h",
       ziel="`tennis`, `padel`, `pickleball`, `squash` als `courts.sport_type` Enums.",
       files=[("src/infrastructure/persistence/schema.ts", "OK")],
       criteria=[
           "Migration grün",
       ],
       deps=[],
       next_action="Migration mit `ALTER TYPE` + Drizzle-Schema-Erweiterung."))

t(dict(id="3.2.2", title="Court-Booking-Sport-Typ-Filter", status="TODO",
       quarter="Q3", epic="3.2 Multi-Sport", aufwand="8 h",
       ziel="Dropdown im Booking-Flow.",
       files=[("app/(protected)/dashboard/bookings/new/page.tsx", "OK")],
       criteria=[
           "Filter funktioniert",
       ],
       deps=["3.2.1"],
       next_action="Sport-Select in Booking-New-Page."))

t(dict(id="3.2.3", title="Saisonplaner-Multi-Sport", status="TODO",
       quarter="Q3", epic="3.2 Multi-Sport", aufwand="16 h",
       ziel="Court-Constraint nach Sport-Typ im Clustering.",
       files=[("lib/season-planning/clustering-engine.ts", "OK")],
       criteria=[
           "Tests grün",
       ],
       deps=["3.2.1"],
       next_action="Erweitern + Tests."))

t(dict(id="3.2.4", title="Pricing-Rules für Multi-Sport", status="TODO",
       quarter="Q3", epic="3.2 Multi-Sport", aufwand="12 h",
       ziel="Padel teurer pro Std als Tennis.",
       files=[("lib/billing/pricing-rules.ts", "MISS")],
       criteria=[
           "Tests grün",
       ],
       deps=["3.2.1"],
       next_action="`lib/billing/pricing-rules.ts` neu (Sport-Tier-aware)."))

t(dict(id="3.2.5", title="Migration alter Tennis-only Courts", status="TODO",
       quarter="Q3", epic="3.2 Multi-Sport", aufwand="4 h",
       ziel="Default `sport_type='tennis'` für existierende Courts.",
       files=[],
       criteria=[
           "`tsc` grün",
           "Migration idempotent",
       ],
       deps=["3.2.1"],
       next_action="Migration mit `UPDATE … SET sport_type='tennis' WHERE …`."))

# Epic 3 (Pricing-Tier-Update) — Q3 Zusatz
t(dict(id="3.6.1", title="Pay-per-Active-Member-Pricing", status="TODO",
       quarter="Q3", epic="3.6 Pricing-Tier-Update", aufwand="24 h",
       ziel="Stripe Subscription Items für variable Member-Count.",
       files=[("app/api/webhooks/stripe/route.ts", "OK")],
       criteria=[
           "Stripe-Test grün",
       ],
       deps=[],
       next_action="Stripe-Quantity-basiertes Pricing; Webhook-Update."))

t(dict(id="3.6.2", title="Pricing-Page Communication", status="TODO",
       quarter="Q3", epic="3.6 Pricing-Tier-Update", aufwand="8 h",
       ziel="Pricing-Tabelle mit Add-Ons.",
       files=[],
       criteria=[
           "UI live",
       ],
       deps=["3.6.1"],
       next_action="`app/landing/pricing/page.tsx` neu (siehe 1.2.3)."))

t(dict(id="3.6.3", title="Owner-Billing-Dashboard Update", status="TODO",
       quarter="Q3", epic="3.6 Pricing-Tier-Update", aufwand="8 h",
       ziel="Member-Count im Billing-Dashboard sichtbar.",
       files=[],
       criteria=[
           "Owner kann Kosten hochrechnen",
       ],
       deps=["3.6.1"],
       next_action="Dashboard-Karte mit Member-Count-Multiplikator."))

# ──────────────────────────────────────────────────────────────────────────────
# Cross-Cutting (B1–B9)
# ──────────────────────────────────────────────────────────────────────────────

t(dict(id="B1", title="Bundle-Analyzer CI-Integration", status="PARTIAL",
       quarter="Cross-Cutting", epic="B1 Bundle-Analyzer", aufwand="8 h",
       ziel="Analyzer-Output in CI-Report sichtbar.",
       files=[("next.config.js", "OK")],
       criteria=[
           "Analyzer-Output in CI-Build-Artifact",
       ],
       deps=["1.1.6"],
       next_action="GitHub-Action-Snippet für build-with-analyzer."))

t(dict(id="B2", title="`next-intl`-Strategie klären (entfernen ODER aktivieren)",
       status="PARTIAL", quarter="Cross-Cutting", epic="B2 next-intl", aufwand="4 h",
       ziel="Entscheidung dokumentiert.",
       files=[("i18n/", "OK")],
       criteria=[
           "Bundle-Größe gemessen",
           "Entscheidung im Changelog",
       ],
       deps=[],
       next_action="Wie 1.1.7 — tatsächlich aktivieren oder entfernen."))

t(dict(id="B3", title="Service-Client-Audit-Dokumentation", status="DONE",
       quarter="Cross-Cutting", epic="B3 Service-Audit", aufwand="6 h",
       ziel="Empfehlungen je Route in `docs/supabase-rls-audit.md`.",
       files=[("docs/supabase-rls-audit.md", "OK")],
       criteria=[
           "Dokumentiert",
       ],
       deps=["1.0.3"],
       next_action="Keine."))

t(dict(id="B4", title="Rate-Limiting auf Member-API-Routes", status="DONE",
       quarter="Cross-Cutting", epic="B4 Rate-Limit", aufwand="16 h",
       ziel="Zentraler Rate-Limit-Wrapper für Member-Routen.",
       files=[("lib/api-fetch.ts", "OK")],
       criteria=[
           "Rate-Limit pro Route aktiv",
       ],
       deps=[],
       next_action="Keine — vermutlich bereits in api-fetch integriert."))

t(dict(id="B5", title="Sentry-Coverage Audit + Synthetic Test pro Quartal",
       status="PARTIAL", quarter="Cross-Cutting", epic="B5 Sentry", aufwand="8 h/Q",
       ziel="Quartalsweiser Sentry-Coverage-Audit + Synthetic-Test.",
       files=[],
       criteria=[
           "Synthetic-Test firing",
           "Audit-Report",
       ],
       deps=[],
       next_action="Quartals-Check einrichten."))

t(dict(id="B6", title="Quartals-Roadmap-Review", status="DONE",
       quarter="Cross-Cutting", epic="B6 Roadmap-Review", aufwand="12 h/Q",
       ziel="Quartals-Review mit Sales + 2 Vereins-Admins.",
       files=[("docs/UMSETZUNGSPLAN_PROJEKTANALYSE.md", "OK")],
       criteria=[
           "Review-Notizen pro Quartal",
       ],
       deps=[],
       next_action="Keine."))

t(dict(id="B7", title="Decisions/Voting Sichtbarkeits-Boost + Demo-Video",
       status="TODO", quarter="Cross-Cutting", epic="B7 Decisions", aufwand="16 h",
       ziel="Marketing-Video + bessere UI-Sichtbarkeit für Decisions-Modul.",
       files=[("app/(protected)/admin/decisions/page.tsx", "OK")],
       criteria=[
           "Demo-Video live",
           "UI-Discoverability verbessert",
       ],
       deps=["TICKET-002"],
       next_action="Video auf landing-page ergänzen; UI-Promo-Banner."))

t(dict(id="B8", title="DSGVO-Audit-Trail für Lese-PII-Zugriffe (A4)",
       status="TODO", quarter="Cross-Cutting", epic="B8 DSGVO-Audit", aufwand="12 h",
       ziel="Audit-Log für Lesezugriffe auf PII-Daten.",
       files=[("lib/db/audit-logger.ts", "MISS")],
       criteria=[
           "Jeder PII-Read protokollierbar",
           "Rate-Limit-Schutz vor Audit-Spam",
       ],
       deps=["F6.1"],
       next_action="`lib/db/audit-logger.ts` neu; Middleware für PII-Routes."))

t(dict(id="B9", title="Pen-Test vor Q2-Auslieferung (Live-Tracking)",
       status="TODO", quarter="Cross-Cutting", epic="B9 Pen-Test", aufwand="24 h",
       ziel="Externer Pen-Test vor Q2-Live-Tracking-Release.",
       files=[],
       criteria=[
           "Pen-Test-Report mit Findings",
           "Alle HIGH-Findings gefixt",
       ],
       deps=["2.1.1", "2.1.2", "2.1.3"],
       next_action="Vendor aussuchen + Zeitfenster in Q2."))

# ──────────────────────────────────────────────────────────────────────────────
# Old Plan (F1–F12, A1–A4)
# ──────────────────────────────────────────────────────────────────────────────

t(dict(id="F1", title="DATEV-CSV-Export", status="TODO",
       quarter="Old Plan", epic="F1 DATEV", aufwand="—",
       ziel="Rechnungs-Export nach DATEV-Format.",
       files=[],
       criteria=[
           "DATEV-konformer Export",
       ],
       deps=[],
       next_action="Konkrete Datei-Targets fehlen — mit Finanz-Team absprechen."))

t(dict(id="F2", title="Übungsleiterpauschale", status="TODO",
       quarter="Old Plan", epic="F2 Übungsleiterpauschale", aufwand="—",
       ziel="§ 3 Nr. 26 EStG Pauschalbetrag rechnerisch korrekt in Billing.",
       files=[("lib/types/billing.ts", "OK"),
              ("lib/billing/dunning.service.ts", "OK")],
       criteria=[
           "Pauschale als Fee-Config-Option",
           "Berücksichtigung §3 Nr. 26a EStG",
       ],
       deps=[],
       next_action="In Fee-Konfiguration (`app/(protected)/admin/settings/`) integrieren."))

t(dict(id="F3", title="GoBD-Doku", status="DONE",
       quarter="Old Plan", epic="F3 GoBD", aufwand="—",
       ziel="GoBD-Verfahrensdokumentation.",
       files=[("docs/GOBD_VERFAHRENSDOKUMENTATION.md", "OK")],
       criteria=[
           "Dokument vorhanden",
       ],
       deps=[],
       next_action="Keine."))

t(dict(id="F5", title="Turnier-Auslosung", status="TODO",
       quarter="Old Plan", epic="F5 Turnier-Auslosung", aufwand="—",
       ziel="Bracket-Generator für Vereins-Turniere.",
       files=[],
       criteria=[
           "Funktionierende Auslosung",
       ],
       deps=[],
       next_action="Konzept erstellen — Datei-Targets fehlen."))

t(dict(id="F7", title="Drizzle-Schema-Drift (deckt sich mit Epic 1.1)",
       status="DONE", quarter="Old Plan", epic="F7 Drizzle-Schema-Drift", aufwand="—",
       ziel="Bewusste Partial-Mirror-Strategy mit Drift-Detection.",
       files=[("src/infrastructure/persistence/schema.ts", "OK"),
              ("lib/db/drizzle-extractor.ts", "OK"),
              ("lib/db/drift-scanner.ts", "OK"),
              ("scripts/db-schema-drift.ts", "OK"),
              ("tests/unit/lib/db/drift-scanner.test.ts", "OK")],
       criteria=[
           "Drift-Scanner findet Drift",
       ],
       deps=[],
       next_action="Keine — regelmäßig in CI laufen lassen."))

t(dict(id="F8", title="SMS/WhatsApp-Benachrichtigungen", status="TODO",
       quarter="Old Plan", epic="F8 SMS/WhatsApp", aufwand="—",
       ziel="Push-Alternativen für Mitglieder ohne Smartphone-App.",
       files=[("lib/push-notification.service.ts", "MISS")],
       criteria=[
           "SMS-Versand getestet (Twilio oder MessageBird)",
       ],
       deps=[],
       next_action="Vendor wählen + lib/push-notification erweitern."))

t(dict(id="F9", title="LK-Berechnung", status="PARTIAL",
       quarter="Old Plan", epic="F9 LK-Berechnung", aufwand="—",
       ziel="DTB-LK-Werte in SwingZ synchronisieren + anzeigen.",
       files=[("lib/services/nuliga-scraper.ts", "OK")],
       criteria=[
           "LK-Sync-Fehlerquote < 2%",
       ],
       deps=["1.3.1"],
       next_action="LK-Werte ins `players.lk_rating` schreiben (Migration nötig)."))

t(dict(id="F10", title="Wallet-Pass (Apple/Google)", status="TODO",
       quarter="Old Plan", epic="F10 Wallet-Pass", aufwand="—",
       ziel="Mitgliedsausweis als Wallet-Pass.",
       files=[],
       criteria=[
           "Wallet-Pass-Generator",
       ],
       deps=[],
       next_action="Konzept + Library-Auswahl."))

t(dict(id="F11", title="Echte Job-Queue (BullMQ o.ä.)", status="TODO",
       quarter="Old Plan", epic="F11 Job-Queue", aufwand="—",
       ziel="Background-Jobs persistent + retryable.",
       files=[],
       criteria=[
           "BullMQ oder Resque",
       ],
       deps=[],
       next_action="Vendor-Auswahl BullMQ vs Inngest."))

t(dict(id="F12", title="Churn-Prediction", status="TODO",
       quarter="Old Plan", epic="F12 Churn-Prediction", aufwand="—",
       ziel="Mit Churn-Risiko-Score pro Member.",
       files=[],
       criteria=[
           "Algorithmus dokumentiert",
       ],
       deps=["B6"],
       next_action="Konzept erstellen, Q3+."))

t(dict(id="A1", title="Rate-Limit zentralisieren", status="DONE",
       quarter="Old Plan", epic="A1 Rate-Limit", aufwand="—",
       ziel="Zentraler Rate-Limit-Wrapper.",
       files=[("lib/api-fetch.ts", "OK")],
       criteria=[
           "Im api-fetch integriert",
       ],
       deps=[],
       next_action="Keine."))

t(dict(id="A2", title="Ämterbasierte Permissions (verteilt auf F4.4)",
       status="DONE", quarter="Old Plan", epic="A2 Permissions", aufwand="—",
       ziel="Office-Flag-System.",
       files=[("lib/api-auth.ts", "OK"),
              ("lib/auth-common.ts", "OK")],
       criteria=[
           "`verifyOffice` deckt alle Ämter ab",
       ],
       deps=[],
       next_action="Keine — siehe F4.4 für Detail."))

t(dict(id="A3", title="nuLiga-Adapter härten (deckt sich mit Epic 1.3)",
       status="PARTIAL", quarter="Old Plan", epic="A3 nuLiga", aufwand="—",
       ziel="nuLiga-Scraper-Hardening.",
       files=[("lib/services/nuliga-scraper.ts", "OK")],
       criteria=[
           "Retries, Sentry-Capture, CSV-Fallback",
       ],
       deps=["1.3.1"],
       next_action="Wie Epic 1.3 — CSV-Import und Snapshot-Tests ergänzen."))

t(dict(id="A4", title="DSGVO-Read-Audit-Trail", status="TODO",
       quarter="Old Plan", epic="A4 DSGVO-Audit", aufwand="—",
       ziel="Lese-Audit-Trail für PII (komplementär zu F6).",
       files=[("lib/db/audit-logger.ts", "MISS")],
       criteria=[
           "Audit-Einträge pro PII-Read",
       ],
       deps=["F6.1"],
       next_action="Wie B8 — gemeinsam umsetzen."))

# ──────────────────────────────────────────────────────────────────────────────
# Roadmap TICKETS (aus IMPLEMENTATION_TICKETS_Q3_2026.md)
# ──────────────────────────────────────────────────────────────────────────────

t(dict(id="TICKET-001", title="Verzugszins-Mahnwesen nach §288 BGB", status="PARTIAL",
       quarter="Roadmap", epic="TICKET-001 Verzugszins-Mahnwesen", aufwand="2-3 Tage",
       ziel="Rechtssichere Verzugszins-Engine: B2C +9 PP, B2B +9 PP auf Basiszins, halbjährliche Aktualisierung, ACT/360.",
       files=[("lib/billing/verzugszins.ts", "OK"),
              ("lib/types/billing.ts", "OK"),
              ("lib/billing/dunning.service.ts", "OK"),
              ("supabase/migrations/20260624_mahnwesen_verzugszins_decisions.sql", "OK"),
              ("lib/billing/verzugszins.test.ts", "MISS"),
              ("e2e/admin-dunning.spec.ts", "MISS")],
       criteria=[
           "AKZ-1.1 B2C Verzugszins ≈ 1,17 € (100€, 30T, 2,27%)",
           "AKZ-1.2 B2B ≈ 1,80 € (gleicher Input)",
           "AKZ-1.3 Halbjährlicher Basiszinssatz-Wechsel segmentiert",
           "AKZ-1.4 firstDunningAt konfigurierbar (§286 Abs. 3)",
           "AKZ-1.5 Mahnstufen 1+2+3 progressive Gebühren",
           "Verzugszins-Unit-Tests grün",
           "E2E Mahnbescheid grün",
       ],
       deps=[],
       next_action="Unit-Tests in `tests/unit/lib/billing/verzugszins.test.ts` schreiben + E2E in `e2e/admin-dunning.spec.ts` (Roadmap-MUSS-Kriterien)."))

t(dict(id="TICKET-002", title="Beschlussdatenbank digital (BGB §§ 32, 33)",
       status="PARTIAL", quarter="Roadmap", epic="TICKET-002 Beschlussdatenbank", aufwand="3-4 Tage",
       ziel="Vier Beschluss-Typen, 5 Status, RLS-isoliert, Stimmenerfassung, Soft-Delete.",
       files=[("lib/types/decisions.ts", "OK"),
              ("app/api/decisions/route.ts", "OK"),
              ("app/api/decisions/[id]/route.ts", "OK"),
              ("app/api/decisions/[id]/votes/route.ts", "OK"),
              ("app/(protected)/admin/decisions/page.tsx", "OK"),
              ("components/decision-vote-button.tsx", "OK"),
              ("supabase/migrations/20260624_mahnwesen_verzugszins_decisions.sql", "OK")],
       criteria=[
           "AKZ-2.1 ENUM decision_type (4 Werte)",
           "AKZ-2.2 Status ENUM (5 Werte)",
           "AKZ-2.3 Soft-Delete (kein Hard-Delete)",
           "AKZ-2.4 RLS Member sehen nur completed MV",
           "AKZ-2.5 Idempotente Stimmabgabe",
           "AKZ-2.6 Stimmabgabe nur bei scheduled/in_progress",
           "AKZ-2.7 RLS Member sieht eigene Einladungen",
           "Quorum-Berechnung (AKZ-2.8 nice-to-have)",
           "E2E",
       ],
       deps=[],
       next_action="Quorum-Berechnung in `decision.service.ts` ergänzen (backend TODO)."))

t(dict(id="TICKET-003", title="Medenspiel-CSV-Export für Verbände",
       status="DONE", quarter="Roadmap", epic="TICKET-003 Medenspiel-CSV", aufwand="0,5-1 Tag",
       ziel="Standardisierter CSV-Export für Verbände mit BOM, DE-Datumsformat, Hochkomma-Escaping.",
       files=[("app/api/leagues/[id]/export/verband/route.ts", "OK"),
              ("tests/unit/lib/csv-export.test.ts", "OK")],
       criteria=[
           "AKZ-3.1 Endpoint mit Trainer+Auth",
           "AKZ-3.2 Filter auf club_id+league_id",
           "AKZ-3.3 Header-Block mit Liga-Metadaten",
           "AKZ-3.7 Content-Disposition mit File-Name",
           "CSV-Escape-Unit-Tests grün",
       ],
       deps=[],
       next_action="Keine — Backend + Unit-Tests grün. Nice-to-have: BTV/WTV/HTV-Adapter."))

t(dict(id="TICKET-W2-CAST-CLEANUP", title="Wave-2 Cast-Cleanup Complex Routes",
       status="PARTIAL", quarter="Roadmap", epic="TICKET-W2 Cast-Cleanup", aufwand="0,5 Tag",
       ziel="`as any`-Casts in `app/api/leagues/[id]/matchdays/.../lineup/route.ts` und `result/route.ts` entfernen.",
       files=[("app/api/leagues/[id]/matchdays/[matchdayId]/lineup/route.ts", "OK"),
              ("app/api/leagues/[id]/matchdays/[matchdayId]/result/route.ts", "OK"),
              ("types/supabase.ts", "OK"),
              ("lib/types/matchdays.ts", "OK")],
       criteria=[
           "AKZ-2.1 LineupPositionsSchema.parse() + typed Insert-Payload",
           "AKZ-2.2 Lineup-GET full cast removal",
           "AKZ-2.3 ResultUpdateSchema.parse() + typed Update-Payload",
           "AKZ-2.4 Result-GET full cast removal",
           "AKZ-2.5 TS-Baseline bleibt 27 Errors",
           "AKZ-2.6 Cast-Count ≤33 (= -8) — DELTA-3 erreicht (41→38; -5 in weiteren Routes als W3 Follow-up getrackt)",
       ],
       deps=["2.1.1"],
       next_action="W3 Cast-Cleanup: 5 weitere `as any` in anderen `app/api/leagues/`-Routes (Tickets in `route.ts` + `[id]/route.ts`)."))



# ═══ Generation ═══

QUARTER_DIR = {
    "Q1": "q1",
    "Q2": "q2",
    "Q3": "q3",
    "Cross-Cutting": "cross",
    "Old Plan": "old-plan",
    "Roadmap": "roadmap",
}

TEMPLATE = """# {id} — {title}

> **Epic:** {epic} · **Quartal:** {quarter} · **Aufwand:** {aufwand}  
> **Status:** {status_icon} {status_text} · *zuletzt geprüft: {today}*

## Ziel
{ziel}

## Voraussetzungen
{deps_block}

## Geänderte / neue Dateien
{files_block}

## Akzeptanzkriterien
{criteria_block}

## Out-of-Scope
{oos_block}

## Nächste Aktion
{next_action}
"""


def render(ticket: dict) -> str:
    deps = ticket.get("deps") or []
    deps_block = "\n".join(f"- `{d}`" for d in deps) if deps else "- _(keine)_"
    files = ticket.get("files") or []
    file_lines = []
    for f, st in files:
        marker = FILE_ICON.get(st, "?")
        file_lines.append(f"- {marker} `{f}` — *{st}*")
    files_block = "\n".join(file_lines) if file_lines else "- _(nicht definiert)_"
    criteria = ticket.get("criteria") or []
    criteria_block = "\n".join(f"- [ ] {c}" for c in criteria) if criteria else "- _(nicht definiert)_"
    oos = ticket.get("oos") or []
    oos_block = "\n".join(f"- {x}" for x in oos) if oos else "- _(nicht definiert)_"
    return TEMPLATE.format(
        id=ticket["id"],
        title=ticket["title"],
        epic=ticket["epic"],
        quarter=ticket["quarter"],
        aufwand=ticket["aufwand"],
        status_icon=STATUS_ICON.get(ticket["status"], "❓"),
        status_text=ticket["status"],
        ziel=ticket["ziel"],
        deps_block=deps_block,
        files_block=files_block,
        criteria_block=criteria_block,
        oos_block=oos_block,
        next_action=ticket["next_action"],
        today=TODAY,
    )


def main() -> int:
    if not TICKETS:
        print("ERROR: keine Tickets definiert.", file=sys.stderr)
        return 1

    # Validierung: keine doppelten IDs, keine dangling cross-references.
    # Errors werden gesammelt, damit alle Probleme auf einmal gemeldet werden
    # (`O(n)` Statische Checks, keine halbe Output-Datei).
    errors: list[str] = []
    seen_ids: set[str] = set()
    for tk in TICKETS:
        if tk["id"] in seen_ids:
            errors.append(f"duplicate ticket id {tk['id']!r}")
        seen_ids.add(tk["id"])
    valid_ids = seen_ids
    for tk in TICKETS:
        for dep in tk.get("deps") or []:
            if dep not in valid_ids:
                errors.append(f"ticket {tk['id']!r} has dangling dependency {dep!r}")
    if errors:
        for e in errors:
            print(f"ERROR: {e}", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    for q in sorted(set(t["quarter"] for t in TICKETS)):
        (OUT / QUARTER_DIR[q]).mkdir(parents=True, exist_ok=True)

    # pro Ticket eine .md
    counter = defaultdict(int)
    for ticket in TICKETS:
        sub = OUT / QUARTER_DIR[ticket["quarter"]]
        # sanitized filename — replace slashes etc.
        fname = ticket["id"].replace("/", "-") + ".md"
        (sub / fname).write_text(render(ticket), encoding="utf-8")
        counter[ticket["quarter"]] += 1

    # INDEX.md — alphabetisch, gruppiert nach Quartal
    index_lines = [
        "# Ticket-Tracking Index",
        "",
        "> Quelle: [`docs/UMSETZUNGSPLAN_PROJEKTANALYSE.md`](../UMSETZUNGSPLAN_PROJEKTANALYSE.md) + [`docs/roadmap/IMPLEMENTATION_TICKETS_Q3_2026.md`](../roadmap/IMPLEMENTATION_TICKETS_Q3_2026.md)  ",
        "> Stand: {today} · Gesamt: {total} Tickets  ",
        "> Status-Legende: ✅ DONE · 🔶 PARTIAL · ❌ TODO · 📅 PLANNED",
        "",
    ]
    for q in sorted(QUARTER_DIR):
        q_tickets = sorted([t for t in TICKETS if t["quarter"] == q], key=lambda x: x["id"])
        if not q_tickets:
            continue
        index_lines.append(f"## {q}  ({len(q_tickets)} Tickets)")
        index_lines.append("")
        for t in q_tickets:
            icon = STATUS_ICON[t["status"]]
            index_lines.append(
                f"- {icon} **[{t['id']}]({QUARTER_DIR[q]}/{t['id'].replace('/', '-')}.md)** "
                f"— {t['title']}"
            )
        index_lines.append("")
    total = sum(counter.values())
    (OUT / "INDEX.md").write_text(
        "\n".join(index_lines).format(today=TODAY, total=total), encoding="utf-8"
    )

    # STATUS.md — sortiert nach Status
    status_lines = [
        "# Status-Übersicht",
        "",
        "> Aggregiert aus dem vollständigen Ticket-Set. ",
        "> Stand: {today} · Gesamt: {total} Tickets",
        "",
        "## Verteilung",
        "",
    ]
    by_status = defaultdict(list)
    for t in TICKETS:
        by_status[t["status"]].append(t)
    for st, lst in sorted(by_status.items(), key=lambda kv: ["DONE", "PARTIAL", "TODO", "PLANNED"].index(kv[0])):
        status_lines.append(f"- **{STATUS_ICON[st]} {st}**: {len(lst)}")
    status_lines.append("")

    for st in ["TODO", "PARTIAL", "DONE"]:
        if st not in by_status:
            continue
        status_lines.append(f"## {STATUS_ICON[st]} {st} ({len(by_status[st])})")
        status_lines.append("")
        for t in sorted(by_status[st], key=lambda x: x["id"]):
            sub = QUARTER_DIR[t["quarter"]]
            status_lines.append(
                f"- **[{t['id']}]({sub}/{t['id'].replace('/', '-')}.md)** "
                f"_({t['quarter']}/{t['epic']})_ — {t['title']}  "
                f"\n  → „{t['next_action']}\""
            )
        status_lines.append("")

    (OUT / "STATUS.md").write_text(
        "\n".join(status_lines).format(today=TODAY, total=total), encoding="utf-8"
    )

    print(f"Wrote {total} ticket files + INDEX.md + STATUS.md under {OUT.relative_to(ROOT)}/")
    for q, n in sorted(counter.items()):
        print(f"  {q:>15s}: {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
