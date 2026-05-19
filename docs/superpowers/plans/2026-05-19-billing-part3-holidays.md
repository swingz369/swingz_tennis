# Billing & Training System — Part 3: School Holidays & Season Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed German school holidays for all Bundesländer, and integrate holiday-awareness into season session generation so holiday-period sessions are auto-flagged as 'holiday_cancelled'.

**Architecture:** A seed script populates school_holidays once. A service function checks sessions against the club's Bundesland holidays. Existing session generation in the season planning flow is extended with a post-processing step.

**Tech Stack:** TypeScript, Supabase JS, Node.js seed script (run via `npx ts-node`), Vitest

**Prerequisite:** Part 1 (schema migration) must be applied first.

---

## Task 1: Seed script `scripts/seed-school-holidays.ts`

Create a script that inserts school holidays for 2026 and 2027 for all 16 Bundesländer.

- [ ] Create `scripts/seed-school-holidays.ts` with complete holiday data for Bayern, NRW, Baden-Württemberg, Berlin, Hamburg, Hessen (6 Bundesländer × 2026+2027)
- [ ] Add remaining 10 Bundesländer (Mecklenburg-Vorpommern, Niedersachsen, Rheinland-Pfalz, Saarland, Sachsen, Sachsen-Anhalt, Schleswig-Holstein, Thüringen, Brandenburg, Bremen) with official 2026–2027 dates
- [ ] Run: `cd /home/aeugeln/SwingZ && npx ts-node --project tsconfig.json scripts/seed-school-holidays.ts`
- [ ] Verify in Supabase: `SELECT COUNT(*) FROM school_holidays;` should show ~96 records (16 Bundesländer × 6 holiday periods × 1 year minimum)
- [ ] Commit: `feat(billing): add school holiday seed data for all German Bundesländer`

---

## Task 2: Service `lib/services/school-holidays.service.ts`

Implement three functions with TDD:

**2a. Unit tests first**

- [ ] Create `tests/unit/school-holidays.service.test.ts`
- [ ] Write test suite for `isSessionInHoliday()`:
  - Returns `true` when session date is within holiday range
  - Returns `false` when session is outside all holidays
  - Returns `true` on the boundary start date
  - Returns `false` the day after holiday ends
- [ ] Write test suite for `getHolidaysForClub()`:
  - Mocks Supabase client
  - Fetches club's Bundesland
  - Queries school_holidays for that Bundesland
- [ ] Run: `npx vitest run tests/unit/school-holidays.service.test.ts` (expect fail)

**2b. Implement service**

- [ ] Create `lib/services/school-holidays.service.ts`
- [ ] Implement `isSessionInHoliday(sessionDate: Date, holidays: Array<{start_date: string, end_date: string}>): boolean`
  - Parse start_date and end_date as ISO strings
  - Return `sessionDate >= start && sessionDate <= end`
- [ ] Implement `getHolidaysForClub(supabase, clubId: string, year: number): Promise<Array<{name, start_date, end_date}>>`
  - Query `clubs` table for `clubId` to get `bundesland`
  - Query `school_holidays` WHERE `bundesland = ? AND year = ?`
  - Return array of holiday objects
- [ ] Implement `markHolidaySessions(supabase, scheduleId: string, clubId: string): Promise<number>`
  - Fetch all sessions for schedule (WHERE `schedule_id = scheduleId`)
  - Get holidays for club using `getHolidaysForClub()`
  - For each session, check if `timeslot_start` falls in any holiday
  - Update matching sessions: `UPDATE sessions SET status = 'holiday_cancelled'`
  - Return count of updated sessions

**2c. Test & verify**

- [ ] Run: `npx vitest run tests/unit/school-holidays.service.test.ts` (expect pass)
- [ ] Run: `npx tsc --noEmit 2>&1 | head -20` (expect no errors)
- [ ] Commit: `feat(billing): add school holidays service with holiday-aware session flagging`

---

## Task 3: Hook into season session generation

Find and integrate `markHolidaySessions()` into the existing session creation flow.

**3a. Find session creation code**

- [ ] Run: `grep -r "sessions.*insert\|INSERT.*sessions\|createSession" /home/aeugeln/SwingZ/app/api /home/aeugeln/SwingZ/lib --include="*.ts" --include="*.tsx" -l`
- [ ] Identify the route or server action that bulk-creates sessions (likely in `app/api/schedules/` or `app/(protected)/admin/seasons/`)
- [ ] Read the file to understand context

**3b. Add holiday marking**

- [ ] Import `markHolidaySessions` at top of file
- [ ] Locate the session bulk insert call
- [ ] Immediately after insert succeeds, add:
  ```typescript
  const markedCount = await markHolidaySessions(supabase, scheduleId, clubId);
  console.log(`Marked ${markedCount} sessions as holiday_cancelled`);
  ```
- [ ] Ensure `scheduleId` and `clubId` are available in the function context

**3c. Verify & commit**

- [ ] Run: `npx tsc --noEmit 2>&1 | head -20` (expect no errors)
- [ ] Commit: `feat(billing): auto-flag holiday sessions during season generation`

---

## Task 4: Club Bundesland selector in settings UI

Add a dropdown for Bundesland selection in club settings, wired to the club update API.

**4a. Find settings page**

- [ ] Run: `grep -r "bundesland\|club.*settings\|settings.*page" /home/aeugeln/SwingZ/app --include="*.tsx" -l`
- [ ] Identify the club settings edit form
- [ ] Read the file to understand current structure

**4b. Add Bundesland field**

- [ ] Add constant at top:
  ```typescript
  const BUNDESLAENDER = [
    'Baden-Württemberg','Bayern','Berlin','Brandenburg','Bremen',
    'Hamburg','Hessen','Mecklenburg-Vorpommern','Niedersachsen',
    'Nordrhein-Westfalen','Rheinland-Pfalz','Saarland','Sachsen',
    'Sachsen-Anhalt','Schleswig-Holstein','Thüringen'
  ] as const;
  ```
- [ ] Add `<select>` or `<SelectField>` component (follow existing pattern in form)
- [ ] Wire to existing club update API (likely `clubs.update()` or similar)
- [ ] Set initial value from `club.bundesland` if exists

**4c. Verify & commit**

- [ ] Run: `npx tsc --noEmit 2>&1 | head -20` (expect no errors)
- [ ] Manual test: Load settings page, verify dropdown appears and saves
- [ ] Commit: `feat(billing): add Bundesland selector to club settings`

---

## Summary

Upon completion, the system will:
1. Seed all German school holidays for 2026–2027
2. Provide service functions to check sessions against holidays
3. Auto-mark sessions in holiday periods as `holiday_cancelled` during season generation
4. Allow clubs to specify their Bundesland in settings

All code is TypeScript, tested with Vitest, and integrated into the existing season planning flow.
