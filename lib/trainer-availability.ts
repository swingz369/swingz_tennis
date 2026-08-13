/**
 * Trainer availability — pure helpers + API orchestration.
 *
 * Extracted from `components/trainer-availability-manager.tsx` so the logic can
 * be unit-tested against the real implementation instead of test-local replicas.
 *
 * The async functions receive `apiFetch` as a parameter (dependency injection);
 * the component passes its real `apiFetch`, tests pass a mock.
 */

import { format } from 'date-fns';
import { getErrorMessage } from '@/lib/typed-helpers';

/** Internal weekday-based availability slot as edited in the UI. */
export interface AvailabilitySlot {
  id: string;
  weekday: number;
  fromTime: string;
  untilTime: string;
  isAvailable: boolean;
}

/** Raw API shape for availability slots returned by /api/trainer-availability. */
export interface ApiAvailabilitySlot {
  id: string;
  date: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  notes?: string | null;
  trainer_id?: string;
  recurring_pattern?: unknown;
}

export const DAYS = [
  { value: 0, label: 'Sonntag', short: 'So' },
  { value: 1, label: 'Montag', short: 'Mo' },
  { value: 2, label: 'Dienstag', short: 'Di' },
  { value: 3, label: 'Mittwoch', short: 'Mi' },
  { value: 4, label: 'Donnerstag', short: 'Do' },
  { value: 5, label: 'Freitag', short: 'Fr' },
  { value: 6, label: 'Samstag', short: 'Sa' },
];

export const PRESET_STARTS = [
  '08:00',
  '09:30',
  '11:00',
  '13:00',
  '14:30',
  '16:00',
  '17:30',
  '19:00',
];

/** apiFetch signature (kept structural so tests can inject a plain mock). */
export type ApiFetchFn = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<Response>;

// ─── Date helpers ────────────────────────────────────────────────────────────

/** Get Monday 00:00 of the week containing `date`. */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday of the first week that overlaps with the given month (1st of month). */
export function getFirstWeekOfMonth(year: number, month: number): Date {
  return getMonday(new Date(year, month, 1));
}

/** Format a date as YYYY-MM-DD (used for API params). */
export function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Compute the actual date for a weekday within the given week. */
export function slotDate(weekStart: Date, weekday: number): string {
  const d = new Date(weekStart);
  // weekday 0=Sun → +6 days, 1=Mon → +0, 2=Tue → +1, …, 6=Sat → +5
  const offset = weekday === 0 ? 6 : weekday - 1;
  d.setDate(d.getDate() + offset);
  return toDateStr(d);
}

/** Get all Monday dates for weeks that overlap with the given month. */
export function getWeeksInMonth(year: number, month: number): Date[] {
  const weeks: Date[] = [];
  const firstMonday = getFirstWeekOfMonth(year, month);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const monday = new Date(firstMonday);

  while (toDateStr(monday) <= toDateStr(lastDayOfMonth) && weeks.length < 6) {
    weeks.push(new Date(monday));
    monday.setDate(monday.getDate() + 7);
  }
  return weeks;
}

// ─── Slot list helpers (immutable) ───────────────────────────────────────────

/** Append a new custom slot with deterministic id from an injected timestamp. */
export function addCustomSlot(
  slots: AvailabilitySlot[],
  weekday: number,
  now: number = Date.now()
): AvailabilitySlot[] {
  return [
    ...slots,
    {
      id: `custom-${now}`,
      weekday,
      fromTime: '08:00',
      untilTime: '10:00',
      isAvailable: true,
    },
  ];
}

/** Remove the slot with the given id. */
export function removeSlotById(slots: AvailabilitySlot[], id: string): AvailabilitySlot[] {
  return slots.filter((s) => s.id !== id);
}

/** Update a single field of the slot with the given id. */
export function updateSlotById(
  slots: AvailabilitySlot[],
  id: string,
  field: keyof AvailabilitySlot,
  value: string | number | boolean
): AvailabilitySlot[] {
  return slots.map((s) => (s.id === id ? { ...s, [field]: value } : s));
}

/** Toggle a preset 1-hour slot for a given weekday (chip toggle). */
export function togglePresetSlot(
  slots: AvailabilitySlot[],
  weekday: number,
  start: string
): AvailabilitySlot[] {
  const [h, m] = start.split(':').map(Number);
  const end = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const exists = slots.some(
    (s) => s.weekday === weekday && s.fromTime === start && s.untilTime === end
  );
  if (exists) {
    return slots.filter(
      (s) => !(s.weekday === weekday && s.fromTime === start && s.untilTime === end)
    );
  }
  return [
    ...slots,
    {
      id: `preset-${weekday}-${start}`,
      weekday,
      fromTime: start,
      untilTime: end,
      isAvailable: true,
    },
  ];
}

