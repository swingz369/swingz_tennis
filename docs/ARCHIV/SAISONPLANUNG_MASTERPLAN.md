# 🎾 Saisonplanung SwingZ — Master-Implementierungsplan

**Datum:** 2026-07-22  
**Basis:** [Vollständige Analyse](./SAISONPLANUNG_ANALYSE.md) + [Design Spec](./superpowers/specs/2026-05-19-season-planning-wizard-design.md)  
**Ziel:** Produktionsreifer 5-Phasen-Wizard gemäß Design-Spec

---

## 📊 Übersicht

| Phase      | Inhalt                             | Tasks | Geschätzter Aufwand |
| ---------- | ---------------------------------- | ----- | ------------------- |
| 🔴 Phase 1 | Kritische Bugfixes                 | 5     | 2-3 Tage            |
| 🔴 Phase 2 | Wizard-Umbau gemäß Design-Spec     | 7     | 2-3 Wochen          |
| 🟡 Phase 3 | Features für echten Vereinsbetrieb | 6     | 1-2 Wochen          |
| 🟢 Phase 4 | Technische Schulden                | 6     | 3-5 Tage            |
| 🧪 Phase 5 | Validierung & QA                   | 3     | 2-3 Tage            |

---

## 🔴 PHASE 1: KRITISCHE BUGFIXES

### Task 1.1: Conflicts-POST reparieren

**Aufwand:** S (Small) | **Datei:** `app/api/seasons/[id]/planning/conflicts/route.ts`

**Problem:** Der Wizard-Context sendet `POST`, aber die Route exportiert nur `GET` → 405 Method Not Allowed.

**Lösung:**

```typescript
// Entweder: Export umbenennen von GET zu POST
export async function POST(request: NextRequest, context: RouteContext) {
  // ... bestehende Logik
}

// Oder: POST-Handler hinzufügen, der GET-Logik delegiert
export async function POST(request: NextRequest, context: RouteContext) {
  return GET(request, context);
}
```

### Task 1.2: Conflicts-PATCH implementieren

**Aufwand:** M (Medium) | **Datei:** `app/api/seasons/[id]/planning/conflicts/route.ts`

**Problem:** Wizard Step 5 sendet `PATCH` zum Lösen/Ignorieren, aber kein Handler existiert → schlägt immer fehl.

**Lösung:**

```typescript
export async function PATCH(request: NextRequest, context: RouteContext) {
  // Body: { conflictId: string, action: 'resolve' | 'ignore', notes?: string }
  // 1. Auth + Rate-Limit
  // 2. Finde Konflikt in planning_conflicts Tabelle
  // 3. Update status → 'resolved' / 'ignored'
  // 4. Setze resolvedAt, resolvedBy, resolutionNotes
  // 5. Return updated conflict
}
```

### Task 1.3: Session-Erstellung in confirm/route.ts fixen

**Aufwand:** L (Large) | **Datei:** `app/api/seasons/[id]/planning/confirm/route.ts`

**Probleme:**

1. `schedule_id: ''` → NOT NULL FK, wird DB-Fehler verursachen
2. `week_number: 1` → keine wöchentliche Wiederholung
3. `timeslot_start/end` → nutzt `season.start_date` ohne Uhrzeit statt `day_of_week` + `start_time`
4. Keine recurring Sessions für die ganze Saison

**Lösung:**

