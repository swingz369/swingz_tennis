# Season Planning Wizard — Design Spec
**Date:** 2026-05-19  
**Status:** Approved  
**Scope:** Admin-facing 5-step wizard for season planning in SwingZ

---

## Overview

A multi-step wizard at `/admin/seasons/[id]/wizard/[step]` that replaces the existing fragmented season-planning UI with a cohesive, resumable flow. The wizard guides a club admin from season configuration through AI-assisted group assignment to invoice generation and publishing.

The existing Auto-Plan algorithm, API endpoints, and DB schema are fully retained — this spec adds only the UI layer and two new API endpoints.

---

## Routing & Layout

```
app/(protected)/admin/seasons/[id]/wizard/
  layout.tsx              ← Stepper header, shared layout
  page.tsx                ← Redirect → /wizard/preferences
  preferences/page.tsx    ← Step 1: Settings & deadlines
  groups/page.tsx         ← Step 2: Groups & trainer config
  plan/page.tsx           ← Step 3: AI plan + Drag & Drop Kanban
  billing/page.tsx        ← Step 4: Invoice preview & generation
  publish/page.tsx        ← Step 5: Review & publish
```

**Stepper header** (persistent across all steps):
```
[✓ Einstellungen] → [✓ Gruppen] → [→ Plan] → [○ Billing] → [○ Veröffentlichen]
```
- Completed steps (✓): clickable, free navigation
- Future steps (○): locked until previous step is completed
- Step status derived from `seasons.planning_status` (see Status Mapping below)

**Entry point:** "Saisonplanung starten" button on `/admin/seasons/[id]` detail page. If wizard already started, button shows "Weiter zu: [current step]".

---

## Step Details

### Step 1: Einstellungen (`/wizard/preferences`)

Configure the season frame before members submit preferences.

**Fields:**
- Präferenz-Deadline (date picker)
- Präferenzen öffnen/schliessen (toggle → `seasons.preferences_open`)
- Max. Sessions/Woche pro Mitglied
- Min/Max Gruppengrösse
- Court-Verfügbarkeiten

**Saves to:** `seasons` + `seasons.auto_plan_config` (JSON)  
**Completion condition:** Saved once → unlocks Step 2

---

### Step 2: Gruppen konfigurieren (`/wizard/groups`)

Define training groups before running the AI plan.

**Features:**
- List existing groups for this season (`training_groups`)
- Add group: name, level, age group, trainer assignment, max participants, timeslot (weekday + time)
- Edit / delete groups
- Trainer conflict warning (if trainer assigned to overlapping timeslot)

**Saves to:** `training_groups`, `schedules`  
**Completion condition:** At least 1 group created → unlocks Step 3

---

### Step 3: KI-Plan + Drag & Drop (`/wizard/plan`)

Distribute members across groups, correct manually.

**Top bar:**
- "KI-Plan generieren" button → `POST /api/seasons/[id]/auto-plan`
- "Konflikte anzeigen" button with badge count
- Progress indicator: "47/52 Mitglieder eingeplant"

**Kanban board:**
- Each group = column with header (name, level, trainer, `X/max` members)
- Members = draggable cards: name, level badge, availability match score (green/yellow/red)
- Leftmost column: "Nicht eingeplant" (unassigned + waitlist)
- Card warning icon if member unavailable in that group's timeslot
- Drag & Drop via `@dnd-kit/core` + `@dnd-kit/sortable`

**Right sidebar** (on member card click):
- Member preferences
- Suggested alternative groups
- Waitlist position

**Drag & Drop data flow:**
```
onDragEnd
  → optimistic local state update
  → PATCH /api/seasons/[id]/plan-entries/[entryId]
  → on error: rollback state + Toast
```

**Saves to:** `seasonPlanEntries`  
**Completion condition:** All members assigned OR admin explicitly confirms with open waitlist

---

### Step 4: Rechnungen (`/wizard/billing`)

Preview and optionally generate invoices before publishing.

**Features:**
- Table: Member | Group | Amount (from `fee_configurations`) | Status
- "Alle generieren" button → creates draft invoices for all members
- Per-member overrides (discount, installment plan)
- Summary: total revenue, invoice count, open invoices
- "Überspringen" option → generate later in `/admin/billing`

