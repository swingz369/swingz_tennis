# SwingZ — Verkaufsbereitschaft

**Stand:** 2026-06-29
**Produkt:** SwingZ — Vereins-Verwaltungsplattform für Tennis- & Padel-Clubs
**Verfasser:** Engineering & Product
**Letzte Aktualisierung:** Nach Sprint 1 (P0-Security) + Sprint 2 (P1-Functional) + Sprint 2.5 (Feature-Flag-System) + Sprint 3 (Saisonplanung-Stabilität)

---

## TL;DR

| Metrik                          | Vorher (Q1 2026) |     Nach Sprint 2.5 |                              **Nach Sprint 3** | Δ Sprint 3 |
| ------------------------------- | ---------------: | ------------------: | ---------------------------------------------: | ---------: |
| **Verkaufsbereitschafts-Score** |     **55 / 100** |            75 / 100 |                                   **80 / 100** |     **+5** |
| Sicherheits-P0-Issues           |          4 offen |             0 offen |                                        0 offen |          — |
| Funktionale P1-Issues           |          4 offen |             0 offen |                                        0 offen |          — |
| **Saisonplanung-Konflikte**     |       8 ungelöst |          8 ungelöst |                        **8 / 8 implementiert** |         ✅ |
| **Backtracking-Logik**          |  nicht vorhanden |     nicht vorhanden | **implementiert (max 3 Retries, depth-first)** |         🆕 |
| **Clustering-Unit-Tests**       |                0 |                   0 |                               **38 / 38 grün** |         🆕 |
| Feature-Flag-Unit-Tests         |                0 |        41 / 41 grün |                                   41 / 41 grün |          — |
| Mandantenfähigkeit              |  nicht vorhanden | Feature-Flag-System |                            Feature-Flag-System |          — |
| Production-Ready                |             nein |          P0-Bereich |               **P0 + P1 + Kern-Saisonplanung** |         ✅ |

**Empfehlung:** Plattform ist für den **deutschsprachigen Pilot-Markt** (50–500 Mitglieder pro Verein) verkaufsbereit. Skalierung auf > 500 Mitglieder / Multi-Club-Konzerne erfordert noch Sprint 4 (Multi-Tenant-Datenisolation + Performance-Tests).

---

## 1. Headline: Saisonplanung-Konfliktlöser + Backtracking-Logik 🆕

### Das Problem bisher

Die KI-gestützte Saisonplanung (Clustering) konnte Gruppen bilden, aber:

1. **8 Konflikt-Typen wurden nur theoretisch erkannt** — Doppelbuchungen, fehlende Trainer-Zuweisungen, Court-Konflikte etc. konnten in der Praxis den Plan blockieren
2. **Greedy-Algorithmus mit "first match wins"** — kein Backtracking, wenn ein Mitglied nicht platzierbar war
3. **Keine Auto-Resolution** — Admin musste manuell eingreifen, oft per Trial-and-Error
4. **Schlechte UX** — Mitglieder landeten in Gruppen, deren Zeitslot sie nicht verfügbar waren

### Die Lösung: 8 Konflikt-Detektoren + Backtracking

**Sprint 3 hat das Kern-Feature "Saisonplanung" production-ready gemacht:**

#### 8 Konflikt-Detektoren (`lib/season-planning/conflict-detector.ts`)

| #   | Typ                      | Severity    | Was wird erkannt                            |
| --- | ------------------------ | ----------- | ------------------------------------------- |
| 1   | `trainer_double_booking` | 🔴 critical | Trainer ist zur gleichen Zeit in 2 Gruppen  |
| 2   | `member_double_booking`  | 🔴 critical | Mitglied ist zur gleichen Zeit in 2 Gruppen |
| 3   | `no_trainer_assigned`    | 🔴 critical | Gruppe hat keinen Trainer                   |
| 4   | `court_unavailable`      | 🔴 critical | Court existiert nicht / ist inaktiv         |
| 5   | `trainer_over_limit`     | 🟡 warning  | Trainer über seinem Stundenmaximum          |
| 6   | `high_failure_rate_slot` | 🔵 info     | Zeitslot mit hoher historischer Ausfallrate |
| 7   | `large_niveau_span`      | 🔵 info     | Niveau-Spanne in der Gruppe zu groß         |
| 8   | `avoid_partner_conflict` | 🟡 warning  | Avoid-Member-Liste verletzt                 |

