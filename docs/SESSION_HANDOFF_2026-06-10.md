# Session Handoff — 2026-06-10

> **Zweck:** Komplette Übergabe aller uncommitted Working-Tree-Änderungen + Anleitung zum
> sauberen Abschluss in einer frischen Session. Hintergrund: Diese Session hatte
> wiederholt Tool-Call-Fehler (malformed-params-Errors bei `spawn_agents`), wodurch
> Typecheck, Lint und Commit/Push für mehrere Tasks blockiert waren.

---

## 1. Working-Tree-Status (`git status --short`)

Folgende Änderungen sind **bereits in Files, aber noch NICHT committed**:

| Datei                                                    | Status                                                 | ~Zeilen | Sub-Task |
| -------------------------------------------------------- | ------------------------------------------------------ | ------- | -------- |
| `supabase/migrations/20260610_add_trainer_dual_rate.sql` | ✅ **NEU erstellt**                                    | +40     | 2/4      |
| `app/(protected)/admin/trainers/trainer.types.ts`        | ✅ **2 Felder ergänzt**                                | +18     | 2/4      |
| `app/(protected)/admin/settings/season-planning-tab.tsx` | ⚠️ modifiziert (unassigned_rate_threshold UI)          | +57     | —        |
| `app/api/seasons/[id]/planning/config/route.ts`          | ⚠️ modifiziert (unassigned_rate_threshold API)         | +15     | —        |
| `components/trainer-profile-management.tsx`              | ⚠️ modifiziert (2-Icon Action-Column)                  | +30     | 1/4      |
| `tests/e2e/season-planning-flow.spec.ts`                 | ⚠️ **NEU erstellt**                                    | +210    | —        |
| `app/landing/page.tsx`                                   | ⚠️ modifiziert (CTA-Fixes)                             | −4 / +4 | —        |
| `app/about/page.tsx`                                     | ⚠️ modifiziert ("Kostenlos starten" → "Mehr erfahren") | −2 / +2 | —        |
| `app/contact/page.tsx`                                   | ⚠️ modifiziert ("Kostenlos starten" → "Mehr erfahren") | −1 / +1 | —        |

---

## 2. Sub-Task 2/4 abschließen (DB-Teil fast fertig)

### 2.1 `src/infrastructure/persistence/schema.ts` — Drizzle-Schema

**Schritt 1: Tabelle lokalisieren**

```bash
cd /home/aeugeln/SwingZ && grep -n 'trainer_profiles\|export const trainerProfiles' src/infrastructure/persistence/schema.ts | head -10
```

**Schritt 2: Im `pgTable('trainer_profiles', { ... })`-Block** vor der `created_at`/`updated_at`-Zeile einfügen:

```typescript
    // Sprint 4 P0 #4 (Dual Hourly Rate): contractually agreed rate + trainer-editable rate
    // for additional hours. See supabase/migrations/20260610_add_trainer_dual_rate.sql
    contracted_hourly_rate: numeric('contracted_hourly_rate', { precision: 10, scale: 2 }),
    extra_hours_rate: numeric('extra_hours_rate', { precision: 10, scale: 2 }),
```

> **Wichtig:** Ohne `.notNull()` — die Spalten sind nullable (SQL-Migration verwendet `ADD COLUMN IF NOT EXISTS` ohne `NOT NULL`).

### 2.2 `supabase-types.ts` + `types/supabase.ts` — Type-Defs (6 str_replaces total)

**Schritt 1: Lokalisieren**

```bash
cd /home/aeugeln/SwingZ && grep -n 'trainer_profiles:' supabase-types.ts types/supabase.ts
```

Du wirst pro File **3 Stellen** finden: `Row`, `Insert`, `Update`. In **jeder** der 6 Stellen nach der existierenden `hourly_rate`-Zeile einfügen:

```typescript
contracted_hourly_rate: number | null;
extra_hours_rate: number | null;
```

> **Einrückung:** 10 Spaces bei `Row` und `Update`, bei `Insert` (optional) ggf. identisch. Falls die Zeile mit anderem Indent gefunden wird, anpassen.