```typescript
// 1. schedule_id korrekt ermitteln
//    - Entweder: Schedule für die Saison finden oder neu anlegen
//    - Oder: schedule_id aus entry.schedule_id nehmen (wenn vorhanden)

// 2. Korrekte Startzeit berechnen
function calculateFirstSessionDate(
  seasonStart: Date, // z.B. 2026-04-01
  targetDayOfWeek: number, // 0=Mo..6=So
  timeString: string // z.B. "18:00"
): Date {
  const start = new Date(seasonStart);
  const currentDay = start.getDay(); // 0=So in JS, anpassen auf 0=Mo
  const adjustedCurrentDay = currentDay === 0 ? 6 : currentDay - 1;
  let daysUntilTarget = targetDayOfWeek - adjustedCurrentDay;
  if (daysUntilTarget < 0) daysUntilTarget += 7;

  const [hours, minutes] = timeString.split(':').map(Number);
  const result = new Date(start);
  result.setDate(result.getDate() + daysUntilTarget);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

// 3. Wöchentliche Sessions erstellen
const totalWeeks = Math.ceil(
  (season.end_date.getTime() - season.start_date.getTime()) / (7 * 24 * 60 * 60 * 1000)
);

for (let week = 1; week <= totalWeeks; week++) {
  const sessionDate = new Date(firstSessionDate);
  sessionDate.setDate(sessionDate.getDate() + (week - 1) * 7);

  await db.insert(sessions).values({
    schedule_id: scheduleId,
    trainer_id: entry.trainer_id,
    group_ids: entry.group_id ? [entry.group_id] : [],
    week_number: week,
    timeslot_start: sessionDate,
    timeslot_end: new Date(sessionDate.getTime() + durationMs),
    court_id: entry.court_id,
    max_participants: entry.max_participants,
    notes: 'Erstellt durch Saisonplanung',
  });
}
```

### Task 1.4: publishedSessionIds-Fake entfernen

**Aufwand:** S (Small) | **Dateien:** `lib/season-planning/wizard-context.tsx`, `app/api/seasons/[id]/planning/confirm/route.ts`

**Problem:** Im Wizard-Context wird `publishedSessionIds` mit `session_0`, `session_1` etc. gefüllt:

```typescript
// wizard-context.tsx, case 'CONFIRM_PLAN':
publishedSessionIds: action.response.publishedSessions
  ? Array.from({ length: action.response.publishedSessions }, (_, i) => `session_${i}`)
  : [],
```

**Lösung:**

- Confirm-Route gibt echte Session-UUIDs im Response zurück (`publishedIds`)
- Wizard-Context verwendet diese direkt:

```typescript
publishedSessionIds: action.response.publishedSessionIds ?? [],
```

### Task 1.5: Clustering-Trunkierung entfernen

**Aufwand:** S (Small) | **Datei:** `app/api/seasons/[id]/planning/cluster/route.ts`

**Problem:** `memberDetails: g.memberDetails.slice(0, 5)` → nur 5 Mitglieder pro Gruppe sichtbar.

**Lösung:**

```typescript
// Vorher:
memberDetails: g.memberDetails.slice(0, 5),

// Nachher:
memberDetails: g.memberDetails,
```

---

## 🔴 PHASE 2: WIZARD-UMBAU GEMÄSS DESIGN-SPEC

### Task 2.1: Routing & Layout umstellen

**Aufwand:** M (Medium) | **Dateien:** Neue Dateien unter `app/(protected)/admin/seasons/[id]/wizard/`

**Änderungen:**

1. Neuen Ordner `app/(protected)/admin/seasons/[id]/wizard/` erstellen
2. `layout.tsx` — Stepper-Header, liest `seasons.planning_status`
3. `page.tsx` — Redirect auf aktuellen Step basierend auf `planning_status`
4. Alte `planning/` Route deprecaten (später löschen)

**layout.tsx Konzept:**

```typescript
// Server Component
export default async function WizardLayout({ params, children }) {
  const season = await getSeason(params.id);

  const steps = [
    { key: 'preferences', label: 'Einstellungen', number: 1 },
    { key: 'groups', label: 'Gruppen', number: 2 },
    { key: 'plan', label: 'KI-Plan', number: 3 },
    { key: 'billing', label: 'Rechnungen', number: 4 },
    { key: 'publish', label: 'Veröffentlichen', number: 5 },
  ];

  const activeStep = statusToStep(season.planning_status);
  // draft → 1, collecting_preferences → 2, manual_review → 3,
  // invoices_generated → 4, published → 5

  return (
    <div>
      <Stepper steps={steps} activeStep={activeStep} />
      {children}
    </div>
  );
}
```

### Task 2.2: Step 1 — Einstellungen (`/wizard/preferences`)

**Aufwand:** M (Medium) | **Datei:** `app/(protected)/admin/seasons/[id]/wizard/preferences/page.tsx`

**Features (laut Spec):**

- Präferenz-Deadline (DatePicker)
- Präferenzen öffnen/schließen (Toggle → `seasons.preferences_open`)
- Max. Sessions/Woche pro Mitglied
- Min/Max Gruppengröße
- Court-Verfügbarkeiten