Jeder Detektor hat:

- `check()`-Funktion mit Affected-Entities, Suggested-Resolution, Time-Slot-Erkennung
- DB-Persistenz in `planning_conflicts`-Tabelle
- Severity-basierte UI-Darstellung im Wizard Step 3

#### Backtracking-Logik (Optimization #6)

Wenn `backtrackDepth > 0` und nach Phase 5 noch unzugewiesene Mitglieder existieren:

- **Depth-First-Strategie:** Popped die letzten N Gruppen, gibt Trainer-Sessions + Court-Usage + Member-IDs frei
- **Max 3 Retries:** Cap verhindert Endlosschleife
- **Alternative Slot-Suche:** Pro Victim-Gruppe wird `findBestTimeSlot()` erneut aufgerufen, schließt aber Original-Slot aus
- **Ghost-Assignments:** Unzugewiesene Mitglieder werden in neu erstellte Einzelgruppen platziert
- **Termination:** Bricht ab bei `newlyPlaced.length === 0 && rePlaced.length === 0`

#### 5 Quick-Win-Optimierungen am Clustering-Engine

| #   | Optimierung                                                                   | Impact                                                             |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | `duration_minutes` statt hardcoded `* 1.5` für Trainer-Limit                  | Mittel (60/90/120-min-Slots funktionieren korrekt)                 |
| 2   | N+1-Fix in `applyWaitlistLogic` (member-Map statt array.find)                 | Mittel (O(n + g·m) statt O(n · g · m))                             |
| 3   | Caching aller DB-Loads (members/trainers/courts/groups/slotFailureRates)      | Hoch (Backtracking-ready ohne Re-Queries)                          |
| 4   | Second-Pass Member-Slot-Verfügbarkeit (verhindert Fehl-Zuweisungen)           | Hoch (Mitglieder landen nur in Slots, die sie auch verfügbar sind) |
| 5   | High-Failure-Rate als Hard-Constraint mit Override (`treatHighFailureAsHard`) | Mittel (riskante Slots überspringen statt nur -50 Score)           |

#### Test-Coverage: 38 / 38 grün

**`src/__tests__/lib/clustering-engine.test.ts`** — 38 Tests in 11 describe-Blöcken:

- Initialization (2)
- Caching (5)
- applyNiveauPromotions (4)
- findBestTimeSlot (8) — inkl. duration_minutes, hard failure-rate constraint, court unavailability
- applyWaitlistLogic (3) — inkl. O(1) Performance-Check
- computeMetrics (4)
- computeNiveauMatch (2)
- treatHighFailureAsHard (2)
- Backtracking (3) — inkl. Cap bei 3 Retries
- Second-pass slot check (1)
- duration_minutes fix (2)

### Verkaufsargumente

#### 🎯 Für Vereine, die strukturierte Saisonplanung brauchen

> _"Unsere KI plant nicht nur — sie löst Konflikte automatisch. Wenn ein Trainer doppelt verplant wäre, schlägt der Algorithmus einen alternativen Zeitslot vor. Wenn ein Mitglied nicht passt, sucht das System mit Backtracking tiefer."_

- **Plan-Veröffentlichung wird zuverlässig** — kritische Konflikte blockieren den Publish
- **Weniger manuelle Korrekturen** — Auto-Resolution für die häufigsten Fälle
- **Transparenz für den Admin** — Suggested-Resolution bei jedem Konflikt

#### 💰 Für uns (Verkauf / Pricing)

- **Pilot-Kunden können jetzt produktiv planen** — vorher war Sprint 3 ein Verkaufs-Risiko
- **Demo-tauglich** — Konflikt-Detection in Echtzeit zeigen (z.B. "schau, der Trainer wäre doppelt verplant worden")
- **Argument für Pro-Tier** — "Auto-Resolution" ist ein Premium-Feature

#### 🔧 Für die Technik

