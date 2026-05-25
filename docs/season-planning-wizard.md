# Season Planning Wizard — Architektur-Dokumentation

## Übersicht

Der Season-Planning-Wizard ist ein 3-stufiger, KI-gestützter Planungsassistent für die Saisonplanung im Tennisclub-Management. Admins durchlaufen einen linearen Wizard, der Mitgliederauswahl, Algorithmus-basierte Gruppenzuteilung und Konfliktprüfung/Veröffentlichung umfasst.

**Aufruf:** `/admin/seasons/[id]/planning`  
**Zugriff:** Nur Admin & Superadmin des jeweiligen Clubs  
**Technologie-Stack:** Next.js App Router, React (Client Components), Drizzle ORM, Supabase, Resend (Emails)

---

## Wizard-Struktur (3 Steps)

```
┌─────────────────────────────────────────────────────────┐
│                    WIZARD LAYOUT                         │
│  ┌──────┐  ┌──────┐  ┌──────┐                           │
│  │  1   │  │  2   │  │  3   │  ← Step Navigation        │
│  │Konfig│  │Planen│  │Abschl│                           │
│  └──────┘  └──────┘  └──────┘                           │
│  ████████████░░░░░░░░░░░░░░░░  ← Progress Bar            │
│                                                         │
│  ┌─────────────────────────────────────┐                │
│  │         STEP CONTENT                │                │
│  │  (switches per currentStep)         │                │
│  └─────────────────────────────────────┘                │
│                                                         │
│  [← Zurück]                    [Weiter →]  ← Navigation │
└─────────────────────────────────────────────────────────┘
```

Die Step-Navigation zeigt:
- **Aktiv** (blau mit Shadow): aktueller Step
- **Abgeschlossen** (grün mit Häkchen): vorherige Steps — klickbar
- **Deaktiviert** (grau): zukünftige Steps — nicht klickbar

Das `maxReachedStep`-Tracking verhindert Überspringen von Steps.

---

## Schritt 1: Konfigurieren (`ConfigStep`)

### Komponenten

| Komponente | Datei | Funktion |
|------------|-------|----------|
| `ConfigStep` | `steps/config-step.tsx` | Container: Readiness + Config + MemberSelector |
| `ScheduleReadinessCheck` | `lib/season-planning/readiness-check.tsx` | Prüft, ob alle Voraussetzungen erfüllt sind |
| `MemberSelector` | `steps/member-selector.tsx` | Mitgliedertabelle mit Filter, Checkboxen, Höherstufungen |

### Ablauf

1. **Readiness Check** — automatische Prüfung beim Rendern:
   - Mitglieder mit Präferenzen vorhanden?
   - Trainer-Verfügbarkeiten erfasst?
   - Courts konfiguriert?
   - Setzt `state.isReady = true/false` → steuert "Weiter"-Button

2. **Planungseinstellungen** (Card mit 6 Input-Feldern):
   ```
   groupMaxSize:           2–10   (default: 6)
   groupMinSize:           1–6    (default: 3)
   trainerUtilizationMaxPct: 50–100 (default: 80)
   maxNiveauSpanBeginner:  1–4    (default: 2)
   maxNiveauSpanAdvanced:  1–4    (default: 2)
   slotFailureThreshold:   10–80  (default: 30)
   ```
   + Checkboxen: Historische Gruppen bevorzugen, Hohe Ausfallraten vermeiden
   + **Auto-Plan-Optionen:** Max. Iterationen (100–5000), Optimierungsziele (Konflikte, Trainer-Last, Präferenzen), KI-Optimierung (OpenAI), Überbuchung, Konsistente Zeitslots

3. **Mitgliederauswahl** (`MemberSelector`):
   - `GET /api/seasons/[id]/planning/members` — lädt alle Club-Mitglieder mit:
     - Skill-Level, Erfahrung, Anwesenheitsquote
     - Höherstufungen (Trainer-Feedback aus Vorsaison)
     - Wartelisten-Carryovers
   - Tabellenansicht mit Filtern (Suche, Skill-Level, Nur Eingeplante)
   - Checkboxen für Ein-/Ausschluss → `dispatch(SELECT_MEMBERS)`
   - Alle standardmäßig vorselektiert