**Saves to:** `invoices`, `invoice_items`

---

### Step 5: Veröffentlichen (`/wizard/publish`)

Final review and activation.

**Features:**
- Summary: X groups, X members assigned, X sessions to be created, X invoices
- Checklist with warnings (e.g. "3 Mitglieder auf Warteliste", "2 Gruppen ohne Trainer")
- "Saison veröffentlichen" button → `POST /api/seasons/[id]/planning/confirm`
- On success: success state + link to season overview

---

## Data Flow & API

### Reused Endpoints

| Step | Action | Endpoint |
|------|--------|----------|
| 1 | Load/save season | `GET/PATCH /api/seasons/[id]` |
| 2 | Load groups | `GET /api/seasons/[id]/groups` |
| 3 | Load plan entries | `GET /api/seasons/[id]/plan-entries` |
| 3 | Trigger AI plan | `POST /api/seasons/[id]/auto-plan` |
| 3 | Check conflicts | `GET /api/seasons/[id]/planning/conflicts` |
| 3 | Load members | `GET /api/seasons/[id]/planning/members` |
| 5 | Confirm plan | `POST /api/seasons/[id]/planning/confirm` |

### New Endpoints (2 + 3 CRUD)

**`POST /api/seasons/[id]/wizard/billing-preview`**  
Reads `seasonPlanEntries` + `fee_configurations`, calculates amounts per member — no DB write. Returns `[{ memberId, memberName, groupId, amount, installments }]`.

**`POST /api/seasons/[id]/wizard/billing-generate`**  
Accepts preview array with optional per-member overrides. Calls `billing.service.createSeasonInvoice()` for each member. Returns `{ generated: number, skipped: number, errors: string[] }`.

**`POST /api/training-groups`** + **`PATCH /api/training-groups/[id]`** + **`DELETE /api/training-groups/[id]`**  
Full CRUD for training groups — currently missing, required for Step 2.

### Wizard State

No client-side state store. Each step fetches from DB on load. `seasons.planning_status` is the single source of truth for progress.

### Planning Status Mapping

| `planning_status` | Active Step |
|---|---|
| `draft` | Step 1 |
| `collecting_preferences` | Step 2 |
| `manual_review` | Step 3 |
| `invoices_generated` *(new value)* | Step 4 |
| `published` | Step 5 ✓ |

> `invoices_generated` is a new enum value added between `manual_review` and `published`.

---

## Kanban Technical Detail

**Library:** `@dnd-kit/core` + `@dnd-kit/sortable`  
Touch support (iPad), keyboard accessibility, no jQuery dependency.

```typescript
type KanbanColumn = {
  groupId: string        // "unassigned" for leftmost column
  groupName: string
  trainerId: string | null
  maxParticipants: number
  members: KanbanMember[]
}

type KanbanMember = {
  memberId: string
  name: string
  level: string
  availabilityScore: number  // 0–100
  hasConflict: boolean
  planEntryId: string | null
}
```

Column header turns red when `members.length > maxParticipants`.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| AI plan takes >10s | Progress spinner: "Analysiere X Mitglieder..." |
| AI plan fails | Toast error, Kanban retains previous state |
| Drag & Drop PATCH fails | Optimistic rollback + Toast |
| No fee_config found | Warning banner, step can be skipped |
| Publish fails | Error details shown, `planning_status` not updated |
| Member assigned to 2 groups | Conflict badge, publish blocked |

---

## Testing

**Unit (Vitest):**
- Stepper status logic: `planning_status` → correct active step
- Billing preview calculation: fee_config × members → correct amount
- Kanban rollback after API error

**E2E (Playwright):**
- Happy path: create season → group → AI plan → publish
- Drag & Drop: move member from "Nicht eingeplant" to group
- Browser refresh in Step 3: Kanban state preserved (from DB)

---

## Out of Scope

- Member-facing preference form (exists separately)
- Trainer-facing availability input (separate feature)
- Email notifications after publishing (separate feature)
- Payment processing for invoices

---

## New Dependencies

- `@dnd-kit/core` + `@dnd-kit/sortable` (if not already installed)