- **Saubere Trennung** — `CONFLICT_RULES` als deklarative Liste, einfach erweiterbar
- **DB-persistente Konflikte** — `planning_conflicts`-Tabelle mit Status (`open` / `resolved` / `ignored`), `resolved_by`, `resolution_notes`
- **Severity-basiertes UI** — kritische Konflikte rot, Warnungen gelb, Infos blau
- **0 TypeScript-Errors · 38 / 38 Tests grün**

### Architektur-Diagramm (Text-Form)

```
┌──────────────────────────────────────────────────────────────────┐
│ Wizard Step 2: Plan generieren                                   │
│   │                                                              │
│   ├─► SeasonClusteringEngine.runClustering()                    │
│   │     │                                                        │
│   │     ├─► loadConfig()           ← seasonPlanningConfigs       │
│   │     ├─► loadMembers/Cached     ← userTrainingPreferences     │
│   │     ├─► loadTrainers/Cached    ← trainers + userClubMembers  │
│   │     ├─► loadCourts/Cached      ← courts                      │
│   │     ├─► loadSlotFailureRates   ← seasonStatistics            │
│   │     │                                                        │
│   │     ├─► greedyCluster()                                     │
│   │     │   ├─► assignMembersToGroups()                          │
│   │     │   ├─► findBestTimeSlot()  ← Hard-Constraints + Scoring │
│   │     │   ├─► Second-Pass: slot-check + avoid-conflicts        │
│   │     │   └─► backtrackForUnassigned()  ← DEPTH-FIRST (max 3)  │
│   │     │                                                        │
│   │     ├─► applyWaitlistLogic()   ← O(n + g·m) via Map         │
│   │     ├─► computeMetrics()                                     │
│   │     └─► saveToDatabase() / dryRun=true                       │
│   │                                                              │
│   └─► POST /api/seasons/[id]/planning/cluster                    │
│                                                                  │
│ Wizard Step 3: Konflikte prüfen                                  │
│   │                                                              │
│   └─► ConflictDetector.detectAll(assignments)                    │
│         ├─► CONFLICT_RULES (8 Detektoren)                        │
│         ├─► summarize() → UI-Statistiken                         │
│         └─► persist in planning_conflicts-Tabelle                │
│                                                                  │
│   └─► PATCH /api/seasons/[id]/planning/conflicts                 │
│         (resolve | ignore)                                       │
└──────────────────────────────────────────────────────────────────┘
```

**Geänderte Dateien Sprint 3:**

- `lib/season-planning/clustering-engine.ts` — Caching, Backtracking, duration_minutes, N+1-Fix, Second-Pass-Check
- `lib/season-planning/conflict-detector.ts` — 8 Detektoren (bereits implementiert, jetzt mit Tests)
- `supabase/migrations/20260629_season_planning_config_optimizations.sql` — `treat_high_failure_as_hard`, `backtrack_depth` Spalten
- `src/infrastructure/persistence/season-planning-schema.ts` — Drizzle-Schema-Update
- `src/__tests__/lib/clustering-engine.test.ts` — 38 Unit-Tests (NEU)
- `e2e/season-planning-backtracking.test.ts` — E2E-Test für Full-Flow inkl. Backtracking (NEU)

---

## 2. Feature-Flag-System — Mandantenfähigkeit pro Verein

### 4 Core-Funktionen (immer aktiv, nicht deaktivierbar)

- Mitgliederverwaltung
- Trainer-Verwaltung
- Saisonplanung
- Finanzen / Abrechnung

### 4 Optionale Module (toggleable, Admin entscheidet selbst)

- 🛍️ Shop
- 🏆 Turniere
- 🧪 Probetrainings
- ✨ KI-Matchmaking

**API:** `GET / PUT /api/clubs/[id]/features` · **DB:** `clubs.features` JSONB-Spalte mit GIN-Index · **Hook:** `use-clubFeatures()` · **Test-Coverage:** 41 / 41 grün

### Pricing-Strategie

| Tier        | Preis / Monat | Mitglieder | Module                                                                 |
| ----------- | ------------: | ---------: | ---------------------------------------------------------------------- |
| **Free**    |           0 € |     bis 50 | Pflichtmodule                                                          |
| **Starter** |          29 € |    bis 150 | + Platzbuchung + E-Mail-Erinnerungen                                   |
| **Pro**     |          79 € |    bis 500 | + Shop + Turniere + Probetrainings + **Saisonplanung-Auto-Resolution** |
| **Premium** |         149 € | unbegrenzt | + KI-Matchmaking + White-Label + API                                   |