### State-Änderungen in Step 1

```typescript
dispatch({ type: 'SET_READY', isReady })           // Readiness
dispatch({ type: 'SET_PLANNING_CONFIG', config })   // Einstellungen
dispatch({ type: 'SELECT_MEMBERS', memberIds, ... }) // Mitglieder
```

### API Call

| Route | Method | Zweck |
|-------|--------|-------|
| `/api/seasons/[id]/planning/members` | GET | Mitgliederliste + Höherstufungen + Warteliste laden |

---

## Schritt 2: Planen & Bearbeiten (`PlanEditStep`)

### Komponenten

| Komponente | Datei | Funktion |
|------------|-------|----------|
| `PlanEditStep` | `steps/plan-edit-step.tsx` | Container: Generate + Metrics + ScheduleGrid + AI |
| `ScheduleGrid` | `lib/season-planning/schedule-grid.tsx` | Drag & Drop Wochenstundenplan (Zeilen = Tage, Spalten = Zeit) |
| `GroupListView` | `lib/season-planning/group-list-view.tsx` | Listenansicht der Gruppen mit Mitglieder-Detail |
| `useSchedulePlan` | `lib/season-planning/use-schedule-plan.ts` | Hook für DnD-State (dragging, dragOver, drop, moveMember) |
| `generateAIAnalysis` | `lib/season-planning/ai-analysis.ts` | Optionale KI-Bewertung des Plans (OpenAI) |

### Ablauf

1. **Plan generieren** — Button ruft `runClustering()` aus WizardContext:
   ```
   POST /api/seasons/[id]/planning/cluster
   Body: { seasonId, config: WizardState.planningConfig, dryRun }
   ```
   → `SeasonClusteringEngine.runClustering()` wird serverseitig ausgeführt

2. **Clustering-Engine** (`lib/season-planning/clustering-engine.ts`) — 9 Schritte:
   ```
   Step 0: loadConfig()          — DB-Config laden (überschreibt Defaults)
   Step 1: loadMembers()         — Mitglieder mit Präferenzen + Trainer-Feedback
            loadTrainers()        — Trainer mit Verfügbarkeiten
            loadCourts()          — Aktive Courts
            loadGroups()          — Bestehende Gruppen
            loadSlotFailureRates()— Historische Ausfallraten
            loadHistoricGroups()  — Bewährte Gruppen aus Vorsaison
   Step 2: applyNiveauPromotions()— Höherstufungen (Trainer-Empfehlung)
   Step 3: buildCandidateGroups() — Kandidaten-Gruppen (bestehend + historisch)
   Step 4: greedyCluster()       — Greedy-Algorithmus:
            - Mitglieder sortiert nach: Warteliste → Anwesenheit → Erfahrung
            - Pro Skill-Level: Gruppen à maxSize bilden
            - Besten Zeitslot + Trainer + Court finden (Hard Constraints)
            - Niveau-Spannen und Ausfallraten prüfen (Soft Constraints)
   Step 5: applyWaitlistLogic()  — Wunschpartner-Warteliste
   Step 6: computeMetrics()      — Metriken berechnen
   Step 7: generateExplanations()— Textuelle Erklärungen
   Step 8: saveToDatabase()      — Plan-Einträge + Warteliste in DB speichern
   ```

3. **Hard Constraints** (müssen erfüllt sein):
   - Mitglied im Zeitslot verfügbar
   - Trainer verfügbar + unter max. Sessions + unter Stundenlimit
   - Trainer nicht doppelt gebucht (gleicher Tag/Zeit)
   - Court nicht doppelt belegt

