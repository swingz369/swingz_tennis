'use client';

/** Raw API shape for availability slots returned by /api/trainer-availability */
interface ApiAvailabilitySlot {
  id: string;
  date: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  notes?: string | null;
  trainer_id?: string;
  recurring_pattern?: unknown;
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getErrorMessage } from '@/lib/typed-helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Save,
  ChevronLeft,
  ChevronRight,
  Copy,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { format } from 'date-fns';
import { de } from '@/lib/locale';

import { createLogger } from '@/lib/logger';

const log = createLogger('trainer-availability-manager');

interface AvailabilitySlot {
  id: string;
  weekday: number;
  fromTime: string;
  untilTime: string;
  isAvailable: boolean;
}

const DAYS = [
  { value: 0, label: 'Sonntag', short: 'So' },
  { value: 1, label: 'Montag', short: 'Mo' },
  { value: 2, label: 'Dienstag', short: 'Di' },
  { value: 3, label: 'Mittwoch', short: 'Mi' },
  { value: 4, label: 'Donnerstag', short: 'Do' },
  { value: 5, label: 'Freitag', short: 'Fr' },
  { value: 6, label: 'Samstag', short: 'Sa' },
];

const PRESET_STARTS = ['08:00', '09:30', '11:00', '13:00', '14:30', '16:00', '17:30', '19:00'];

// ─── Date helpers ────────────────────────────────────────────────────────────

/** Get Monday 00:00 of the week containing `date`. */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday of the first week that overlaps with the given month (1st of month). */
function getFirstWeekOfMonth(year: number, month: number): Date {
  return getMonday(new Date(year, month, 1));
}

/** Format a date as YYYY-MM-DD (used for API params). */
function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Compute the actual date for a weekday within the given week. */
function slotDate(weekStart: Date, weekday: number): string {
  const d = new Date(weekStart);
  // weekday 0=Sun → +6 days, 1=Mon → +0, 2=Tue → +1, …, 6=Sat → +5
  const offset = weekday === 0 ? 6 : weekday - 1;
  d.setDate(d.getDate() + offset);
  return toDateStr(d);
}