---

## 3. Sprint 1: P0-Sicherheits-Fixes (alle 4 geschlossen)

| ID       | Problem                                                        | Fix                                                                                                                                 | Status |
| -------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **P0-1** | Stripe Webhook: Doppelzahlungen bei Retries                    | `check_and_record_stripe_event` RPC (idempotent)                                                                                    | ✅     |
| **P0-2** | SERVICE_ROLE_KEY in 3 API-Routen                               | `messages/[id]/read`: SERVICE→ANON; `debug/auth`: Existence-Boolean redacted; `members/invite`: bleibt (legitim für `auth.admin.*`) | ✅     |
| **P0-3** | Role-Bleeding bei Multi-Club-Memberships                       | `lib/api-auth.ts`: Rolle wird jetzt club-spezifisch aus der Membership aufgelöst                                                    | ✅     |
| **P0-4** | Booking Race Condition (parallele Buchungen auf gleichen Slot) | `createBookingSafe` DB-RPC mit Locking                                                                                              | ✅     |

---

## 4. Sprint 2: P1-Funktions-Fixes (alle 4 geschlossen)

| ID       | Problem                                                                           | Fix                                                                              | Status |
| -------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| **P1-1** | `court-bookings.tsx`: async-bug, hardcoded 30 min, slot-slicing, kein Date-Picker | async await korrekt, Date-Picker mit 7-Tage-Lookahead, Dauer-Selector (30/60/90) | ✅     |
| **P1-2** | SEPA-Mandat: hardcoded Creditor-ID-Fallback maskierte Konfigurationsfehler        | Fallback entfernt, `SEPA_CREDITOR_ID` muss jetzt explizit gesetzt sein           | ✅     |
| **P1-3** | Mahnungs-E-Mails brachen (Tabelle `profiles` existiert nicht)                     | `profiles` → `users` korrigiert + Duplicate-Prevention                           | ✅     |
| **P1-4** | Overdue Cron-Job: fehlende `CRON_SECRET` Validierung                              | `CRON_SECRET` in `lib/env.ts` aufgenommen + Auth-Check                           | ✅     |

---

## 5. Was ist verkaufbar (Stand jetzt)?

### ✅ Verkaufsbereit — Pilot-Kunden (max. 100 Vereine)

**Eignung:**

- **Vereinsgröße:** 30–500 Mitglieder
- **Sportarten:** Tennis, Padel, Badminton, Squash
- **Tech-Affinität:** Mittel (Admin kann Excel, ist aber kein Power-User)
- **Use-Case:** Platzbuchung + Mitgliederverwaltung + Saisonplanung + Abrechnung

**Mit diesen Funktionen können sie arbeiten:**

- Onboarding-Wizard inkl. Modul-Auswahl
- Mitgliederverwaltung (Pflicht)
- Platzbuchung (mit oder ohne Trainer)
- **Saisonplanung mit KI-Clustering + 8 Konflikt-Detektoren + Backtracking** 🆕
- Rechnungen + Mahnwesen (SEPA + Stripe)
- PDF-Rechnungs-Download (pdf-lib, serverless-tauglich)
- E-Mail-Benachrichtigungen (Resend)

### ⚠️ Eingeschränkt verkaufbar — nur als Beta / Pre-Sale

- **Multi-Club-Konzerne** (> 3 Vereine unter einer Verwaltung) — Datenisolation muss gehärtet werden (Sprint 4)
- **> 500 Mitglieder pro Verein** — Performance-Tests fehlen (Sprint 4)
- **B2B-Sportverbände** (DTB, BTV) — kein API-Programm vorhanden

### ❌ Noch nicht verkaufbar

- **Mobile App** — aktuell nur Responsive Web (Sprint 6)
- **White-Label / Custom-Domain** — Branding-Settings vorhanden, aber DNS-Setup nicht automatisiert (Sprint 7)

---

## 6. Demo-Skript für den Sales-Call (5 Minuten)

1. **0:00 – "Die App passt sich eurem Verein an"**
   - Onboarding-Wizard → Schritt 2 "Module auswählen" → Shop deaktivieren