4. **Soft Constraints** (Scoring):
   - Gruppen möglichst voll (mehr Mitglieder = höherer Score)
   - Hohe Ausfallraten-Slots vermeiden (−50 Score)
   - Wochentage gegenüber Wochenende bevorzugt (−15 Score)
   - Trainer-Spezialisierung auf Mitglieder-Level (+20 Score)
   - Weniger ausgelastete Trainer bevorzugt (+5 pro freie Session)

5. **Resultat im UI:**
   - **Score Card** (0–100%): Gewichtet aus Niveau-Match (35%), Wunschpartner (30%), Trainer-Last (20%), Penalty-Free (15%)
   - **Metric Cards:** Gruppen, Niveau-Match, Wunschpartner-Quote, Trainer-Auslastung
   - **Warnungen:** Niveau-Spannen, Hochrisiko-Slots, Trainer-Überlastung
   - **ScheduleGrid:** Drag & Drop zwischen Slots — `moveMember()` verschiebt Mitglieder, `drop()` weist Gruppe neuem Slot zu
   - **GroupListView:** Erweiterbare Gruppen-Details
   - **KI-Analyse:** Optional via Button, nutzt `generateAIAnalysis()` (OpenAI)
   - **Warteliste / Nicht zugewiesene:** Cards für Mitglieder ohne Gruppe

6. **State-Sync:** `plan`-Änderungen (via DnD) werden per `useEffect` in den WizardContext synchronisiert:
   ```typescript
   dispatch({ type: 'SET_SCHEDULE_SLOTS', slots: plan })
   ```

### API Calls

| Route | Method | Zweck |
|-------|--------|-------|
| `/api/seasons/[id]/planning/cluster` | POST | Clustering ausführen (Rate-Limit: 5/h) |

---

## Schritt 3: Abschließen (`FinalizeStep`)

### Komponenten

| Komponente | Datei | Funktion |
|------------|-------|----------|
| `FinalizeStep` | `steps/finalize-step.tsx` | Container: Konfliktprüfung + Bestätigung |
| `ConflictCard` | (inline) | Einzelner Konflikt mit Lösen/Ignorieren-Buttons |

### Ablauf

1. **Konfliktprüfung starten** — Button ruft `detectConflicts()`:
   ```
   POST /api/seasons/[id]/planning/conflicts
   → ConflictDetector.detectAll()
   ```

2. **ConflictDetector** (`lib/season-planning/conflict-detector.ts`) — 7 Konflikttypen:

   | # | Typ | Schwere | Beschreibung |
   |---|-----|---------|--------------|
   | 1 | `trainer_double_booking` | 🔴 Kritisch | Trainer zur selben Zeit doppelt gebucht |
   | 2 | `member_double_booking` | 🔴 Kritisch | Mitglied in zwei überlappenden Gruppen |
   | 3 | `no_trainer_assigned` | 🔴 Kritisch | Gruppe ohne Trainer |
   | 4 | `court_unavailable` | 🔴 Kritisch | Court doppelt belegt |
   | 5 | `trainer_over_limit` | 🟡 Warnung | Trainer über Stundenlimit |
   | 6 | `high_failure_rate_slot` | 🔵 Hinweis | Slot mit ≥30% historischer Ausfallrate |
   | 7 | `large_niveau_span` | 🔵 Hinweis | Niveau-Spanne zu groß |

3. **Konflikt-UI:**
   - **Kritische Konflikte** (rote Card): Müssen gelöst werden — blockieren Bestätigung
   - **Warnungen & Hinweise** (gelbe Card): Können akzeptiert oder gelöst werden
   - Jeder Konflikt hat: Beschreibung, Lösungsvorschlag, Lösen/Ignorieren-Buttons
   - Gelöste/ignorierte Konflikte werden ausgegraut
   - PATCH `/api/seasons/[id]/planning/conflicts` mit `{ conflictId, action: 'resolve'|'ignore' }`

4. **Warnungen-Akzeptanz-Checkliste:**
   - Jede offene Warnung muss explizit per Checkbox bestätigt werden
   - Admin-Notiz-Feld (optional, wird im Audit-Trail gespeichert)

