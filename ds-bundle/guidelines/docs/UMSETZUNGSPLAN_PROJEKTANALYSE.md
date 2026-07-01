# Umsetzungsplan: SwingZ — Erkenntnisse aus der Projektanalyse

> **Basis:** [`docs/projekt_analyse.md`](./projekt_analyse.md) (25.06.2026)
> **Komplementär zu:** [`docs/SWINGZ_UMSETZUNGSPLAN.md`](./SWINGZ_UMSETZUNGSPLAN.md) (24.06.2026, Fokus Compliance/Mannschaftsführer) — diese Tickets bleiben gültig.
> **Zeitraum:** 3 Quartale × ca. 3 Monate = **9 Monate**
> **Methodik:** TDD wo möglich · Inkrementelle Auslieferung · Quartals-Reviews · Vor jedem Commit `npx tsc --noEmit` (0 Errors) + betroffene Tests grün.

---

## 1. Strategisches Ziel

> **Heute:** SwingZ ist ein **Verwaltungs-Tool für Vereinsvorstände** — die App wird nach Onboarding durch Admins genutzt, Mitglieder kommen nur wenn sie müssen (Buchung/Rechnung).
>
> **In 9 Monaten:** SwingZ ist eine **Tennis-Plattform für Mitglieder** — Vereine bleiben Käufer, Mitglieder werden **tägliche Nutzer**. Wettbewerbsvorteil: KI-Co-Trainer-Sportwart (USP), DTB-Integration, SEPA-Compliance, Decisions-Modul.

**Nordstern-Metrik (für die nächsten 9 Monate):**
**Weekly Active Members (WAM) / Total Members** — Target: **>40 %** (heute geschätzt <15 %, nur bei Buchungs-Wellen aktiv).

---

## 2. Sequenzierungs-Strategie (vom Thinker validiert)

**Kritischer Pfad zum ersten messbaren B2B-Wertbeitrag** (Vereins-Admins):

1. `nuLiga-Hardening` (Epic 1.3) → **sofortiger Wert** (kein manuelles LK-Update mehr)
2. `KI-Premium-Sichtbarkeit` (Epic 1.2) → **ROI sichtbar machen** ("12 Std gespart")
3. `DB-Layer-Unify` (Epic 1.1) → **stilles Fundament** für Q2 Capacitor & Match-Recording
4. `Mannschafts-Modul` (F4 aus altem Plan) → **Verkaufsblocker** schließen

**Validierte Hidden Dependencies** (vormerken):

- ✅ DSGVO-PII-Anonymisierung (**F6** aus altem Plan) **VOR** Live-Match-Tracking (Match-History = hochsensible PII)
- ✅ `DB-Unify` **VOR** Capacitor Mobile App (App-Versionen crashen bei Schema-Drift)
- ✅ nuLiga-Hardening **VOR** ELO-System (LK-Werte als Seed für Initial-ELO)
- ⚠️ `next-intl` **VOR** PWA-Install-Banner ist **OPTIONAL** (kann statisch deutsch bleiben)
- ✅ Auth-/Service-Client-Audit **VOR allem** (Bypass kann illegitime Match-Einträge erzeugen → ELO korrupt)
- ✅ `Mannschafts-Modul` (F4) **VOR** ELO (Mannschaftsspiele müssen ins ELO einfließen)
- ✅ Stripe/Billing **VOR** Trainer-Marketplace (Marketplace = Stripe Connect mit Split-Payments)

---

## 3. Phasen-Übersicht

| Quartal | Monate | Ziel                         | Top-3 Tickets                                                                      | Erfolgsmetrik                                                           |
| ------- | ------ | ---------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Q1**  | M1–M3  | **Foundation & B2B-Lock-in** | · nuLiga-Hardening (1.3)<br>· DB-Layer-Unify (1.1)<br>· KI-Premium-UI (1.2)        | · LK-Sync-Fehlerquote <2%/<br>· 30+ B2B-Vereine auf `Professional`-Tier |
| **Q2**  | M4–M6  | **B2C-Engagement & Mobile**  | · Live-Match-Tracking (2.1)<br>· Spieler-Profile v2 (2.3)<br>· Capacitor App (2.4) | · WAM/Total-Members **>25 %**<br>· Match-Inputs/Woche **>500**          |

---

## 4. Q1 — Foundation & B2B-Lock-in (Monate 1–3)

### Epic 1.0 — Service-Client-Audit (Voraussetzung für ALLE anderen)

> **Warum zuerst:** Solange unklar ist welcher Route-Service-Client wo RLS umgeht, kann Q2-Capacitor-App nicht ausgeliefert werden — Mobile-User sehen potenziell fremde Vereins-Daten.

