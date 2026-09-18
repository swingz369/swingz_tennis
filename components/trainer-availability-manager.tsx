'use client';

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
import {
  DAYS,
  PRESET_STARTS,
  getMonday,
  getFirstWeekOfMonth,
  toDateStr,
  addCustomSlot,
  removeSlotById,
  updateSlotById,
  togglePresetSlot,
  groupSlotsByDay,
  fetchAvailabilitySlots,
  saveAvailabilitySlots,
  applyToAllWeeksInMonth,
} from '@/lib/trainer-availability';
import type { AvailabilitySlot } from '@/lib/trainer-availability';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const log = createLogger('trainer-availability-manager');

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
        const result = await fetchAvailabilitySlots(apiFetch, currentWeekStart, weekEnd);
        if (result.message !== null) {
          setMessage(result.message);
          return;
        }
        setSlots(result.slots);
        setMaxHoursPerWeek(result.maxHoursPerWeek);
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

  const handleApplyToAllWeeksInMonth = useCallback(async () => {
    if (slots.length === 0) {
      setMessage('Keine Slots zum Kopieren vorhanden');
      setTimeout(() => setMessage(null), 4000);
      return;
    }

    setApplyingToMonth(true);
    setMessage(null);

    try {
      const result = await applyToAllWeeksInMonth(
        apiFetch,
        slots,
        currentMonth.year,
        currentMonth.month,
        currentWeekStart,
        (weekIndex, totalWeeks) => setMessage(`Woche ${weekIndex}/${totalWeeks} bearbeitet…`)
      );
      if (result.errorDates.length > 0) {
        log.warn('[Availability] Apply-to-month errors:', result.errorDates.slice(0, 5));
      }
      setMessage(result.message);

      setTimeout(() => setMessage(null), 6000);
    } catch (err: unknown) {
      setMessage(`Fehler: ${getErrorMessage(err)}`);
    } finally {
      setApplyingToMonth(false);
    }
  }, [slots, currentMonth, currentWeekStart]);

  // ── Slot mutation helpers ────────────────────────────────────────────────

  /** Toggle a preset 1-hour slot for a given weekday (chip toggle). */
  const handleTogglePresetSlot = useCallback((weekday: number, start: string) => {
    setSlots((prev) => togglePresetSlot(prev, weekday, start));
  }, []);

  const handleAddCustomSlot = (weekday: number) => {
    setSlots((prev) => addCustomSlot(prev, weekday));
  };

  const handleRemoveSlotById = (id: string) => {
    setSlots((prev) => removeSlotById(prev, id));
  };

  const handleUpdateSlotById = (
    id: string,
    field: keyof AvailabilitySlot,
    value: string | number | boolean
  ) => {
    setSlots((prev) => updateSlotById(prev, id, field, value));
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveSlots = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const result = await saveAvailabilitySlots(apiFetch, slots, currentWeekStart, weekEnd);
      setMessage(result.message);

      // Re-fetch to sync with server state (if any changes were made)
      if (result.created > 0 || result.deleted > 0) {
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
  const groupedByDay = useMemo(() => groupSlotsByDay(slots), [slots]);

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
          <h1 className="text-2xl font-bold text-primary">Verfügbarkeit</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deine wöchentlichen Trainingszeiten
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleApplyToAllWeeksInMonth}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPreviousMonth}
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Vorheriger Monat</TooltipContent>
          </Tooltip>
          <span className="min-w-[140px] text-center font-semibold text-sm capitalize">
            {monthLabel}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextMonth}
                aria-label="Nächster Monat"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Nächster Monat</TooltipContent>
          </Tooltip>
        </div>

        {/* Week row */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToCurrentWeek} disabled={isCurrentWeek}>
            Heute
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousWeek}
                aria-label="Vorherige Woche"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Vorherige Woche</TooltipContent>
          </Tooltip>
          <span className="min-w-[180px] text-center font-medium text-sm">{weekLabel}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextWeek}
                aria-label="Nächste Woche"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Nächste Woche</TooltipContent>
          </Tooltip>
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
                  onClick={() => handleTogglePresetSlot(1, start)}
                  className="text-xs px-2.5 py-1.5 rounded-xl font-medium transition-colors bg-muted text-muted-foreground hover:bg-primary hover:text-white"
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
                              ? 'bg-primary text-white'
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
                          onClick={() => handleAddCustomSlot(value)}
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
                            onClick={() => handleTogglePresetSlot(value, start)}
                            className={`text-xs px-2.5 py-1.5 rounded-xl font-medium transition-colors ${
                              active
                                ? 'bg-primary text-white shadow-sm'
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
                                  handleUpdateSlotById(slot.id, 'fromTime', e.target.value)
                                }
                                className="w-[110px] h-9 text-sm"
                              />
                              <span className="text-sm text-muted-foreground">bis</span>
                              <Input
                                type="time"
                                value={slot.untilTime}
                                onChange={(e) =>
                                  handleUpdateSlotById(slot.id, 'untilTime', e.target.value)
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
                              onClick={() => handleRemoveSlotById(slot.id)}
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