5. **Bestätigung** — Button ruft `confirmPlan()`:
   ```
   POST /api/seasons/[id]/planning/confirm
   Body: { seasonId, acceptedWarnings: string[], adminNotes }
   ```

### `confirmPlan()` — Server-seitige Transaktion

```
┌─────────────────────────────────────────────────────┐
│               DATABASE TRANSACTION                   │
│                                                     │
│  1. Konfliktprüfung erneut ausführen                │
│  2. Kritische Konflikte blockieren (409 Conflict)   │
│  3. Für jeden Plan-Eintrag:                         │
│     a. Schedule finden oder erstellen               │
│     b. Wöchentliche Sessions generieren             │
│        (vom Saisonstart bis -ende, pro Woche)       │
│     c. Plan-Entry auf "published" setzen            │
│  4. Season-Status → "published"                     │
│  5. Konflikte in planning_conflicts persistieren    │
│  6. Audit-Trail in season_planning_history          │
│                                                     │
│  → Alles oder nichts (Rollback bei Fehler)          │
└─────────────────────────────────────────────────────┘
                           │
                           ▼ (nach Commit)
┌─────────────────────────────────────────────────────┐
│               POST-TRANSACTION                      │
│                                                     │
│  7. Schulferien-Sessions markieren                  │
│     (markHolidaySessions, via Supabase)             │
│  8. E-Mail-Benachrichtigungen an alle Mitglieder    │
│     (Resend Batch, nicht blockierend)               │
└─────────────────────────────────────────────────────┘
```

6. **Erfolgs-Zustand:**
   - Grüne Success-Card mit Zusammenfassung
   - Metriken: Gruppen, Sessions, Benachrichtigungen
   - Wartelisten-Übersicht
   - CTA: "Zur Rechnungsverwaltung" → `/admin/seasons/[id]`

### API Calls

| Route | Method | Zweck |
|-------|--------|-------|
| `/api/seasons/[id]/planning/conflicts` | GET/POST | Konfliktprüfung ausführen |
| `/api/seasons/[id]/planning/conflicts` | PATCH | Einzelnen Konflikt lösen/ignorieren |
| `/api/seasons/[id]/planning/confirm` | POST | Plan veröffentlichen (Rate-Limit: 3/h, CSRF) |

---

## State-Management: WizardContext

### Architektur

```
PlanningWizardClient
└── WizardProvider (seasonId, clubId)
    └── WizardContent
        ├── ConfigStep
        ├── PlanEditStep
        └── FinalizeStep
```

### WizardState (kompletter Typ)

```typescript
interface WizardState {
  // Session
  seasonId: string;
  clubId: string;
  currentStep: 1 | 2 | 3;
  maxReachedStep: 1 | 2 | 3;
  isReady: boolean;
  isProcessing: boolean;
  error: string | null;

  // Step 1: Konfigurieren
  selectedMemberIds: string[];
  promotedMemberIds: string[];
  preferencesResponseRate: number;
  slotFailureRates: Record<string, number>;
  incompatibleWishPartnerPairs: Array<{ memberA, memberB, reason }>;
  trainerUtilization: Record<string, { current, max, pct }>;
  planningConfig: {
    groupMaxSize, groupMinSize, maxNiveauSpanBeginner, maxNiveauSpanAdvanced,
    trainerUtilizationMaxPct, preferHistoricGroups, avoidHighFailureSlots,
    slotFailureThreshold, maxIterations, optimizationGoals,
    allowOverbooking, preferConsistentTimeslots, useAI
  };

  // Step 2: Planen
  clusteringResult: ClusteringResult | null;
  scheduleSlots: ScheduleSlot[];
  aiAnalysisText: string | null;

  // Step 3: Abschließen
  conflicts: ConflictDetectionResult[];
  isConfirmed: boolean;
  publishedSessionIds: string[];
}
```

### Actions (useReducer)