### 2.3 Commit (Sub-Task 2/4 zusammen)

```bash
cd /home/aeugeln/SwingZ

git add supabase/migrations/20260610_add_trainer_dual_rate.sql \
        src/infrastructure/persistence/schema.ts \
        supabase-types.ts types/supabase.ts \
        'app/(protected)/admin/trainers/trainer.types.ts'

cat > /tmp/commit-msg.txt << 'CMDEOF'
feat(trainers): wire dual hourly-rate model (contracted + extra hours)

Completes Sub-Task 2/4 of the trainer dual-rate task:
- supabase/migrations/20260610_add_trainer_dual_rate.sql: adds
  contracted_hourly_rate + extra_hours_rate to trainer_profiles
  (idempotent, nullable, with CHECK >= 0)
- Drizzle schema: adds matching columns to trainerProfiles table
- supabase-types.ts + types/supabase.ts: 3 type definitions per file
  (Row, Insert, Update) updated to include the new fields
- trainer.types.ts: Trainer interface extended with
  contracted_hourly_rate + extra_hours_rate

Business rule (enforced in subsequent sub-tasks in API + UI):
- contracted_hourly_rate: admin-only write
- extra_hours_rate: both admin and trainer can write
CMDEOF

git commit -F /tmp/commit-msg.txt
git push origin main
```

---

## 3. Andere offene Tasks (separat committen)

### 3.1 unassigned_rate_threshold Admin-UI

**Files:**

- `app/(protected)/admin/settings/season-planning-tab.tsx` (+57 Zeilen — neues UI-Feld mit `Sprint 4 P0 #3`-Badge, Number-Input min=0 max=1 step=0.01, `Target`-Icon)
- `app/api/seasons/[id]/planning/config/route.ts` (+15 Zeilen — `'unassigned_rate_threshold'` zu `UPDATABLE_FIELDS` + Server-Side-Clamp 0..1 mit 400-Fehlermeldung)

**Commit:**

```bash
git add 'app/(protected)/admin/settings/season-planning-tab.tsx' 'app/api/seasons/[id]/planning/config/route.ts'
git commit -m "feat(admin): add unassigned_rate_threshold UI + API validation"
git push origin main
```

### 3.2 Trainer-Liste 2-Icons (View + Activate/Deactivate)

**File:** `components/trainer-profile-management.tsx` (+30 Zeilen)

**Änderungen:**

- Imports: `UserCheck, UserX` zu lucide-react hinzugefügt
- Neuer Handler `handleToggleTrainerStatus` — toggelt `'active'` ↔ `'inactive'` via PATCH
- Action-Column: 1× Button → 2× Ghost-Icon-Buttons in `flex gap-2` (analog `members-client.tsx`):
  - `<Eye>` → `/admin/trainers/{id}`
  - `<UserX>` orange (wenn aktiv) / `<UserCheck>` grün (wenn inaktiv) → toggle-Handler

> **⚠️ Caveat:** Der PATCH-Endpoint `/api/trainer-profiles/{trainerId}` ist eine **Vermutung** aus dieser Session. Falls der Test 404 zeigt, **vorher verifizieren**:
>
> ```bash
> cd /home/aeugeln/SwingZ && grep -rn "router.patch.*trainer\|PATCH.*trainer" app/api
> ```
>
> Möglicherweise ist es `/api/trainers/{id}` oder ein anderer Pfad.

**Commit:**

```bash
git add components/trainer-profile-management.tsx
git commit -m "refactor(trainers): 2-icon action column (View + Activate/Deactivate)"
git push origin main
```

### 3.3 E2E Test für Season-Planning Flow (Plan + Grid)

**File:** `tests/e2e/season-planning-flow.spec.ts` (+210 Zeilen, NEU)

5 Tests:

1. Seasons list page loads
2. Season detail page loads
3. Planning wizard loads (3 stepper steps)
4. Plan step (Step 2) shows "Plan generieren" or existing plan
5. Grid view (/plan-grid) loads without error