/** Group slots by weekday (for the card-per-day layout). */
export function groupSlotsByDay(slots: AvailabilitySlot[]): Map<number, AvailabilitySlot[]> {
  const map = new Map<number, AvailabilitySlot[]>();
  slots.forEach((slot) => {
    const daySlots = map.get(slot.weekday) || [];
    daySlots.push(slot);
    map.set(slot.weekday, daySlots);
  });
  return map;
}

// ─── API conversion & orchestration ──────────────────────────────────────────

/** Convert date-based API slots into weekday-based internal slots. */
export function convertApiSlots(apiSlots: ApiAvailabilitySlot[]): AvailabilitySlot[] {
  return apiSlots.map((s) => ({
    id: s.id ?? `api-${s.date}-${s.start_time}`,
    weekday: new Date(s.date).getDay(), // 0=Sun … 6=Sat
    fromTime: s.start_time?.slice(0, 5) ?? '00:00',
    untilTime: s.end_time?.slice(0, 5) ?? '00:00',
    isAvailable: s.status === 'available',
  }));
}

/** `${date}|${fromTime}|${untilTime}` — dedup key for a concrete slot. */
function slotKey(date: string, fromTime: string, untilTime: string): string {
  return `${date}|${fromTime}|${untilTime}`;
}

/** GET existing slot keys for a given week (failures → empty set). */
export async function fetchExistingKeys(
  apiFetch: ApiFetchFn,
  weekStart: Date
): Promise<Set<string>> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  try {
    const res = await apiFetch(availabilityRangeUrl(weekStart, weekEnd));
    const data = res.ok ? await res.json().catch(() => ({ slots: [] })) : { slots: [] };
    return new Set(
      (data.slots || []).map(
        (s: ApiAvailabilitySlot) =>
          `${s.date}|${s.start_time?.slice(0, 5)}|${s.end_time?.slice(0, 5)}`
      )
    );
  } catch {
    return new Set();
  }
}

/** GET URL for the availability range covering [weekStart, weekEnd]. */
function availabilityRangeUrl(weekStart: Date, weekEnd: Date): string {
  return `/api/trainer/availability?from=${toDateStr(weekStart)}&to=${toDateStr(weekEnd)}`;
}

/**
 * Load the week's slots from the API.
 * 403/404 → `message` (no throw); any other failure → throws.
 */
export async function fetchAvailabilitySlots(
  apiFetch: ApiFetchFn,
  weekStart: Date,
  weekEnd: Date
): Promise<{ slots: AvailabilitySlot[]; message: string | null; maxHoursPerWeek: number | null }> {
  const res = await apiFetch(availabilityRangeUrl(weekStart, weekEnd));
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    if (res.status === 403 || res.status === 404) {
      return {
        slots: [],
        message:
          errData.error ?? 'Kein Trainer-Profil gefunden. Bitte wende dich an den Administrator.',
        maxHoursPerWeek: null,
      };
    }
    throw new Error(errData.error ?? 'Fehler beim Laden');
  }
  const data = await res.json();
  return {
    slots: convertApiSlots(data.slots || []),
    message: null,
    maxHoursPerWeek: (data as { maxHoursPerWeek?: number | null }).maxHoursPerWeek ?? null,
  };
}

/**
 * Persist the week's slots: DELETE API slots removed from the UI (DELETE before
 * POST to avoid conflicts), then POST new ones. Returns the summary message.
 */