/** Get all Monday dates for weeks that overlap with the given month. */
function getWeeksInMonth(year: number, month: number): Date[] {
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

/** GET existing slot keys for a given week. */
async function fetchExistingKeys(weekStart: Date): Promise<Set<string>> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  try {
    const res = await apiFetch(
      `/api/trainer/availability?from=${toDateStr(weekStart)}&to=${toDateStr(weekEnd)}`
    );
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function TrainerAvailabilityManager() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyingToMonth, setApplyingToMonth] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [maxHoursPerWeek, setMaxHoursPerWeek] = useState<number | null>(null);

  // ── Week / month state ──────────────────────────────────────────────────
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMonday(new Date()));

  const weekEnd = useMemo(() => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [currentWeekStart]);

  const currentMonth = useMemo(
    () => ({ year: currentWeekStart.getFullYear(), month: currentWeekStart.getMonth() }),
    [currentWeekStart]
  );

  const monthLabel = useMemo(
    () => format(new Date(currentMonth.year, currentMonth.month), 'MMMM yyyy', { locale: de }),
    [currentMonth]
  );

  const weekLabel = useMemo(() => {
    const sameMonth =
      currentWeekStart.getMonth() === weekEnd.getMonth() &&
      currentWeekStart.getFullYear() === weekEnd.getFullYear();
    if (sameMonth) {
      return `${currentWeekStart.getDate()}. – ${format(weekEnd, 'd. MMMM yyyy', { locale: de })}`;
    }
    return `${format(currentWeekStart, 'd. MMM', { locale: de })} – ${format(weekEnd, 'd. MMM yyyy', { locale: de })}`;
  }, [currentWeekStart, weekEnd]);

  const isCurrentWeek = useMemo(() => {
    const now = getMonday(new Date());
    return toDateStr(currentWeekStart) === toDateStr(now);
  }, [currentWeekStart]);

  const weeklyHours = useMemo(
    () =>
      slots.reduce((sum, s) => {
        const [fh, fm] = s.fromTime.split(':').map(Number);
        const [th, tm] = s.untilTime.split(':').map(Number);
        return sum + (th * 60 + tm - (fh * 60 + fm)) / 60;
      }, 0),
    [slots]
  );

  // ── Navigation ───────────────────────────────────────────────────────────
  const goToPreviousWeek = useCallback(
    () =>
      setCurrentWeekStart((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() - 7);
        return d;
      }),
    []
  );
  const goToNextWeek = useCallback(
    () =>
      setCurrentWeekStart((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() + 7);
        return d;
      }),
    []
  );
  const goToPreviousMonth = useCallback(() => {
    setCurrentWeekStart((prev) => {
      const newMonth = prev.getMonth() - 1;
      const newYear = prev.getFullYear() + (newMonth < 0 ? -1 : 0);
      return getFirstWeekOfMonth(newYear, newMonth < 0 ? 11 : newMonth);
    });
  }, []);
  const goToNextMonth = useCallback(() => {
    setCurrentWeekStart((prev) => {
      const newMonth = prev.getMonth() + 1;
      const newYear = prev.getFullYear() + (newMonth > 11 ? 1 : 0);
      return getFirstWeekOfMonth(newYear, newMonth > 11 ? 0 : newMonth);
    });
  }, []);
  const goToCurrentWeek = useCallback(() => setCurrentWeekStart(getMonday(new Date())), []);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchSlots = useCallback(
    async (opts?: { silent?: boolean }) => {
      setLoading(true);
      if (!opts?.silent) setMessage(null);
      try {
        const fromStr = toDateStr(currentWeekStart);
        const toStr = toDateStr(weekEnd);
        const res = await apiFetch(`/api/trainer/availability?from=${fromStr}&to=${toStr}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 403 || res.status === 404) {
            setMessage(
              errData.error ??
                'Kein Trainer-Profil gefunden. Bitte wende dich an den Administrator.'
            );
            setLoading(false);
            return;
          }
          throw new Error(errData.error ?? 'Fehler beim Laden');
        }
        const data = await res.json();
        // Convert date-based API slots -> weekday-based internal slots
        const apiSlots: ApiAvailabilitySlot[] = data.slots || [];
        const converted: AvailabilitySlot[] = apiSlots.map((s: ApiAvailabilitySlot) => ({
          id: s.id ?? `api-${s.date}-${s.start_time}`,
          weekday: new Date(s.date).getDay(), // 0=Sun … 6=Sat
          fromTime: s.start_time?.slice(0, 5) ?? '00:00',
          untilTime: s.end_time?.slice(0, 5) ?? '00:00',
          isAvailable: s.status === 'available',
        }));
        setSlots(converted);
        setMaxHoursPerWeek((data as { maxHoursPerWeek?: number | null }).maxHoursPerWeek ?? null);
      } catch (err: unknown) {
        setMessage(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [currentWeekStart, weekEnd]
  );

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const applyToAllWeeksInMonth = useCallback(async () => {
    if (slots.length === 0) {
      setMessage('Keine Slots zum Kopieren vorhanden');
      setTimeout(() => setMessage(null), 4000);
      return;
    }

    setApplyingToMonth(true);
    setMessage(null);

    try {
      const weeks = getWeeksInMonth(currentMonth.year, currentMonth.month);
      const nonCurrentWeeks = weeks.filter((w) => toDateStr(w) !== toDateStr(currentWeekStart));
      let weekIndex = 0;
      let totalCreated = 0;
      let totalSkipped = 0;
      const errorDates: string[] = [];

      for (const weekStart of nonCurrentWeeks) {
        weekIndex++;
        setMessage(`Woche ${weekIndex}/${nonCurrentWeeks.length} bearbeitet…`);

        const existingKeys = await fetchExistingKeys(weekStart);

        for (const slot of slots) {
          const date = slotDate(weekStart, slot.weekday);
          const key = `${date}|${slot.fromTime}|${slot.untilTime}`;
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
      if (errorDates.length > 0) {
        parts.push(`${errorDates.length} Fehler`);
        log.warn('[Availability] Apply-to-month errors:', errorDates.slice(0, 5));
      }

      if (parts.length === 0) {
        setMessage('Alle Wochen im Monat bereits konfiguriert');
      } else {
        setMessage(`${parts.join(', ')} ✓`);
      }

      setTimeout(() => setMessage(null), 6000);
    } catch (err: unknown) {
      setMessage(`Fehler: ${getErrorMessage(err)}`);
    } finally {
      setApplyingToMonth(false);
    }
  }, [slots, currentMonth, currentWeekStart]);

  // ── Slot mutation helpers ────────────────────────────────────────────────

  /** Toggle a preset 1-hour slot for a given weekday (chip toggle). */
  const togglePresetSlot = useCallback((weekday: number, start: string) => {
    const [h, m] = start.split(':').map(Number);
    const end = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    setSlots((prev) => {
      const exists = prev.some(
        (s) => s.weekday === weekday && s.fromTime === start && s.untilTime === end
      );
      if (exists) {
        return prev.filter(
          (s) => !(s.weekday === weekday && s.fromTime === start && s.untilTime === end)
        );
      }
      return [
        ...prev,
        {
          id: `preset-${weekday}-${start}`,
          weekday,
          fromTime: start,
          untilTime: end,
          isAvailable: true,
        },
      ];
    });
  }, []);

  const addCustomSlot = (weekday: number) => {
    setSlots((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        weekday,
        fromTime: '08:00',
        untilTime: '10:00',
        isAvailable: true,
      },
    ]);
  };

  const removeSlotById = (id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSlotById = (
    id: string,
    field: keyof AvailabilitySlot,
    value: string | number | boolean
  ) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveSlots = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // 1. Fetch existing slots for this week to avoid duplicates
      const fromStr = toDateStr(currentWeekStart);
      const toStr = toDateStr(weekEnd);
      const existingRes = await apiFetch(`/api/trainer/availability?from=${fromStr}&to=${toStr}`);
      const existingData = existingRes.ok
        ? await existingRes.json().catch(() => ({ slots: [] }))
        : { slots: [] };
      const existingKeys = new Set(
        (existingData.slots || []).map(
          (s: ApiAvailabilitySlot) =>
            `${s.date}|${s.start_time?.slice(0, 5)}|${s.end_time?.slice(0, 5)}`
        )
      );

      // 2. Build set of keys currently in the UI (after user edits)
      const uiKeys = new Set(
        slots.map((s) => `${slotDate(currentWeekStart, s.weekday)}|${s.fromTime}|${s.untilTime}`)
      );

      // 3. DELETE API slots that no longer exist in the UI (DELETE before POST
      //    to avoid conflicts where a deleted slot shares time with a new one)
      let deleted = 0;
      const deleteErrors: string[] = [];
      for (const existing of existingData.slots || []) {
        const existingKey = `${existing.date}|${existing.start_time?.slice(0, 5)}|${existing.end_time?.slice(0, 5)}`;
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
        const date = slotDate(currentWeekStart, slot.weekday);
        const key = `${date}|${slot.fromTime}|${slot.untilTime}`;
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
      if (allErrors.length > 0) {
        setMessage(`Fehler: ${allErrors.join('; ')}`);
      } else if (created === 0 && skipped === 0 && deleted === 0) {
        setMessage('Keine Änderungen');
      } else {
        setMessage(`${parts.join(', ')} ✓`);
      }

      // Re-fetch to sync with server state (if any changes were made)
      if (created > 0 || deleted > 0) {
        await fetchSlots({ silent: true });
      }

      setTimeout(() => setMessage(null), 4000);
    } catch (err: unknown) {
      setMessage(`Fehler: ${getErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // Group slots by weekday for the card-per-day layout
  const groupedByDay = useMemo(() => {
    const map = new Map<number, AvailabilitySlot[]>();
    slots.forEach((slot) => {
      const daySlots = map.get(slot.weekday) || [];
      daySlots.push(slot);
      map.set(slot.weekday, daySlots);
    });
    return map;
  }, [slots]);

  const activeDays = [...groupedByDay.keys()].length;
  const totalSlots = slots.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Verfügbarkeit</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deine wöchentlichen Trainingszeiten
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={applyToAllWeeksInMonth}
            disabled={applyingToMonth || saving || slots.length === 0}
            title={`Aktuelle Slots auf alle Wochen im ${monthLabel} kopieren`}
          >
            {applyingToMonth ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Copy className="h-4 w-4 mr-1" />
            )}
            Auf alle Wochen im Monat anwenden
          </Button>
          <Button size="sm" onClick={saveSlots} disabled={saving || applyingToMonth}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Speichern
          </Button>
        </div>
      </div>

      {/* ── Stunden-Kontext ────────────────────────────────────────────── */}
      {maxHoursPerWeek !== null && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            weeklyHours > maxHoursPerWeek
              ? 'border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400'
              : 'border-border bg-muted/30 text-foreground'
          }`}
        >
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            <span className="font-semibold">{weeklyHours.toFixed(1)} Std</span>
            <span className="text-muted-foreground"> eingetragen diese Woche · Vertrag: </span>
            <span className="font-semibold">{maxHoursPerWeek} Std/Woche</span>
          </span>
          {weeklyHours > maxHoursPerWeek && (
            <span className="ml-auto font-medium">
              +{(weeklyHours - maxHoursPerWeek).toFixed(1)} Std über Limit
            </span>
          )}
        </div>
      )}

      {/* ── Month / Week navigation ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/30 rounded-xl p-3">
        {/* Month row */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={goToPreviousMonth} title="Vorheriger Monat">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center font-semibold text-sm capitalize">
            {monthLabel}
          </span>
          <Button variant="ghost" size="icon" onClick={goToNextMonth} title="Nächster Monat">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Week row */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToCurrentWeek} disabled={isCurrentWeek}>
            Heute
          </Button>
          <Button variant="outline" size="icon" onClick={goToPreviousWeek} title="Vorherige Woche">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[180px] text-center font-medium text-sm">{weekLabel}</span>
          <Button variant="outline" size="icon" onClick={goToNextWeek} title="Nächste Woche">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-3 rounded-xl text-sm ${
            message.startsWith('Fehler')
              ? 'bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 border border-error-200 dark:border-error-800'
              : 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 border border-success-200 dark:border-success-800'
          }`}
        >
          {message}
        </div>
      )}

      {/* Empty state */}
      {totalSlots === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-3">Keine Verfügbarkeiten eingetragen</p>
            <p className="text-xs text-muted-foreground mb-4">
              Klicke auf einen Chip, um schnell ein Zeitfenster hinzuzufügen
            </p>
            {/* Show preset chip toggles even in empty state for the first day */}
            <div className="flex flex-wrap justify-center gap-1.5 max-w-md mx-auto">
              {PRESET_STARTS.map((start) => (
                <button
                  key={start}
                  onClick={() => togglePresetSlot(1, start)}
                  className="text-xs px-2.5 py-1.5 rounded-xl font-medium transition-colors bg-muted text-muted-foreground hover:bg-brand-primary hover:text-white"
                >
                  {start}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Card per weekday */}
          <div className="space-y-3">
            {DAYS.map(({ value, label, short }) => {
              const daySlots = groupedByDay.get(value) || [];
              // Separate preset slots from custom slots
              const presetSlots = daySlots.filter((s) => s.id.startsWith('preset-'));
              const customSlots = daySlots.filter((s) => !s.id.startsWith('preset-'));
              const count = daySlots.length;

              return (
                <Card key={value}>
                  <CardHeader className="py-3 px-4 bg-muted/50 rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            count > 0
                              ? 'bg-brand-primary text-white'
                              : 'bg-muted-foreground/20 text-muted-foreground'
                          }`}
                        >
                          {short}
                        </div>
                        <CardTitle className="text-base">{label}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {count > 0 ? (
                          <Badge className="bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 border-success-200 dark:border-success-800">
                            {count} {count === 1 ? 'Fenster' : 'Fenster'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Keine Verfügbarkeit
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => addCustomSlot(value)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Benutzerdefiniert
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Always show card content: preset chips + custom slot rows */}
                  <CardContent className="py-3 px-4 space-y-3">
                    {/* Preset chip toggles */}
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_STARTS.map((start) => {
                        const [h, m] = start.split(':').map(Number);
                        const end = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        const active = presetSlots.some(
                          (s) => s.fromTime === start && s.untilTime === end
                        );
                        return (
                          <button
                            key={start}
                            onClick={() => togglePresetSlot(value, start)}
                            className={`text-xs px-2.5 py-1.5 rounded-xl font-medium transition-colors ${
                              active
                                ? 'bg-brand-primary text-white shadow-sm'
                                : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                            }`}
                          >
                            {start}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom (non-preset) slots — editable time inputs */}
                    {customSlots.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        {customSlots.map((slot) => (
                          <div
                            key={slot.id}
                            className={`flex items-center gap-3 flex-wrap border rounded-xl p-3 ${
                              slot.isAvailable
                                ? 'bg-success-50/50 dark:bg-success-900/10 border-success-100 dark:border-success-900/30'
                                : 'bg-muted/50 border-border'
                            }`}
                          >
                            <Clock
                              className={`h-4 w-4 flex-shrink-0 ${
                                slot.isAvailable
                                  ? 'text-success-600 dark:text-success-400'
                                  : 'text-muted-foreground'
                              }`}
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">von</span>
                              <Input
                                type="time"
                                value={slot.fromTime}
                                onChange={(e) =>
                                  updateSlotById(slot.id, 'fromTime', e.target.value)
                                }
                                className="w-[110px] h-9 text-sm"
                              />
                              <span className="text-sm text-muted-foreground">bis</span>
                              <Input
                                type="time"
                                value={slot.untilTime}
                                onChange={(e) =>
                                  updateSlotById(slot.id, 'untilTime', e.target.value)
                                }
                                className="w-[110px] h-9 text-sm"
                              />
                            </div>

                            <div className="flex-1" />

                            <Badge
                              variant={slot.isAvailable ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {slot.isAvailable ? 'Verfügbar' : 'Nicht verfügbar'}
                            </Badge>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSlotById(slot.id)}
                              className="text-error-500 hover:text-error-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Summary */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">
            <Calendar className="h-4 w-4" />
            <span>
              <strong>{activeDays}</strong> {activeDays === 1 ? 'Tag' : 'Tage'} ·{' '}
              <strong>{totalSlots}</strong> {totalSlots === 1 ? 'Zeitfenster' : 'Zeitfenster'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