Pattern: pure Playwright (kein Midscene), `loginAs()` aus `tests/helpers/auth.ts`, graceful `test.skip()` bei fehlender Auth/leeren Daten.

**Commit:**

```bash
git add tests/e2e/season-planning-flow.spec.ts
git commit -m "test(e2e): add Playwright test for season planning Plan + Grid routes"
git push origin main
```

### 3.4 Landing/About/Contact CTA-Fixes

**Files:**

- `app/landing/page.tsx` — Bottom-CTA `Kostenlos testen` → `Jetzt testen` + Subline `30 Tage kostenlos testen` → `30 Tage unverbindlich testen` (PRICING_PLANS[0].cta war schon vorher auf `Jetzt wählen` gefixt)
- `app/about/page.tsx` — 2× `Kostenlos starten` → `Mehr erfahren` (Z. 28 + Z. 149)
- `app/contact/page.tsx` — 1× `Kostenlos starten` → `Mehr erfahren` (Z. 29)

**Commit:**

```bash
git add app/landing/page.tsx app/about/page.tsx app/contact/page.tsx
git commit -m "chore(landing): remove kostenlos from CTAs (Jetzt testen / Mehr erfahren)"
git push origin main
```

---

## 4. Verifikation (Copy-Paste für die neue Session)

```bash
cd /home/aeugeln/SwingZ

# 1. Working-Tree check
git status --short

# 2. TypeScript (sollte keine neuen Fehler werfen, die die Working-Tree-Files betreffen)
npx tsc --noEmit 2>&1 | grep -E 'season-planning-tab|planning/config|landing|about|contact|trainer-profile-management|season-planning-flow|trainer.types' | head -30

# 3. Lint
npx eslint --max-warnings=0 \
  'app/(protected)/admin/settings/season-planning-tab.tsx' \
  'app/api/seasons/[id]/planning/config/route.ts' \
  'components/trainer-profile-management.tsx' \
  'app/landing/page.tsx' \
  'app/about/page.tsx' \
  'app/contact/page.tsx' \
  'tests/e2e/season-planning-flow.spec.ts' \
  'app/(protected)/admin/trainers/trainer.types.ts' \
  2>&1 | tail -10

# 4. Unit-Tests (Clustering-Engine + load-config sollten weiterhin grün sein)
npx vitest run src/__tests__/lib/load-config.test.ts --reporter=default
```

---

## 5. Weitere offene Tasks (zur Info, nicht Working-Tree)

- **Sub-Task 3a:** Admin-only-Input für `contracted_hourly_rate` in `trainer-detail-client.tsx` (Lock-Icon + read-only Hint + disabled für non-admin). JSX-Template siehe vorherige Suggest-Followups.
- **Sub-Task 3b:** Trainer-editable-Input für `extra_hours_rate` in `trainer-detail-client.tsx` (immer sichtbar + Hint "du kannst das selbst anpassen"). JSX-Template siehe vorherige Suggest-Followups.
- **Sub-Task API-Role-Check:** `app/api/trainer-profiles/[id]/route.ts` PATCH erweitern: Admin-only für `contracted_hourly_rate`, beide Rollen für `extra_hours_rate` + Unit-Tests.
- **Sub-Task 1/4 Verify:** Der PATCH-Endpoint für den Status-Toggle (`handleToggleTrainerStatus`) ist eine Vermutung — ggf. anpassen nach `grep -rn "router.patch.*trainer" app/api`.

---

## 6. Empfohlene Reihenfolge in der neuen Session

1. Erst alle Verifikations-Checks laufen lassen (Sektion 4)
2. Sub-Task 2/4 abschließen (Sektion 2.1 + 2.2 + 2.3)
3. Andere Tasks committen (Sektionen 3.1 → 3.4 in der Reihenfolge)
4. Lint + Typecheck final laufen lassen
5. (Optional) Sub-Task 3a/3b/API-Role-Check in Angriff nehmen

---

_Erstellt am 2026-06-10 als Session-Handoff nach wiederholten Tool-Call-Fehlern. Bei
Fragen: Working-Tree-Stand via `git diff --stat HEAD` rekonstruieren._