| Action | Payload | Setzt |
|--------|---------|-------|
| `SET_STEP` | `step: WizardStep` | currentStep, maxReachedStep |
| `SET_PROCESSING` | `isProcessing` | Ladezustand |
| `SET_ERROR` | `error` | Fehlermeldung |
| `SET_READY` | `isReady` | Bereitschaftsstatus |
| `SET_PLANNING_CONFIG` | `config` | Planungseinstellungen (merged) |
| `SET_SCHEDULE_SLOTS` | `slots: ScheduleSlot[]` | DnD-Ergebnisse |
| `SELECT_MEMBERS` | `memberIds, promotedIds, response` | Mitgliederauswahl |
| `SET_PREFERENCES_SUMMARY` | `summary` | Präferenz-Statistiken |
| `SET_TRAINER_AVAILABILITY` | `summary` | Trainer-Auslastung |
| `SET_CLUSTERING_RESULT` | `result: ClusteringResult` | Plan, leert scheduleSlots |
| `SET_CONFLICTS` | `conflicts` | Konfliktliste |
| `CONFIRM_PLAN` | `response` | isConfirmed, publishedSessionIds |
| `RESET_WIZARD` | — | Kompletter Reset |

### Context-Methoden

```typescript
interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  goToStep(step): void;       // Direkt zu Step springen (nur wenn ≤ maxReachedStep)
  nextStep(): void;           // Nächster Step
  prevStep(): void;           // Vorheriger Step
  setMemberIds(ids): void;    // Mitglieder setzen
  runClustering(dryRun?): Promise<void>;  // POST /cluster
  detectConflicts(): Promise<void>;       // POST /conflicts
  confirmPlan(): Promise<ConfirmPlanResponse>;  // POST /confirm
  resetWizard(): void;        // Komplett zurücksetzen
}
```

### Fehlerbehandlung

- Jede async-Methode (`runClustering`, `detectConflicts`, `confirmPlan`) setzt `isProcessing = true` vor dem API-Call
- Bei Fehler: `SET_ERROR` mit Fehlermeldung, `isProcessing = false`
- Bei Erfolg: jeweilige `SET_*`-Action, `isProcessing = false`
- `StepErrorBoundary` fängt React-Render-Fehler pro Step und zeigt Recovery-UI

---

## Clustering-Engine (`SeasonClusteringEngine`)

### Datenfluss

```
Members (mit Präferenzen, Verfügbarkeiten, Wunschpartnern)
Trainers (mit Verfügbarkeiten, Spezialisierungen, Limits)
Courts (aktiv, Oberfläche)
Groups (bestehend, aktiv)
Slot Failure Rates (historisch, aus seasonStatistics)
Historic Groups (bewährte Gruppen aus Vorsaison)
         │
         ▼
  applyNiveauPromotions()  — Trainer-Feedback → Höherstufungen
         │
         ▼
  buildCandidateGroups()   — Bestehende + historisch bewährte Gruppen
         │
         ▼
  greedyCluster()          — Iterativ: pro Level → Gruppen → Slot/Trainer/Court
         │
         ▼
  applyWaitlistLogic()     — Wunschpartner in volle Gruppen → Warteliste
         │
         ▼
  computeMetrics()         — Niveau-Match, Wunschpartner, Trainer-Last, etc.
         │
         ▼
  saveToDatabase()         — seasonPlanEntries + seasonWaitlists + Status-Update
```

### Greedy-Algorithmus im Detail

1. Mitglieder sortieren: Wartelisten-Carryover → hohe Anwesenheit → Erfahrung
2. Nach Skill-Level gruppieren (promotedLevel oder originalLevel)
3. Pro Level: Gruppen à `groupMaxSize` bilden
4. Für jede Gruppe: `findBestTimeSlot()`:
   - Alle 7 Tage × 8 Standard-Zeitslots (08:00–21:30) durchgehen
   - Mitglieder-Verfügbarkeit prüfen (Hard Constraint)
   - Verfügbaren Trainer finden (Hard Constraints: Zeit, Sessions, Stunden, Doppelbuchung)
   - Verfügbaren Court finden (Hard Constraint: keine Doppelbelegung)
   - Slot-Ausfallrate prüfen (Soft Constraint)
   - Score berechnen und besten Slot wählen