**Wiederverwendung:** `PlanningConfigService`, `seasons.auto_plan_config`

**Speicherung:** Server Action oder `PATCH /api/seasons/[id]`

### Task 2.3: Step 2 — Gruppen konfigurieren (`/wizard/groups`)

**Aufwand:** L (Large) | **Datei:** `app/(protected)/admin/seasons/[id]/wizard/groups/page.tsx`

**Features (laut Spec):**

- Liste existierender `training_groups`
- Gruppe hinzufügen: Name, Level, Altersgruppe, Trainer, max. Teilnehmer, Zeitslot
- Gruppen editieren/löschen
- Trainer-Konflikt-Warnung

**APIs benötigt:** `POST/PATCH/DELETE /api/training-groups/[id]` (neu oder vorhanden prüfen)

### Task 2.4: Step 3 — KI-Plan + Kanban (`/wizard/plan`)

**Aufwand:** XL (Extra Large) | **Datei:** `app/(protected)/admin/seasons/[id]/wizard/plan/page.tsx`

**Features (laut Spec):**

- "KI-Plan generieren" Button → `POST /api/seasons/[id]/auto-plan`
- Kanban-Board mit `@dnd-kit/core` + `@dnd-kit/sortable`
  - Jede Gruppe = Spalte (Name, Level, Trainer, X/max)
  - Mitglieder = draggable Karten
  - Linke Spalte: "Nicht eingeplant"
- Drag & Drop → `PATCH /api/seasons/[id]/plan-entries/[entryId]`
- Optimistic UI + Rollback bei Fehler
- Rechte Sidebar bei Klick auf Mitglied

**Wiederverwendung:** `ClusteringEngine`, `ConflictDetector`, `seasonPlanEntries` API

**Kanban-Datenmodell:**

```typescript
type KanbanColumn = {
  groupId: string;
  groupName: string;
  trainerId: string | null;
  maxParticipants: number;
  members: KanbanMember[];
};

type KanbanMember = {
  memberId: string;
  name: string;
  level: string;
  availabilityScore: number;
  hasConflict: boolean;
  planEntryId: string | null;
};
```

### Task 2.5: Step 4 — Rechnungen (`/wizard/billing`)

**Aufwand:** L (Large) | **Dateien:** `app/(protected)/admin/seasons/[id]/wizard/billing/page.tsx`, `app/api/seasons/[id]/wizard/billing-preview/route.ts`, `app/api/seasons/[id]/wizard/billing-generate/route.ts`

**Neue APIs:**

- `POST /api/seasons/[id]/wizard/billing-preview` — Liest `seasonPlanEntries` + `fee_configurations`, berechnet Beträge
- `POST /api/seasons/[id]/wizard/billing-generate` — Erstellt `invoices` + `invoice_items`

**Features:**

- Tabelle: Mitglied | Gruppe | Betrag | Status
- "Alle generieren" Button
- Per-Member Overrides
- Summary: Gesamtumsatz, Rechnungsanzahl
- "Überspringen" Option

### Task 2.6: Step 5 — Veröffentlichen (`/wizard/publish`)

**Aufwand:** M (Medium) | **Datei:** `app/(protected)/admin/seasons/[id]/wizard/publish/page.tsx`

**Features (laut Spec):**

- Zusammenfassung: X Gruppen, X Mitglieder, X Sessions, X Rechnungen
- Checkliste mit Warnungen
- "Saison veröffentlichen" Button → `POST /api/seasons/[id]/planning/confirm`
- Erfolgszustand mit Link zur Saisonübersicht

**Wiederverwendung:** reparierte `confirm/route.ts` aus Phase 1

### Task 2.7: Alten Wizard-Code deprecaten

**Aufwand:** S (Small)

- `app/(protected)/admin/seasons/[id]/planning/` → markieren als deprecated oder löschen
- `lib/season-planning/wizard-context.tsx` → wird nicht mehr benötigt
- Alle alten Step-Komponenten archivieren

---

## 🟡 PHASE 3: FEATURES FÜR ECHTEN VEREINSBETRIEB

### Task 3.1: E-Mail-Benachrichtigungen nach Publish