export async function saveAvailabilitySlots(
  apiFetch: ApiFetchFn,
  slots: AvailabilitySlot[],
  weekStart: Date,
  weekEnd: Date
): Promise<{ message: string; created: number; skipped: number; deleted: number }> {
  // 1. Fetch existing slots for this week to avoid duplicates
  let existingData: { slots?: ApiAvailabilitySlot[] } = { slots: [] };
  try {
    const existingRes = await apiFetch(availabilityRangeUrl(weekStart, weekEnd));
    existingData = existingRes.ok
      ? await existingRes.json().catch(() => ({ slots: [] }))
      : { slots: [] };
  } catch {
    /* GET failed → treat as empty */
  }
  const existingKeys = new Set(
    (existingData.slots || []).map((s) =>
      slotKey(s.date, s.start_time?.slice(0, 5) ?? '', s.end_time?.slice(0, 5) ?? '')
    )
  );

  // 2. Build set of keys currently in the UI (after user edits)
  const uiKeys = new Set(
    slots.map((s) => slotKey(slotDate(weekStart, s.weekday), s.fromTime, s.untilTime))
  );

  // 3. DELETE API slots that no longer exist in the UI (DELETE before POST
  //    to avoid conflicts where a deleted slot shares time with a new one)
  let deleted = 0;
  const deleteErrors: string[] = [];
  for (const existing of existingData.slots || []) {
    const existingKey = slotKey(
      existing.date,
      existing.start_time?.slice(0, 5) ?? '',
      existing.end_time?.slice(0, 5) ?? ''
    );
    if (!uiKeys.has(existingKey)) {
      try {
        const delRes = await apiFetch(`/api/trainer/availability/${existing.id}`, {
          method: 'DELETE',
        });
        if (delRes.ok) {
          deleted++;
        } else {
          const delErr = await delRes.json().catch(() => ({}));
          // 409 = booked slot can't be deleted → skip silently
          if (delRes.status !== 409) {
            deleteErrors.push(`${existing.date}: ${delErr.error ?? 'Löschung fehlgeschlagen'}`);
          }
        }
      } catch (delErr: unknown) {
        deleteErrors.push(`${existing.date}: ${getErrorMessage(delErr)}`);
      }
    }
  }

  // 4. POST each new slot (convert weekday -> date)
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const slot of slots) {
    const date = slotDate(weekStart, slot.weekday);
    const key = slotKey(date, slot.fromTime, slot.untilTime);
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    const res = await apiFetch('/api/trainer/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        start_time: slot.fromTime,
        end_time: slot.untilTime,
        notes: null,
      }),
    });

    if (res.ok) {
      created++;
    } else {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 409) {
        skipped++; // overlap = already exists
      } else {
        errors.push(
          `${DAYS[slot.weekday]?.short ?? '?'} ${slot.fromTime}–${slot.untilTime}: ${errData.error ?? 'Unbekannter Fehler'}`
        );
      }
    }
  }

  // 5. Build result message
  const parts: string[] = [];
  if (created > 0) parts.push(`${created} gespeichert`);
  if (skipped > 0) parts.push(`${skipped} bereits vorhanden`);
  if (deleted > 0) parts.push(`${deleted} gelöscht`);

  const allErrors = [...errors, ...deleteErrors];
  let message: string;
  if (allErrors.length > 0) {
    message = `Fehler: ${allErrors.join('; ')}`;
  } else if (created === 0 && skipped === 0 && deleted === 0) {
    message = 'Keine Änderungen';
  } else {
    message = `${parts.join(', ')} ✓`;
  }
  return { message, created, skipped, deleted };
}

/**
 * Copy the current week's slots to all other weeks of the month.
 * `onProgress` receives (weekIndex, totalWeeks) for UI progress feedback.
 *
 * `errorDates` (unlike the save path) is part of the result so the component
 * can log the offending dates; the save path folds errors into the message.
 */
export async function applyToAllWeeksInMonth(
  apiFetch: ApiFetchFn,
  slots: AvailabilitySlot[],
  year: number,
  month: number,
  currentWeekStart: Date,
  onProgress?: (weekIndex: number, totalWeeks: number) => void
): Promise<{ message: string; created: number; skipped: number; errorDates: string[] }> {
  const weeks = getWeeksInMonth(year, month);
  const nonCurrentWeeks = weeks.filter((w) => toDateStr(w) !== toDateStr(currentWeekStart));
  let totalCreated = 0;
  let totalSkipped = 0;
  const errorDates: string[] = [];

  for (let weekIndex = 0; weekIndex < nonCurrentWeeks.length; weekIndex++) {
    onProgress?.(weekIndex + 1, nonCurrentWeeks.length);
    const weekStart = nonCurrentWeeks[weekIndex];

    const existingKeys = await fetchExistingKeys(apiFetch, weekStart);

    for (const slot of slots) {
      const date = slotDate(weekStart, slot.weekday);
      const key = slotKey(date, slot.fromTime, slot.untilTime);
      if (existingKeys.has(key)) {
        totalSkipped++;
        continue;
      }

      try {
        const res = await apiFetch('/api/trainer/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            start_time: slot.fromTime,
            end_time: slot.untilTime,
            notes: null,
          }),
        });

        if (res.ok) {
          totalCreated++;
        } else if (res.status === 409) {
          totalSkipped++;
        } else {
          const errData = await res.json().catch(() => ({}));
          errorDates.push(`${date}: ${errData.error ?? 'Fehler'}`);
        }
      } catch (err: unknown) {
        errorDates.push(`${date}: ${getErrorMessage(err)}`);
      }
    }
  }

  // Build result message
  const parts: string[] = [];
  if (totalCreated > 0) parts.push(`${totalCreated} Slots erstellt`);
  if (totalSkipped > 0) parts.push(`${totalSkipped} bereits vorhanden`);
  if (errorDates.length > 0) parts.push(`${errorDates.length} Fehler`);

  if (parts.length === 0) {
    return {
      message: 'Alle Wochen im Monat bereits konfiguriert',
      created: 0,
      skipped: 0,
      errorDates: [],
    };
  }
  return {
    message: `${parts.join(', ')} ✓`,
    created: totalCreated,
    skipped: totalSkipped,
    errorDates,
  };
}