5. Gruppe + Assignments erstellen mit Member-Details

### Gespeicherte Daten (pro Dry Run / Publish)

- **season_plan_entries**: Trainer, Court, Gruppe, Tag, Zeit, Mitglieder-IDs, Metriken
- **season_waitlists**: Mitglied, Gruppe, Position, Priorität, Alternative
- **season.planning_status**: `'planned'` → (bei Confirm) `'published'`

---

## ConflictDetector

### Arbeitsweise

- Lädt `seasonPlanEntries` → baut `GroupAssignment[]`
- Führt alle 7 Regeln parallel aus
- Jede Regel returned `ConflictDetectionResult[]`
- `persistConflicts()` speichert in `planning_conflicts`-Tabelle
- Löscht vorherige offene Konflikte vor Insert (re-detect)

### Severity-Level

| Level | Bedeutung | Blockiert Confirm? |
|-------|-----------|-------------------|
| `critical` | Muss gelöst werden | ✅ Ja |
| `warning` | Sollte beachtet werden | ❌ Nein (muss aber akzeptiert werden) |
| `info` | Zur Kenntnisnahme | ❌ Nein (muss aber akzeptiert werden) |

---

## API-Routen Übersicht

| Route | Method | Auth | Rate-Limit | CSRF | Beschreibung |
|-------|--------|------|------------|------|-------------|
| `/api/seasons/[id]/planning/members` | GET | Admin/Superadmin | 30/min | ❌ | Mitgliederliste |
| `/api/seasons/[id]/planning/cluster` | POST | Admin/Superadmin | 5/h | ❌ | Clustering ausführen |
| `/api/seasons/[id]/planning/conflicts` | GET/POST | Admin/Superadmin | 30/min | ❌ | Konfliktprüfung |
| `/api/seasons/[id]/planning/conflicts` | PATCH | Admin/Superadmin | 30/min | ❌ | Konflikt lösen/ignorieren |
| `/api/seasons/[id]/planning/confirm` | POST | Admin/Superadmin | 3/h | ✅ | Plan veröffentlichen |
| `/api/seasons/[id]/planning/waitlist` | GET | Admin/Superadmin | 30/min | ❌ | Warteliste abrufen |
| `/api/seasons/[id]/planning/waitlist` | POST | Admin | 30/min | ✅ | Mitglied aus Warteliste befördern |
| `/api/seasons/[id]/planning/remind` | POST | Admin/Superadmin | 5/h | ✅ | Erinnerungsmails senden |
| `/api/seasons/[id]/planning/preferences-summary` | GET | Admin/Superadmin | 30/min | ❌ | Präferenz-Statistiken |
| `/api/seasons/[id]/planning/trainers` | GET | Admin/Superadmin | 30/min | ❌ | Trainer-Verfügbarkeiten |

### Authentifizierung

Alle Routen nutzen `withApiAuth()` → prüft Supabase-Session.  
Zusätzlich `verifyRole(auth, 'admin')` — Superadmin hat implizit Admin-Rechte.  
Club-Isolation: Superadmins sehen alle Clubs, Admins nur ihren eigenen (`season.club_id !== auth.clubId`).

---

## Drag & Drop (Step 2)

### Hook: `useSchedulePlan`

```typescript
const {
  plan,           // ScheduleSlot[] — aktueller Plan
  setPlan,        // Setter
  dragging,       // ScheduleSlot | null — was wird gezogen
  setDragging,
  dragOver,       // string | null — Ziel-Slot-Key ("day_start")
  setDragOver,
  expandedSlot,   // string | null — welche Gruppe ist aufgeklappt
  setExpandedSlot,
  moveMember,     // (memberId, fromSlotId, toSlotId) => void
  drop,           // (targetKey: "day_start") => void — Gruppe in Slot droppen
  byDay,          // () => Record<number, ScheduleSlot[]>
  activeDays,     // () => number[]
} = useSchedulePlan();
```