**Aufwand:** M (Medium) | **Dateien:** `app/api/seasons/[id]/planning/confirm/route.ts`, `src/infrastructure/email/resend-email.service.ts`

**Umsetzung:**

- Nach erfolgreichem Publish für jedes Mitglied die Gruppe per E-Mail mitteilen
- Wartelisten-Mitglieder separat benachrichtigen
- Vorhandenen `ResendEmailService` nutzen

```typescript
// In confirm/route.ts nach Session-Erstellung:
for (const entry of entries) {
  const members = entry.expected_participants as string[];
  for (const memberId of members) {
    await emailService.sendSeasonAssignment(memberId, {
      groupName: entry.group_id,
      dayOfWeek: entry.day_of_week,
      startTime: entry.start_time,
      trainerName: entry.trainer_id,
    });
  }
}
```

### Task 3.2: Schulferien im Clustering berücksichtigen

**Aufwand:** S (Small) | **Datei:** `lib/season-planning/clustering-engine.ts`

**Problem:** `markHolidaySessions` wird erst nach Publish auf Sessions angewendet.

**Lösung:** Vor dem Clustering prüfen, welche Wochen Schulferien haben, und diese Slots nicht belegen:

```typescript
// In clustering-engine.ts, vor dem greedyCluster:
const holidayWeeks = await this.getHolidayWeeks(season);
// Dann in findBestTimeSlot: holidayWeeks checken und score anpassen
```

### Task 3.3: Mitglieder an fehlende Präferenzen erinnern

**Aufwand:** M (Medium) | **Datei:** `app/(protected)/admin/seasons/[id]/wizard/preferences/page.tsx`

**Feature:**

- Button "Fehlende erinnern" in Step 1
- Sendet E-Mail an alle Mitglieder ohne `is_submitted: true`
- Nutzt vorhandenen Resend-Email-Service

### Task 3.4: "Was-wäre-wenn" Clustering-Vergleiche

**Aufwand:** M (Medium) | **Datei:** `app/(protected)/admin/seasons/[id]/wizard/plan/page.tsx`

**Feature:**

- Toggle "Temporären Plan erstellen" (dryRun)
- dryRun-Ergebnisse anzeigen mit "Ergebnis anwenden" Button
- Alte dryRun-Ergebnisse verwerfbar

### Task 3.5: Plan-Export

**Aufwand:** M (Medium) | **Datei:** `app/(protected)/admin/seasons/[id]/wizard/publish/page.tsx`

**Feature:**

- Download-Button für CSV/Excel
- Spalten: Gruppe, Trainer, Wochentag, Uhrzeit, Mitglieder
- Optional: Kalender-Ansicht (z.B. `@fullcalendar/react`)

### Task 3.6: Manuelle Nachbearbeitung

Bereits in **Task 2.4 (Kanban)** enthalten — Drag & Drop = manuelle Nachbearbeitung.

---

## 🟢 PHASE 4: TECHNISCHE SCHULDEN

### Task 4.1: Types bereinigen

**Aufwand:** S (Small) + alle Importe anpassen

**Problem:** `lib/types/season-planning.ts` und `lib/season-planning/types.ts` definieren ähnliche Types redundant.

**Lösung:**

1. `lib/types/season-planning.ts` → behalten für DB-Model-Types, Enums, API-Types
2. `lib/season-planning/types.ts` → behalten für Wizard-Types, Clustering-Types, Conflict-Types
3. Redundanzen entfernen (z.B. `SkillLevel`, `DayOfWeek` nur in `lib/types/season-planning.ts`)
4. Alle Importe anpassen

### Task 4.2: Toten Code entfernen

**Aufwand:** S (Small)

**Betroffene Dateien:**

- `lib/season-planning/types.ts`: `POST_PROCESSING: 7` aus `WizardStep` entfernen
- `app/api/seasons/[id]/planning/confirm/route.ts`: Dummy `memberDetails`-Mapping vereinfachen
- `lib/season-planning/wizard-context.tsx`: Wird in Phase 2 vollständig obsolet

### Task 4.3: Audit-Trail implementieren

**Aufwand:** S (Small) | **Datei:** `app/api/seasons/[id]/planning/confirm/route.ts`

**Problem:** `season_planning_history` Tabelle existiert, wird aber nie befüllt.

**Lösung:**