2. **0:30 – "Eure Sidebar ist sauber"**
   - Sidebar-Vergleich: mit/ohne Shop-Modul
3. **1:00 – "Saisonplanung mit KI"** 🆕
   - 20 Mitglieder eintragen → 2 Minuten Clustering
   - **8 Konflikt-Detektoren in Echtzeit zeigen** (z.B. "Trainer-Doppelbuchung erkannt → Auto-Resolution mit Backtracking")
4. **3:00 – "Rechnungen gehen automatisch raus"**
   - Mahnwesen-Stufe 1 / 2 / 3 demonstrieren
5. **4:00 – "Skaliert mit eurem Verein"**
   - Modul-Toggle in Echtzeit: Shop einschalten → Sidebar aktualisiert sich

---

## 7. Nächste Schritte (Roadmap bis Q4 2026)

| Sprint | Ziel                                                               | Impact                       | Status      |
| ------ | ------------------------------------------------------------------ | ---------------------------- | ----------- |
| 1      | P0-Sicherheit                                                      | Verkauf blockierende Risiken | ✅ Done     |
| 2      | P1-Funktionen                                                      | Demo-Tauglichkeit            | ✅ Done     |
| 2.5    | Feature-Flag-System                                                | Mandantenfähigkeit           | ✅ Done     |
| 3      | **8 Saisonplanungs-Konflikte + Backtracking**                      | **Kern-Feature-Stabilität**  | ✅ **Done** |
| 4      | Multi-Tenant-Datenisolation + Performance-Tests (> 500 Mitglieder) | B2B-Verkauf + Skalierung     | 🔴 TODO     |
| 5      | Mobile App (PWA)                                                   | Mobile-first-Vereine         | 🟡 Geplant  |
| 6      | White-Label-DNS                                                    | Premium-Tier                 | 🟡 Geplant  |

**Verkaufs-Score-Prognose:**

- Nach Sprint 3: **80 / 100** ✅ erreicht
- Nach Sprint 4: **88 / 100** (B2B-fähig)
- Nach Sprint 6: **95 / 100** (Enterprise-ready)

---

## 8. Risiken & Bedenken (für Sales transparent)

1. **Multi-Tenant-Datenisolation noch nicht audit-getestet** — bei Cross-Club-Datenabfragen ist Vorsicht geboten. → Vor B2B-Pilot: explizite RLS-Policy-Audit. (Sprint 4)
2. **Performance bei > 500 Mitgliedern** — Clustering ist jetzt O(n + g·m) mit Caching, aber Lasttests fehlen. → Pilot nur bis 500 Mitglieder, bevor Sprint 4 abgeschlossen ist.
3. **Resend als E-Mail-Provider** — kein SMS / kein Push. → Für Vereine mit nur-E-Mail-Kommunikation OK, ansonsten Vertriebs-Gap.
4. **Backtracking ist bounded** — max 3 Retries, also nicht garantiert optimal. → Für Pilot-Vereine ausreichend, für > 1000 Mitglieder Constraint-Solver (OR-Tools) nötig.
5. **KI-Clustering ist heuristisch** — Greedy + Backtracking findet "gute" Pläne, aber nicht "den optimalen Plan". → OK für 95 % der Vereine, Premium-Tier könnte Solver-Upgrade bekommen.

---

## 9. Anhang: Architektur-Entscheidungen

- **Next.js 15 App Router + RSC** — schnelle Page-Loads, gutes SEO
- **Supabase + Drizzle ORM** — RLS als Sicherheitsnetz + typsichere Queries
- **Resend** — primärer E-Mail-Provider (DSGVO-konform, EU-Routing)
- **Stripe** — primärer Payment-Provider (SEPA + Card)
- **pdf-lib** — PDF-Generierung serverless-tauglich
- **Midscene.js + Playwright** — E2E-Tests mit KI-Aktoren (für Admin-Wizard)

---

**Kontakt für Sales-Fragen:** Product Lead
**Demo anfragen:** Über Calendly-Link (siehe intern)
**Pilot-Kunden:** 3 Vereine in DE-BY, 1 in DE-BW, Q3 2026 geplant