| Ticket                                   | Dateien                                                            | Schritte                                                                                | Akzeptanz                                                                | Aufwand |
| ---------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | :-----: |
| **1.0.1** Service-Client-Inventur        | grep `createServiceClient` über `app/api/**` und `lib/services/**` | Liste erstellen mit: Route, warum Service-Client, RLS-Bypass-Reason, Sicherheits-Klasse | Markdown-Report in `docs/supabase-rls-audit.md` mit Empfehlung pro Route |   6 h   |
| **1.0.2** Service-Client-Klassifizierung | `lib/supabase/audit.ts` (neu) — Helper `AUDIT_RISK_CATEGORIES`     | Auto-Detection der Service-Client-Aufrufe + Lint-Hinweis bei HIGH-Risk Routes           | ESLint-Regel warnt; CI-Build bricht nicht                                |   4 h   |
| **1.0.3** doc                            | `docs/supabase-rls-audit.md`                                       | Policy-Empfehlung pro Route                                                             | Dokumentiert                                                             |   4 h   |

**Voraussetzung für:** 1.1 (DB-Unify), 2.1 (Live-Match-Tracking), 2.2 (ELO), Epic 3 (alles).

---

### Epic 1.1 — DB-Layer-Unify (Drizzle als Single-Source-of-Truth)

| Ticket                                                               | Dateien                                                                                                        | Schritte                                                                    | Akzeptanz                                                        | Aufwand |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- | :-----: |
| **1.1.1** `email_queue`-Schema ergänzen                              | `src/infrastructure/persistence/schema.ts` (neu pgTable), `app/api/email-campaigns/route.ts:6` (`as any` raus) | Drizzle-Tabelle deklarieren, INSERT-Migration auf Drizzle-migrieren         | `grep 'as any' app/api/email-campaigns` = 0; `tsc --noEmit` grün |   4 h   |
| **1.1.2** `groups`-Schema ergänzen                                   | dito                                                                                                           | analog 1.1.1                                                                | grün                                                             |   4 h   |
| **1.1.3** `email_campaigns`-Schema ergänzen                          | dito                                                                                                           | analog 1.1.1                                                                | grün                                                             |   4 h   |
| **1.1.4** `lib/services/nuliga-scraper.ts` von supabase-js → Drizzle | `lib/services/nuliga-scraper.ts`, `supabase` → `db`                                                            | 5 Aufrufe umstellen, Types behalten                                         | Alle Scraper-Tests grün                                          |   8 h   |
| **1.1.5** AI-Schemas migration to Drizzle                            | `lib/services/auto-planning.service.ts`, `lib/ai/schedule-generator-v2.ts`                                     | Gleiche Migration                                                           | grün                                                             |   8 h   |
| **1.1.6** Bundle-Analyzer einführen                                  | `next.config.js` (`@next/bundle-analyzer`), `package.json`                                                     | Wenn `ANALYZE=true` → Analyzer-Output                                       | Funktioniert lokal                                               |   2 h   |
| **1.1.7** `next-intl`-Strategie klären                               | `i18n/` löschen oder aktivieren — **Entscheidung**                                                             | Option A: rauswerfen (DACH-only legitim)<br>Option B: `t()`-Hooks einführen | Bundle-Größe gemessen, Entscheidung im Changelog dokumentiert    |   4 h   |

**Voraussetzung für:** 2.4 (Capacitor)
**Abhängig von:** 1.0
**Gesamt:** ~36 h (~1 Woche Vollzeit)

---

### Epic 1.2 — KI-Premium-Sichtbarkeit (USP monetarisieren)