```typescript
// In confirm/route.ts nach erfolgreichem Publish:
await db.insert(seasonPlanningHistory).values({
  season_id: seasonId,
  club_id: season.club_id,
  action_type: 'published',
  actor_id: auth.userId,
  action_timestamp: new Date(),
  algorithm_metrics: {
    totalGroups: entries.length,
    totalMembers: /* ... */,
    conflicts: conflicts.length,
  },
  notes: body.adminNotes || 'Planung veröffentlicht',
});
```

### Task 4.4: Konflikte in DB persistieren

**Aufwand:** M (Medium) | **Datei:** `lib/season-planning/conflict-detector.ts`

**Problem:** `ConflictDetector` arbeitet rein In-Memory, persistiert nichts in `planning_conflicts`.

**Lösung:** Nach `detectAll` Upsert in `planning_conflicts`:

```typescript
async detectAll(assignments): Promise<ConflictDetectionResult[]> {
  const conflicts = /* ... bestehende Logik ... */;

  // Persist in DB
  for (const conflict of conflicts) {
    await db.insert(planningConflicts).values({
      season_id: this.seasonId,
      club_id: this.clubId,
      conflict_type: conflict.type,
      severity: conflict.severity,
      description: conflict.description,
      suggested_resolution: conflict.suggestedResolution,
      affected_trainer_ids: conflict.affectedEntities.trainerIds,
      affected_member_ids: conflict.affectedEntities.memberIds,
      affected_court_ids: conflict.affectedEntities.courtIds,
      detected_at: new Date(),
      status: 'open',
    }).onConflictDoUpdate({ /* ... */ });
  }
  return conflicts;
}
```

### Task 4.5: DB-Transaktionen für Rollback

**Aufwand:** S (Small) | **Dateien:** `app/api/seasons/[id]/planning/confirm/route.ts`, `app/api/seasons/[id]/planning/cluster/route.ts`

**Lösung:** `db.transaction()` um kritische Schreiboperationen:

```typescript
await db.transaction(async (tx) => {
  await tx.insert(sessions).values(/* ... */);
  await tx.update(seasonPlanEntries).set({ status: 'published' }) /* ... */;
  // Bei Fehler: automatisches Rollback
});
```

### Task 4.6: Unit-Tests

**Aufwand:** L (Large) | **Dateien:** `__tests__/lib/season-planning/*.test.ts`

**Test-Scope:**

- `clustering-engine.test.ts`: greedyCluster, findBestTimeSlot, niveauPromotions
- `conflict-detector.test.ts`: Alle 7 Konflikt-Regeln einzeln testen
- `confirm.test.ts`: Session-Erstellung, recurring Sessions, Ferien-Markierung
- `planning-config.test.ts`: Config-Logik
- `stats.test.ts`: Statistik-Berechnung

---

## 🧪 PHASE 5: VALIDIERUNG & QA

### Task 5.1: TypeScript Typecheck

**Aufwand:** S (Small) | **Befehl:** `npx tsc --noEmit`

Nach jeder Phase ausführen, um Typfehler früh zu erkennen.

### Task 5.2: Unit- und Integrationstests

**Aufwand:** M (Medium) | **Befehl:** `npm run test` (Vitest)

Alle in Task 4.6 erstellten Tests laufen lassen und fixen.

### Task 5.3: E2E Smoke Test

**Aufwand:** L (Large) | **Datei:** `e2e/season-wizard.spec.ts` (Playwright)

**Test-Szenario:**

1. Saison anlegen
2. Wizard starten → Step 1 Einstellungen
3. Step 2 Gruppen erstellen
4. Step 3 KI-Plan generieren, Mitglied per Drag&Drop verschieben
5. Step 4 Rechnungen generieren
6. Step 5 Veröffentlichen
7. Erfolgszustand prüfen

---

## 📋 Zusammenfassung aller Tasks