### Komponenten

- **ScheduleGrid**: 7-Tage × 8-Zeitslots-Grid, farbige Blöcke pro Gruppe, Drag-Source + Drop-Zone
- **GroupListView**: Expandierbare Liste mit Mitglieder-Namen, Move-Buttons zwischen Gruppen

---

## Fehlerbehandlung & Edge Cases

1. **StepErrorBoundary**: Fängt Render-Fehler pro Step, zeigt Recovery-UI mit "Erneut versuchen"
2. **API-Fehler**: Werden als `state.error` gesetzt und als rote Card im Wizard angezeigt
3. **Processing-State**: Während API-Calls wird ein Spinner statt Step-Content gezeigt
4. **Leerer Plan**: Wenn noch kein Clustering-Result existiert, zeigt Step 2 einen "Plan generieren"-CTA
5. **Keine Konflikte**: Step 3 zeigt direkt die Konfliktprüfung-CTA
6. **Nur kritische Konflikte**: Warnungen/Hinweise werden nur angezeigt, wenn vorhanden
7. **Bestätigung blockiert**: Button disabled solange kritische Konflikte offen sind ODER Warnungen nicht akzeptiert
8. **Double-Submit-Schutz**: `isProcessing`/`isConfirming`-State deaktiviert Buttons während API-Calls
9. **CSRF-Schutz**: `confirm` und `remind` Routen nutzen `withCSRFProtection`
10. **Rate-Limiting**: Cluster (5/h), Confirm (3/h), Remind (5/h) — andere 30/min
11. **Transaktionale Sicherheit**: Confirm schreibt alle DB-Änderungen in einer Transaktion — schlägt etwas fehl, rollt alles zurück
12. **Post-Transaction**: Schulferien-Markierung und E-Mails laufen nach Commit, Fehler sind nicht blockierend

---

## Datei-Übersicht

```
app/(protected)/admin/seasons/[id]/planning/
├── page.tsx                        # Server Component: Auth-Check, Season laden, WizardClient rendern
├── planning-wizard-client.tsx      # Client Component: WizardProvider + Step-Layout + Navigation
└── steps/
    ├── config-step.tsx             # Step 1: Readiness + Config + MemberSelector
    ├── member-selector.tsx         # Mitgliedertabelle mit Filtern & Auswahl
    ├── plan-edit-step.tsx          # Step 2: Clustering + ScheduleGrid + Metriken + KI
    └── finalize-step.tsx           # Step 3: Konfliktprüfung + Bestätigung + Erfolg

lib/season-planning/
├── wizard-context.tsx              # WizardProvider, useReducer, useWizard-Hook
├── types.ts                        # Alle Wizard-Types (State, ClusteringResult, Conflicts, API)
├── clustering-engine.ts            # SeasonClusteringEngine (Greedy-Algorithmus)
├── conflict-detector.ts            # ConflictDetector (7 Regeln, persistConflicts)
├── readiness-check.tsx             # Readiness-Prüfung (Mitglieder, Trainer, Courts)
├── schedule-grid.tsx               # Drag & Drop Grid
├── group-list-view.tsx             # Gruppen-Detailansicht
├── use-schedule-plan.ts            # DnD State Hook
├── ai-analysis.ts                  # OpenAI KI-Analyse
└── schedule-constants.ts           # Farben & Konstanten

app/api/seasons/[id]/planning/
├── members/route.ts                # GET Mitgliederliste
├── cluster/route.ts                # POST Clustering
├── conflicts/route.ts              # GET/POST/PATCH Konflikte
├── confirm/route.ts                # POST Bestätigung & Veröffentlichung
├── waitlist/route.ts               # GET/POST Warteliste
├── remind/route.ts                 # POST Erinnerungsmails
├── preferences-summary/route.ts    # GET Präferenz-Statistiken
└── trainers/route.ts               # GET Trainer-Verfügbarkeiten
```