| Ticket                              | Dateien                                                                                          | Schritte                                                                                                 | Akzeptanz                              | Aufwand |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------- | :-----: |
| **1.2.1** ROI-Stat-Berechnung       | `lib/season-planning/analytics.ts` (neu), `app/(protected)/admin/seasons/[id]/planning/page.tsx` | Nach `runDryRun()`: „X Konflikte gelöst · Y Trainerstunden optimiert · Z Mitglieder glücklicher gemacht" | Stat zeigt für jede Saison             |  12 h   |
| **1.2.2** Upsell-Modal Premium      | neu `components/season-planning/premium-upsell.tsx`                                              | Modal nach erstem Lock-Step („Mit KI-Plan sparst du ~X Std")                                             | Modal sichtbar für Starter-Tier-Nutzer |   8 h   |
| **1.2.3** Pricing-Page Refresh      | `app/landing/pricing/page.tsx`                                                                   | Klares Feature-Vergleich statt Liste; „KI-Sportwart"-Hero                                                | Design + DEV                           |  12 h   |
| **1.2.4** Onboarding-Tour KI-Engine | `components/onboarding-tour/season-planning-tour.tsx`                                            | 3-Step-Tour für erste Saisonplanung                                                                      | Tooltip-Chain funktioniert             |   8 h   |

**Gesamt:** ~40 h (~1 Woche Vollzeit)

---

### Epic 1.3 — nuLiga-Hardening

| Ticket                                               | Dateien                                                                            | Schritte                                                                                     | Akzeptanz                                             | Aufwand |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- | :-----: |
| **1.3.1** Retry-Logik + Layout-Alarm                 | `lib/services/nuliga-scraper.ts`                                                   | 3 Retries mit exponential backoff, Sentry-Capture bei leerem Parse (gibt es schon erweitern) | Sentry-Alarm + manuelle Notification bei Parse-Fehler |   8 h   |
| **1.3.2** Snapshot-Tests gegen HTML                  | `tests/unit/nuliga-scraper.test.ts`                                                | 2-3 gespeicherte HTML-Fixtures parsen, Standings assert                                      | Tests grün                                            |   8 h   |
| **1.3.3** CSV-Import-Fallback (Risiko-Mitigation #2) | `app/api/admin/nuliga/import/route.ts` (neu), `components/admin/nuliga-import.tsx` | Admin kann nuLiga-CSV hochladen, Parser → DB                                                 | Im Krisenfall (Scraper-Ausfall) manueller Import      |  16 h   |
| **1.3.4** Cron-Health-Check Route                    | `app/api/cron/nuliga-sync/route.ts`                                                | Heartbeat + Sentry-Monitor                                                                   | Bei 3 fehlgeschlagenen Versuchen → Slack/Email-Alert  |   4 h   |

**Gesamt:** ~36 h (~1 Woche Vollzeit)

---

### Epic 1.4 — Quick-Wins (Light-Mode, PWA-Install-Banner)

| Ticket                                   | Dateien                                                                 | Schritte                                                                                  | Akzeptanz                                     | Aufwand |
| ---------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------- | :-----: |
| **1.4.1** Light/Dark-Mode-Toggle         | `components/layout/theme-toggle.tsx` (neu), `app/layout.tsx` (Provider) | System-Preference + manuelle Override, persist via localStorage                           | Toggle sichtbar, beide Themes geprüft         |   8 h   |
| **1.4.2** PWA-Install-Banner für iOS     | `components/pwa-install-prompt.tsx` (erweitern), iOS-spezifischer Hint  | Inline-Banner mit Schritt-für-Schritt für iOS-Safari („Teilen → Zum Home-Bildschirm")     | Banner erscheint auf iOS, 1-Click auf Android |   8 h   |
| **1.4.3** Push-Opt-In Modal              | neu                                                                     | Onboarding-Zeitpunkt statt ungefragt                                                      | Opt-In-Rate messbar                           |   4 h   |
| **1.4.4** Matchmaking-Empty-State Polish | `components/ai/matchmaking-panel.tsx`                                   | Wenn 0 Kandidaten → „Trag dein Spiel-Level ein für bessere Matches" statt Still-Schweigen | Empty-State freundlicher                      |   2 h   |

**Gesamt:** ~22 h (~3 Tage Vollzeit)

---

### Epic F4 (aus altem Plan) — Mannschafts-Modul

> **KRITISCH:** Diese Tickets sind im alten `SWINGZ_UMSETZUNGSPLAN.md` definiert. Hier nur die Bestätigung, dass sie in Q1 priorisiert sind und vor ELO (Q2) fertig sein müssen.

| Ticket                                                      | Status               | Aufwand |
| ----------------------------------------------------------- | -------------------- | :-----: |
| **F4.1** Matchday-Aufstellung API + UI                      | (alt)                |  30 h   |
| **F4.2** Matchday-Ergebnis-Erfassung API + UI               | (alt)                |  30 h   |
| **F4.3** Heimspiel-Workflow + Bewirtung                     | (alt)                |  20 h   |
| **F4.4** Ämter-Flag „Mannschaftsführer" (A2 aus altem Plan) | Voraussetzung; (alt) |  16 h   |

**Erinnerung:** F4 ist Voraussetzung für ELO (Mannschafts-Matches müssen in SwingZ-ELO einfließen).
**Gesamt:** ~96 h (~2,5 Wochen Vollzeit)

---

### Epic F6 (aus altem Plan) — DSGVO-PII-Anonymisierung (Voraussetzung für Q2-Live-Tracking)

| Ticket                                                                    | Status | Aufwand |
| ------------------------------------------------------------------------- | ------ | :-----: |
| **F6.1** Anonymize-Service skelettieren                                   | (alt)  |   8 h   |
| **F6.2** PII-Mapping dokumentieren                                        | (alt)  |   4 h   |
| **F6.3** Audit-Eintrag bei Anonymisierung                                 | (alt)  |   4 h   |
| **F6.4** E2E-Test: User löschen → PII raus, Rechnungen pseudonymisiert da | (alt)  |   8 h   |

**Gesamt:** ~24 h (~3 Tage Vollzeit)

---

### Q1-Gesamt-Aufwand

```
Epic 1.0  Service-Audit           ~14 h
Epic 1.1  DB-Unify                ~36 h
Epic 1.2  KI-Premium              ~40 h
Epic 1.3  nuLiga-Hardening        ~36 h
Epic 1.4  Quick-Wins              ~22 h
Epic F4   Mannschafts-Modul       ~96 h  (3 Wochen Vollzeit)
Epic F6   DSGVO-Anonymisierung    ~24 h

Q1 SUMME  = ~268 h  ≈  7 Wochen Vollzeit für 1 Person
```

→ Realistisch als 3-Personen-Sprint in 3 Monaten: 90 h/Person/Monat = 270 h verfügbar pro Person. Knapp. **Empfehlung: 2-3 Devs in Vollzeit Q1.**

---

## 5. Q2 — B2C-Engagement & Smart Club (Monate 4–6)

### Epic 2.1 — Live-Match-Tracking

> **Voraussetzung:** F4 (Mannschafts-Modul) + F6 (DSGVO) abgeschlossen.

| Ticket                                             | Dateien                                                                 | Schritte                                                                                                                                                                                                               | Akzeptanz                              | Aufwand |
| -------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | :-----: |
| **2.1.1** DB-Schema `match_results` + `match_sets` | neue Migration `202609xx_match_results.sql`, Drizzle-Schema-Erweiterung | Felder: `season_id`, `club_id`, `match_type` (singles/doubles/internal/league), `player1_id`, `player2_id`, `winner_id`, `score_sets` JSONB, `duration_minutes`, `played_at`, `is_official` (bool, für ELO-Berechnung) | `tsc` grün, RLS-Policy                 |  12 h   |
| **2.1.2** POST `/api/matches` Route                | `app/api/matches/route.ts` (neu)                                        | Create mit Validation, winner_id aus score_sets abgeleitet, optional reference auf `league_match_id`                                                                                                                   | E2E-Test: Score 6:4 7:5 → winner=right |  12 h   |
| **2.1.3** Live-Match-Scoring-UI                    | `components/matches/live-score.tsx` (neu)                               | PWA-fähig am Platz: 2 Spieler auswählen → Sets tippen → Bestätigen                                                                                                                                                     | Funktioniert auf Mobile, offline-queue |  40 h   |
| **2.1.4** Match-History GET `/api/matches`         | `app/api/matches/route.ts` (erweitern), Filter pro Spieler              | Pagination, Sortierung                                                                                                                                                                                                 | E2E                                    |   8 h   |
| **2.1.5** Match-Completion Push                    | `lib/push-notification.service.ts` erweitern                            | An Gegner + Mitleser bei `is_official=true`                                                                                                                                                                            | Push auf Mobile + Browser              |   4 h   |

**Gesamt:** ~76 h (~2 Wochen Vollzeit)

---

### Epic 2.2 — ELO-System

> **Algorithmus-Entscheidung:** Start mit **vereinfachtem ELO** (K-Faktor 32, Decay-Rate optional). Glicko-2 ist rechenintensiv — falls Live-Performance-Anforderungen kommen, später upgraden. Im DB-Trigger für jedes `match_results` Insert wird `players.elo_rating` aktualisiert.

| Ticket                                     | Dateien                                                             | Schritte                                                                    | Akzeptanz                             | Aufwand |
| ------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------- | :-----: |
| **2.2.1** DB-Trigger für ELO-Update        | Migration neu, `lib/billing/dunning.service.ts`-style Dokumentation | Trigger auf `match_results` INSERT → `players` UPDATE                       | Trigger funktioniert, ELO konvergiert |  16 h   |
| **2.2.2** ELO-Anzeige im Member-Profil     | `components/member-profile.tsx`                                     | ELO + Verlauf (Sparkline)                                                   | Sparkline rendert                     |   8 h   |
| **2.2.3** E-Verbands-LK-Separation         | UI klar: „SwingZ-ELO vs. DTB-LK im Profil"                          | Klar getrennt                                                               | UI-Test                               |   4 h   |
| **2.2.4** Backing-Test für ELO-Algorithmus | `tests/unit/lib/elo.test.ts`                                        | Bekannte Szenarien: 1200 vs 1200 → Sieger 1216; 1600 vs 1200 → expected win | Tests grün                            |   8 h   |

**Gesamt:** ~36 h (~1 Woche Vollzeit)

---

### Epic 2.3 — Spieler-Profile v2 + Match-History

| Ticket                                            | Dateien                                                                  | Schritte                                     | Akzeptanz              | Aufwand |
| ------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- | ---------------------- | :-----: |
| **2.3.1** Profil-Page Mobile-First Redesign       | neu `app/(protected)/member/profile-v2/page.tsx` oder Refactor bestehend | Hero mit ELO + letzter Match + Badges inline | Mobile-Lighthouse > 90 |  16 h   |
| **2.3.2** Head-to-Head View                       | `components/matches/head-to-head.tsx` (neu)                              | Match-History zwischen 2 Spielern            | Funktioniert           |  12 h   |
| **2.3.3** Saison-Bilanz                           | Server-Aggregation in `app/(protected)/member/profile-v2/page.tsx`       | Wins/Losses pro Saison                       | Echtzeit-Data          |   8 h   |
| **2.3.4** „Fordern"-Button Inline in Open-Matches | `components/open-matches.tsx`                                            | Direkt-Challenge aus Liste                   | funktioniert           |   8 h   |

**Gesamt:** ~44 h (~1 Woche Vollzeit)

---

### Epic 2.4 — Capacitor Mobile App Wrapper

> **Risiko-Flag:** Apple App Store kann Capacitor-Webview-Apps ablehnen (Guideline 4.2.2). **Fallback:** PWA-First mit prominentem Install-Banner (Epic 1.4.2). Trotzdem versuchen — wenn rejected, PWA stärker pushen.

| Ticket                                     | Dateien                                                                              | Schritte                           | Akzeptanz          | Aufwand |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------- | ------------------ | :-----: |
| **2.4.1** Capacitor-Wrapper initialisieren | `npx cap init` → `capacitor.config.ts`, `package.json` Capacitor-Deps                | iOS + Android Targets konfiguriert | Builds lokal       |   8 h   |
| **2.4.2** Native Push-Bridge               | `@capacitor/push-notifications` Plugin, `lib/push-notification.service.ts` erweitern | Web-Push + APNS-Bridge             | Push kommt auf iOS |  24 h   |
| **2.4.3** App-Icons + Splash               | `resources/icon-only.png` etc.                                                       | Standard + Sport-Icons             | Brand-konform      |   4 h   |
| **2.4.4** App Store Listing                | AppStore-Connect + Play-Console Listings                                             | Texte, Screenshots, Pricing        | Listings live      |  12 h   |
| **2.4.5** Capacitor Build CI               | GitHub Action: Capacitor-Build → App Store TestFlight                                | Automatischer Testflight-Build     | CI-Workflow grün   |   8 h   |

**Gesamt:** ~56 h (~1,5 Wochen Vollzeit)
**Fallback bei App-Store-Rejection:** PWA-Strategie intensivieren, Install-Banner pushen, Push-VAPID-PWA push-only.

---

### Epic 2.5 — Marketing-Quick-Wins (Spieler-Engagement-Booster)

| Ticket                               | Dateien                                   | Schritte                                                        | Akzeptanz                | Aufwand |
| ------------------------------------ | ----------------------------------------- | --------------------------------------------------------------- | ------------------------ | :-----: |
| **2.5.1** Last-Minute-Alerts         | neu                                       | Bei Court-Storno → Push an Mitglieder mit „Platz frei jetzt!"   | Push firing funktioniert |  20 h   |
| **2.5.2** Inaktivitäts-Reaktivierung | Cron `app/api/cron/reactivation/route.ts` | User 14 Tage inaktiv → Push „Was spielst du heute?"             | E2E                      |  16 h   |
| **2.5.3** Newsletter-Wizard          | Admin-Tool zum Segment-Newsletter         | 3 vorgefertigte Templates (Geburtstag, Saison-Start, LK-Update) | UI + Send                |  24 h   |

**Gesamt:** ~60 h (~1,5 Wochen Vollzeit)

---

### Q2-Gesamt-Aufwand

```
Epic 2.1  Live-Match-Tracking    ~76 h
Epic 2.2  ELO-System             ~36 h
Epic 2.3  Spieler-Profile v2     ~44 h
Epic 2.4  Capacitor App           ~56 h  (oder Fallback PWA-Intensivierung)
Epic 2.5  Marketing-Wins         ~60 h

Q2 SUMME  = ~272 h
```

---

## 6. Q3 — Expansion & Platform (Monate 7–9)

### Epic 3.1 — Smart-Court API (B2B-Killerfeature)

| Ticket                                     | Dateien                                                     | Schritte                              | Akzeptanz                | Aufwand |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------- | ------------------------ | :-----: |
| **3.1.1** Hardware-Adapter-Interface       | `lib/hardware/adapter.ts` (neu)                             | Plugin-Pattern: Nuki, Shelly, Loxone  | Adapter-Tests grün       |  16 h   |
| **3.1.2** Buchung-zu-Hardware-Webhook      | `app/api/webhooks/booking-completed/route.ts`               | Bei Buchung-Start → Licht-Code pushen | Hardware-Integration E2E |  24 h   |
| **3.1.3** Smart-Court-Admin-UI             | `app/(protected)/admin/smart-court/page.tsx` (neu)          | Adapter-Konfiguration pro Court       | UI funktioniert          |  16 h   |
| **3.1.4** Smart-Court Premium-Pricing-Tier | `lib/features.ts`, `app/(protected)/owner/billing/page.tsx` | „Smart Club"-Bundle 79 € Add-On       | Stripe-Webhook getestet  |   8 h   |

**Gesamt:** ~64 h (~1,5 Wochen Vollzeit)

---

### Epic 3.3 (VERSCHOBEN von Q4) — Trainer-Marketplace MVP

> **Vorher Voraussetzung:** Community-Feed (Epic F) — sonst verhungert der Marktplatz. **Verschiebung auf Q4 empfohlen**, weil Community-Feed Q4 ist.

| Ticket                                | Status            |
| ------------------------------------- | ----------------- |
| 3.3.1 — Trainer-Slot-Erstellung       | verschoben auf Q4 |
| 3.3.2 — Stripe Connect Split-Payments | verschoben auf Q4 |
| 3.3.3 — Member-Marketplace-Browsing   | verschoben auf Q4 |
| 3.3.4 — Trainer-Profil in Marketplace | verschoben auf Q4 |

→ **Q4-Stadt statt Q3**, weil ohne Community-Feed kein Marktplatz-Traffic. Stattdessen in Q3:

- **3.0 Pricing-Tier-Update** (Pay-per-Member-Modell einführen, falls Q1/Q2 Renewals positiv)
- **3.4 Live-Match Scoring für Doppel** (Paar-Tippen statt Einzel-Tippen, hoher USP)
- **3.5 KI-Skill-Match** (KI empfiehlt „Diese Spieler passen zu dir, weil...")

---

### Epic 3 (Pricing-Tier-Update) — Q3 Zusatz

| Ticket                                   | Dateien                                           | Schritte                                            | Akzeptanz                     | Aufwand |
| ---------------------------------------- | ------------------------------------------------- | --------------------------------------------------- | ----------------------------- | :-----: |
| **3.6.1** Pay-per-Active-Member-Pricing  | `lib/stripe/`, `app/api/webhooks/stripe/route.ts` | Stripe Subscription Items für variable Member-Count | Stripe-Test grün              |  24 h   |
| **3.6.2** Pricing-Page Communication     | `app/landing/pricing/page.tsx`                    | Neue Tabelle: Starter/Pro + optional Add-Ons        | UI                            |   8 h   |
| **3.6.3** Owner-Billing-Dashboard Update | `app/(protected)/owner/billing/page.tsx`          | Member-Count Visible im Billing                     | Owner kann Kosten hochrechnen |   8 h   |

**Gesamt:** ~40 h (~1 Woche Vollzeit)

---

### Q3-Gesamt-Aufwand

```
Epic 3.1  Smart-Court API         ~64 h
Epic 3.6  Pricing-Tier-Update     ~40 h

Q3 SUMME  = ~152 h  (kompakter — Puffer für Unvorhergesehenes)
```

---

## 7. Querschnittlich (parallel zu allen Quartalen)

| ID     | Ticket                                                   | Aufwand | Quartal |
| ------ | -------------------------------------------------------- | :-----: | ------- |
| **B1** | Bundle-Analyzer CI-Integration                           |   8 h   | Q1      |
| **B2** | `next-intl`-Strategie klären (entfernen ODER aktivieren) |   4 h   | Q1      |
| **B3** | Service-Client-Audit-Dokumentation                       |   6 h   | Q1      |
| **B4** | Rate-Limiting auf Member-API-Routes (Anlehnung an A1)    |  16 h   | Q1      |
| **B5** | Sentry-Coverage Audit + Synthetic Test pro Quartal       |  8 h/Q  | Q1+     |
| **B6** | Quartals-Roadmap-Review mit Sales + 2 Vereins-Admins     | 12 h/Q  | Q1+     |
| **B7** | Decisions/Voting Sichtbarkeits-Boost + Demo-Video        |  16 h   | Q2      |
| **B8** | DSGVO-Audit-Trail für Lese-PII-Zugriffe (A4)             |  12 h   | Q2      |
| **B9** | Pen-Test vor Q2-Auslieferung (Live-Tracking)             |  24 h   | Q2      |

**Querschnitt-Summe Q1:** ~30 h
**Querschnitt-Summe Q2:** ~52 h

---

## 8. Reihenfolge & Abhängigkeiten (kritischer Pfad)

```
Q1 ─────────────────────────────────────────────────────────
M1  ▸ 1.0.1 Service-Audit-Report          (VOR ALLEM)
M1  ▸ F6 DSGVO-Anonymisierung             (VOR 2.1)
    ┌─────────────────────────────────┐
    │ F4.4 Ämter-Flag (A2)             │ (VOR F4.1–F4.3)
    │ ↓                               │
    │ F4.1–F4.3 Mannschafts-Modul      │ (VOR 2.2 ELO)
    └─────────────────────────────────┘
M1  ▸ 1.1.1–1.1.5 DB-Layer-Unify         (VOR 2.4 Capacitor)
M2  ▸ 1.3 nuLiga-Hardening                (VOR 2.2 ELO als Initial-Seed)
M2  ▸ 1.2 KI-Premium-Sichtbarkeit
M3  ▸ 1.4 Quick-Wins (Light-Mode, PWA-Banner)
M3  ▸ F4 (Mannschafts-Modul) + F6 (DSGVO) ✓ Abschluss Q1

Q2 ─────────────────────────────────────────────────────────
M4  ▸ 2.1.1–2.1.3 Live-Match-Tracking DB+API (VOR 2.2)
M4  ▸ 2.3.1 Spieler-Profile v2 sofort     (Reward-Loop)
M5  ▸ 2.2 ELO-System (vereinfachtes ELO)
M5  ▸ 2.3.2–2.3.4 Head-to-Head, Saison-Bilanz
M5  ▸ 2.4 Capacitor App (oder PWA-Intensivierung bei Rejection)
M6  ▸ 2.5 Marketing-Wins

Q3 ─────────────────────────────────────────────────────────
M8  ▸ 3.1 Smart-Court API
M8  ▸ 3.6 Pricing-Tier-Update
M9  ▸ Puffer / Q4-Vorbereitung:
       - Community-Feed (für Q4 Marketplace)
       - Live-Match-Scoring Doppel
```

**Kritischer Pfad zum ersten Renewal-förderlichen Wertbeitrag:**

```
1.0 → F6 → F4 → 1.1 → 2.1 → 2.2 → 2.3 → 2.4
~234 h = 3 Monate Vollzeit für 1 Senior Dev
```

Diese Sequenz ist die **Ein-Engineer-kann-das-liefern**-Route. Mehrere Devs = schnellere Parallelisierung der nicht-kritischen Pfade (1.2, 1.3, 1.4, 2.5).

---

## 9. Ticket-Schema (PRD-Vorlage)

Jedes Ticket im Plan folgt diesem Schema. Vor Implementation in `docs/tickets/<TicketID>.md`:

```markdown
# <TicketID>

## Ziel

(Wert-Versprechen in 1 Satz)

## Voraussetzungen

(IDs der Tickets die vorher fertig sein müssen)

## Geänderte/neue Dateien

(Liste mit Pfad + Schritte)

## Akzeptanzkriterien

(Tests + manuell sichtbar)

## Aufwand

(T-Shirt: S/M/L)

## Out-of-Scope

(Was bewusst nicht gemacht wird)
```

---

## 10. Definition of Done (DoD) — pro Ticket

1. ✅ `npx tsc --noEmit` → **0 Errors** (insbesondere in der geänderten Datei)
2. ✅ Mindestens 1 Unit-Test ODER 1 E2E-Test für nicht-triviale Logik
3. ✅ Deutsche UI-Texte, **Dark-Mode geprüft** (light/dark beide Screenshots)
4. ✅ RLS-Policy für neue Tabellen **vorhanden** in gleicher Migration
5. ✅ Sentry-Capture für unerwartete Errors in neuem Code-Pfad
6. ✅ Eintrag im entsprechenden Risiko-/Lücken-Punkt der [`docs/projekt_analyse.md`](./projekt_analyse.md) als „✅ erledigt Q1/Q2/Q3"
7. ✅ Wenn Feature für Mobile: PWA-Test ODER Capacitor-Smoke-Test
8. ✅ Changelog-Eintrag in `NEXT_SESSION.md` oder `CHANGELOG.md`

---

## 11. Erfolgsmetriken

| Metrik                                     |  Heute   |      Q1-Ziel      |   Q2-Ziel   |   Q3-Ziel   | Mess-Tool                            |
| ------------------------------------------ | :------: | :---------------: | :---------: | :---------: | ------------------------------------ |
| **WAM / Total Members**                    |  <15 %   |    unverändert    |  **>25 %**  |  **>40 %**  | Mixpanel/PostHog (zur Hälfte von Q2) |
| **Match-Inputs / Woche (Plattform)**       |    0     | 0 (kein Tracking) |  **>500**   | **>1.500**  | Postgres-Query                       |
| **B2B-Clubs auf Professional-Tier**        | (unbek.) |     **30 %**      |  **45 %**   |  **60 %**   | Stripe-Dashboard                     |
| **Push-Opt-In-Rate**                       |  <10 %   |     **>30 %**     |  **>50 %**  |  **>70 %**  | `push_subscriptions` COUNT           |
| **nuLiga-Sync-Erfolgsquote**               | unstabil |     **>98 %**     |  **>99 %**  | **>99.5 %** | Sentry-Monitor + Counter             |
| **DSGVO-Löschanfragen / Quartal**          | manuell  |      manuell      |   **<2**    |   **<2**    | Audit-Log                            |
| **Avg. App-Render-Time (Admin Dashboard)** | 1,2–2 s  |      <1,0 s       |   <800 ms   |   <600 ms   | Vercel Analytics                     |
| **App Store Rating (Capacitor-Wrapper)**   |   n/a    |        n/a        | **>3.8** ⭐ | **>4.2** ⭐ | App Store Connect                    |

**Quartals-Reviews** (alle 12 Wochen): WAM, Push-Rate, Renewal-Rate, Sentry-Error-Budget, Road-Adjustments.

---

## 12. Risiken & Fallback-Strategien

| Risiko                                                                         | Wahrscheinlichkeit |            Impact             | Fallback                                                                                                     |
| ------------------------------------------------------------------------------ | :----------------: | :---------------------------: | ------------------------------------------------------------------------------------------------------------ |
| **Apple App Store lehnt Capacitor-Webview ab** (Guideline 4.2.2)               |    Mittel-Hoch     |  Hoch (Q2-Release blockiert)  | PWA-First: Install-Banner aggressiv, VAPID-Push forcieren, „Add to Home Screen" Coach-Marks                  |
| **nuLiga blockt Scraper** (Bot-Detection, IP-Ban, SPA-Umbau)                   |       Mittel       | Hoch (ELO ohne Initial-Seed)  | CSV-Manual-Import UI in Q1.3.3 (bereits eingeplant)                                                          |
| **Drizzle ↔ Supabase Drift lässt sich nicht auflösen** (>60 fehlende Tabellen) |       Mittel       |            Mittel             | Supabase TypeScript-Generator als SSOT für Read-Paths; Drizzle nur für Mutations-Transaktionen               |
| **Stripe-Webhook-Fail bei Pricing-Tier-Update** (Q3.6)                         |   Niedrig-Mittel   |            Mittel             | Feature-Flag für Pricing-Update — Pilot-Vereine first, dann Rollout                                          |
| **F4 Mannschafts-Modul verzögert → Q2 ELO verschoben**                         |       Mittel       |            Mittel             | ELO startet mit „nur Internal Matches"; Liga-Matches später                                                  |
| **WAM-Metrik zeigt: Mitglieder öffnen App trotz ELO + Live-Scoring nicht**     |   Niedrig-Mittel   | Hoch (B2C-Strategie fraglich) | Hard-Pivot zu „Verwaltungs-Super-Charge" — Pack mehr in Admins (KI-Assistent für Rechnungen, Mahn-Workflows) |
| **2.5 Marketing-Tooling triggert User-Frust** (zu viele Pushes)                |       Mittel       |     Mittel (neg. Reviews)     | Opt-Out prominent, Frequenz-Cap (max 1 Push/Tag), Engagement-basierte Throttling                             |

---

## 13. Bezug zum alten `SWINGZ_UMSETZUNGSPLAN.md`

Dieser Plan ist **komplementär** — nicht überschreibend. Die folgenden Tickets aus dem alten Plan bleiben gültig und sind teilweise in Q1 priorisiert:

| Alt-Ticket                       | In neuem Plan                                                |
| -------------------------------- | ------------------------------------------------------------ |
| **F1 DATEV-CSV-Export**          | bleibt eigenständig — vor Q1 abgeschlossen (kann Q1 starten) |
| **F2 Übungsleiterpauschale**     | bleibt eigenständig — vor Q1 abgeschlossen                   |
| **F3 GoBD-Doku**                 | bleibt eigenständig — vor Q1 abgeschlossen                   |
| **F4 Mannschafts-Modul**         | **Q1 Prio** (Voraussetzung für ELO in Q2)                    |
| **F5 Turnier-Auslosung**         | bleibt eigenständig — Q1/Q2 konzeptuell                      |
| **F6 DSGVO-Anonymisierung**      | **Q1 Prio** (Voraussetzung für Q2 Live-Match-Tracking)       |
| **F7 Drizzle-Schema-Drift**      | **Epic 1.1** (deckt sich)                                    |
| **F8 SMS/WhatsApp**              | bleibt eigenständig — Q3/Q4                                  |
| **F9 LK-Berechnung**             | ist Teil von **Epic 1.3 + 2.2**                              |
| **F10 Wallet-Pass**              | bleibt eigenständig — Q3                                     |
| **F11 Echte Job-Queue**          | bleibt eigenständig — Q3+                                    |
| **F12 Churn-Prediction**         | bleibt eigenständig — Q3+                                    |
| **A1 Rate-Limit zentralisieren** | **B4** (querschnittlich Q1)                                  |
| **A2 Ämterbasierte Permissions** | **F4.4** (Mannschaftsführer-Flag)                            |
| **A3 nuLiga-Adapter härten**     | **Epic 1.3** (deckt sich)                                    |
| **A4 DSGVO-Read-Audit-Trail**    | **B8** (querschnittlich Q2)                                  |

→ **Kein Konflikt.** Der alte Plan ist die Compliance-/Mannschaftsführer-Perspektive; dieser Plan ist die KI-/B2C-Engagement-Perspektive. Beide laufen parallel.

---

## 14. Rollout-Strategie & Operations

**Pro Quartal:**

1. **Woche 1–2:** Tickets fertig implementieren, TypeScript + Tests grün
2. **Woche 3:** Pilot-Verein (z.B. TC Rheinland) für Live-Test, Feedback-Session
3. **Woche 4:** Allgemeiner Rollout an alle B2B-Vereine mit Newsletter + In-App-Banner

**Pro Sprint (2 Wochen):**

- Mo: Sprint-Planning (Tickets aus diesem Plan picken, gemäß Reihenfolge)
- Mi: Mid-Sprint-Sync, Blocker-Check
- Fr: Sprint-Demo für Stakeholder (Sales + 2 Vereins-Admins)

**Vor jedem Release:**

- Staging-Deploy auf Vercel Preview
- Sentry-Smoke-Test (Test-Error → Sentry-Dashboard Event)
- Lighthouse-Check (Performance >85, A11y >90)
- DB-Migrations-Backup-Snapshot manuell verifiziert

---

## 15. Definition-of-Success (9-Monats-Horizont)

**Wenn wir 9 Monate durchziehen, sollten wir können:**

- **Behaupten:** „SwingZ-Mitglieder loggen sich 3-4× pro Woche ein, um ihr ELO, ihre Match-Historie und offene Herausforderungen zu sehen."
- **Zahlen vorlegen:**
  - WAM/Total > 40 %
  - > 1.500 Match-Inputs/Woche
  - 60 % B2B-Clubs auf Professional-Tier
  - Padel-Buchungen existieren
  - Erster Smart-Court-Verein ist live
- **Strategisch:** Position als „KI-Plattform für Tennis-Vereine in DACH" etabliert, bereit für Series-A-Pitch mit Engagement-Daten.

**Wenn nicht:**

- Fokus-Diagnose: Welche der 8 Erfolgsmetriken ist am schwächsten → Epic-Refokussierung in Q4.

---

> **Letzte Aktualisierung:** 25.06.2026
> **Owner dieses Plans:** SwingZ-Engineering-Team
> **Reviewer:** Sales + 2 Pilot-Vereins-Admins pro Quartal
> **Nächste Aktualisierung:** Nach Q1-Review (September 2026)