| #   | Phase       | Task                      | Aufwand | Dateien                                  |
| --- | ----------- | ------------------------- | ------- | ---------------------------------------- |
| 1.1 | 🔴 Bugfix   | Conflicts-POST            | S       | `conflicts/route.ts`                     |
| 1.2 | 🔴 Bugfix   | Conflicts-PATCH           | M       | `conflicts/route.ts`                     |
| 1.3 | 🔴 Bugfix   | Session-Erstellung        | L       | `confirm/route.ts`                       |
| 1.4 | 🔴 Bugfix   | publishedSessionIds       | S       | `wizard-context.tsx`, `confirm/route.ts` |
| 1.5 | 🔴 Bugfix   | Clustering Trunkierung    | S       | `cluster/route.ts`                       |
| 2.1 | 🔴 Umbau    | Routing & Layout          | M       | `wizard/layout.tsx`                      |
| 2.2 | 🔴 Umbau    | Step 1: Einstellungen     | M       | `wizard/preferences/page.tsx`            |
| 2.3 | 🔴 Umbau    | Step 2: Gruppen           | L       | `wizard/groups/page.tsx`                 |
| 2.4 | 🔴 Umbau    | Step 3: KI-Plan + Kanban  | XL      | `wizard/plan/page.tsx`                   |
| 2.5 | 🔴 Umbau    | Step 4: Rechnungen        | L       | `wizard/billing/page.tsx`, APIs          |
| 2.6 | 🔴 Umbau    | Step 5: Publish           | M       | `wizard/publish/page.tsx`                |
| 2.7 | 🔴 Umbau    | Alten Code deprecaten     | S       | `planning/` → löschen                    |
| 3.1 | 🟡 Feature  | E-Mail-Benachrichtigungen | M       | `confirm/route.ts`, Resend               |
| 3.2 | 🟡 Feature  | Schulferien im Clustering | S       | `clustering-engine.ts`                   |
| 3.3 | 🟡 Feature  | Präferenz-Reminder        | M       | `wizard/preferences/page.tsx`            |
| 3.4 | 🟡 Feature  | DryRun UI                 | M       | `wizard/plan/page.tsx`                   |
| 3.5 | 🟡 Feature  | Plan-Export               | M       | `wizard/publish/page.tsx`                |
| 3.6 | 🟡 Feature  | Manuelle Nachbearbeitung  | —       | Enthalten in 2.4                         |
| 4.1 | 🟢 Schulden | Types bereinigen          | S       | Beide types.ts                           |
| 4.2 | 🟢 Schulden | Toter Code                | S       | types.ts, confirm/route.ts               |
| 4.3 | 🟢 Schulden | Audit-Trail               | S       | `confirm/route.ts`                       |
| 4.4 | 🟢 Schulden | Konflikt-Persistenz       | M       | `conflict-detector.ts`                   |
| 4.5 | 🟢 Schulden | DB-Transaktionen          | S       | `confirm/route.ts`, `cluster/route.ts`   |
| 4.6 | 🟢 Schulden | Unit-Tests                | L       | `__tests__/lib/season-planning/`         |
| 5.1 | 🧪 QA       | TypeScript typecheck      | S       | `npx tsc --noEmit`                       |
| 5.2 | 🧪 QA       | Tests ausführen           | M       | `npm run test`                           |
| 5.3 | 🧪 QA       | E2E Smoke Test            | L       | `e2e/season-wizard.spec.ts`              |

**Gesamt: 27 Tasks in 5 Phasen**

---

## 🛠 Installierte Skills für die Umsetzung

| Skill                     | Zweck                                              |
| ------------------------- | -------------------------------------------------- |
| `nextjs-react-typescript` | Next.js App Router, RSC, TypeScript Best Practices |
| `supabase`                | Supabase Auth, RLS, Realtime                       |
| `tailwind-best-practices` | Tailwind CSS Styling                               |
| `tailwindcss`             | Tailwind-spezifische Patterns                      |
| `shadcn`                  | Shadcn UI Komponenten                              |
| `shadcn-layouts`          | Layout-Patterns mit Shadcn                         |
| `dnd-kit-implementation`  | @dnd-kit Drag & Drop (für Kanban)                  |
| `implementing-drag-drop`  | Drag & Drop UI Patterns                            |
| `resend-setup`            | Resend E-Mail Integration                          |
| `e2e-testing-automation`  | Playwright E2E Tests                               |
| `design-system`           | Design System Konsistenz                           |
| `vitest-midscene-e2e`     | Vitest-basierte E2E Tests                          |

---

_Plan erstellt auf Basis der vollständigen Codebase-Analyse und des Design-Specs._
