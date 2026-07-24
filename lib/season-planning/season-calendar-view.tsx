'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Calendar, Check, Loader2, MapPin, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-fetch';
import type {
  CalendarGroup,
  CalendarWeek,
  GroupWeekStatus,
  SeasonCalendarData,
} from './season-calendar.service';

interface Props {
  seasonId: string;
  clubId: string;
  initialData: SeasonCalendarData;
  /** Optional callback after a toggle is persisted. */
  onChange?: (next: { groupId: string; weekMonday: string; isActive: boolean }) => void;
}

interface MonthGroup {
  monthKey: string;
  monthLabel: string;
  weeks: CalendarWeek[];
}

function groupWeeksByMonth(weeks: CalendarWeek[]): MonthGroup[] {
  const out: MonthGroup[] = [];
  for (const w of weeks) {
    const last = out[out.length - 1];
    if (last && last.monthKey === w.monthKey) {
      last.weeks.push(w);
    } else {
      out.push({ monthKey: w.monthKey, monthLabel: w.monthLabel, weeks: [w] });
    }
  }
  return out;
}

function makeKey(groupId: string, weekMonday: string): string {
  return `${groupId}:${weekMonday}`;
}

export function SeasonCalendarView({ seasonId, clubId, initialData, onChange }: Props) {
  const [data, setData] = useState<SeasonCalendarData>(initialData);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  const monthGroups = useMemo(() => groupWeeksByMonth(data.weeks), [data.weeks]);

  const getStatus = useCallback(
    (groupId: string, weekMonday: string): GroupWeekStatus | undefined => {
      return data.statusMap[makeKey(groupId, weekMonday)];
    },
    [data.statusMap]
  );

  const updateLocalStatus = useCallback(
    (groupId: string, weekMonday: string, next: GroupWeekStatus) => {
      setData((prev) => {
        const statusMap = { ...prev.statusMap, [makeKey(groupId, weekMonday)]: next };
        const activeWeeksByGroup = { ...prev.stats.activeWeeksByGroup };
        const current = activeWeeksByGroup[groupId] ?? 0;
        const prevStatus = prev.statusMap[makeKey(groupId, weekMonday)];
        if (prevStatus?.isActive && !next.isActive) {
          activeWeeksByGroup[groupId] = Math.max(0, current - 1);
        } else if (!prevStatus?.isActive && next.isActive) {
          activeWeeksByGroup[groupId] = current + 1;
        }
        return { ...prev, statusMap, stats: { ...prev.stats, activeWeeksByGroup } };
      });
    },
    []
  );

  const handleToggle = useCallback(
    async (group: CalendarGroup, week: CalendarWeek) => {
      const key = makeKey(group.id, week.monday);
      const current = getStatus(group.id, week.monday);
      const nextIsActive = !(current?.isActive ?? true); // default is "active"

      // Optimistic update
      const optimistic: GroupWeekStatus = {
        groupId: group.id,
        weekMonday: week.monday,
        isActive: nextIsActive,
        reason: current?.reason ?? null,
      };
      updateLocalStatus(group.id, week.monday, optimistic);
      setPendingKey(key);
      onChange?.({ groupId: group.id, weekMonday: week.monday, isActive: nextIsActive });

      try {
        const res = await apiFetch(`/api/seasons/${seasonId}/calendar/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            group_id: group.id,
            week_monday: week.monday,
            is_active: nextIsActive,
            reason: optimistic.reason,
          }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? 'Aktualisierung fehlgeschlagen');
        }
      } catch (err) {
        // Revert on failure
        updateLocalStatus(
          group.id,
          week.monday,
          current ?? {
            groupId: group.id,
            weekMonday: week.monday,
            isActive: !nextIsActive,
            reason: null,
          }
        );
        toast.error(err instanceof Error ? err.message : 'Unbekannter Fehler');
      } finally {
        setPendingKey(null);
      }
      // clubId is referenced for symmetry with the service signature (some auth
      // paths re-derive it server-side). Keep it here to satisfy linting.
      void clubId;
    },
    [clubId, getStatus, onChange, seasonId, updateLocalStatus]
  );

  const handleBulkActivate = useCallback(
    async (group: CalendarGroup, weeks: CalendarWeek[], isActive: boolean) => {
      const original = new Map<string, GroupWeekStatus>();
      // Optimistic
      for (const w of weeks) {
        const cur = getStatus(group.id, w.monday);
        original.set(
          makeKey(group.id, w.monday),
          cur ?? {
            groupId: group.id,
            weekMonday: w.monday,
            isActive: !isActive,
            reason: null,
          }
        );
        updateLocalStatus(group.id, w.monday, {
          groupId: group.id,
          weekMonday: w.monday,
          isActive,
          reason: cur?.reason ?? null,
        });
      }

      try {
        const res = await apiFetch(`/api/seasons/${seasonId}/calendar/toggle`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            group_id: group.id,
            week_mondays: weeks.map((w) => w.monday),
            is_active: isActive,
          }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? 'Bulk-Update fehlgeschlagen');
        }
        toast.success(
          `${weeks.length} Wochen für ${group.name} ${isActive ? 'aktiviert' : 'deaktiviert'}`
        );
      } catch (err) {
        // Revert
        for (const [key, prev] of original) {
          const [gid, monday] = key.split(':');
          updateLocalStatus(gid, monday, prev);
        }
        toast.error(err instanceof Error ? err.message : 'Unbekannter Fehler');
      }
    },
    [getStatus, seasonId, updateLocalStatus]
  );

  const filteredGroups = useMemo(() => {
    if (!filterActiveOnly) return data.groups;
    return data.groups.filter((g) => (data.stats.activeWeeksByGroup[g.id] ?? 0) > 0);
  }, [data.groups, data.stats.activeWeeksByGroup, filterActiveOnly]);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Saisonkalender
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Sep {data.season.start_date.slice(0, 4)} – Jul {data.season.end_date.slice(0, 4)} ·{' '}
              {data.weeks.length} Wochen · <MapPin className="inline h-3 w-3" />{' '}
              {data.bundeslandName}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{data.stats.totalWeeks} KW</Badge>
            <Badge variant="outline" className="bg-warning-50 text-warning-900 border-warning-200">
              {data.stats.holidayWeeks} Ferienwochen
            </Badge>
            <Button
              variant={filterActiveOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterActiveOnly((v) => !v)}
            >
              {filterActiveOnly ? 'Alle' : 'Nur aktive Gruppen'}
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-md bg-success-500" /> Aktiv
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-md bg-gray-200" /> Inaktiv
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-md bg-warning-100 border border-warning-300" />{' '}
            Ferienwoche
          </span>
        </div>
      </CardHeader>

      <CardContent>
        {data.groups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Keine aktiven Gruppen für diese Saison gefunden. Lege zuerst Gruppen an oder
            veröffentliche eine Planung.
          </p>
        ) : (
          <ScrollArea className="w-full whitespace-nowrap rounded-md border">
            <div className="min-w-max">
              {/* Header rows */}
              <div className="sticky top-0 z-20 bg-background border-b">
                {/* Month row */}
                <div className="flex">
                  <div className="w-56 shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/40 border-r">
                    Gruppe
                  </div>
                  <div className="flex">
                    {monthGroups.map((mg) => (
                      <div
                        key={mg.monthKey}
                        className="px-2 py-1 text-xs font-semibold text-center border-r bg-muted/40"
                        style={{ width: mg.weeks.length * 40 }}
                      >
                        {mg.monthLabel}
                      </div>
                    ))}
                  </div>
                </div>
                {/* KW row */}
                <div className="flex">
                  <div className="w-56 shrink-0 px-3 py-1 text-xs text-muted-foreground border-r bg-muted/20" />
                  <div className="flex">
                    {data.weeks.map((w) => (
                      <div
                        key={w.monday}
                        className={cn(
                          'w-10 shrink-0 text-center text-[10px] font-medium border-r py-1',
                          w.isHolidayWeek
                            ? 'bg-warning-50 text-warning-900'
                            : 'text-muted-foreground'
                        )}
                        title={`KW ${w.isoWeek} · ${w.rangeLabel}${
                          w.holidayNames.length > 0 ? ` · ${w.holidayNames.join(', ')}` : ''
                        }`}
                      >
                        {w.isoWeek}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Body rows */}
              <TooltipProvider delayDuration={150}>
                {filteredGroups.map((group) => {
                  const activeCount = data.stats.activeWeeksByGroup[group.id] ?? 0;
                  return (
                    <div
                      key={group.id}
                      className="flex border-b hover:bg-muted/20 transition-colors"
                    >
                      <div className="w-56 shrink-0 px-3 py-2 border-r bg-background sticky left-0 z-10">
                        <div className="text-sm font-medium truncate">{group.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {group.age_group ?? '—'}
                          {group.level ? ` · ${group.level}` : ''}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <Badge
                            variant={activeCount > 0 ? 'default' : 'secondary'}
                            className="text-[10px] h-4 px-1.5"
                          >
                            {activeCount} aktiv
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-2 text-[10px]"
                            onClick={() => handleBulkActivate(group, data.weeks, true)}
                            title="Alle Wochen aktivieren"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-2 text-[10px]"
                            onClick={() => handleBulkActivate(group, data.weeks, false)}
                            title="Alle Wochen deaktivieren"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex">
                        {data.weeks.map((w) => {
                          const status = getStatus(group.id, w.monday);
                          const isActive = status?.isActive ?? true;
                          const isPending = pendingKey === makeKey(group.id, w.monday);
                          const holidayTip =
                            w.holidayNames.length > 0
                              ? `Ferien: ${w.holidayNames.join(', ')}\n`
                              : '';
                          return (
                            <Tooltip key={w.monday}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => handleToggle(group, w)}
                                  disabled={isPending}
                                  className={cn(
                                    'w-10 h-10 shrink-0 border-r border-b transition-colors relative',
                                    'hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary',
                                    'disabled:opacity-50',
                                    w.isHolidayWeek && 'bg-warning-50/60',
                                    isActive
                                      ? 'bg-success-500 hover:bg-success-600'
                                      : 'bg-gray-200 hover:bg-gray-300',
                                    isPending && 'animate-pulse'
                                  )}
                                  aria-label={`${group.name} KW ${w.isoWeek} ${isActive ? 'aktiv' : 'inaktiv'} umschalten`}
                                >
                                  {isPending && (
                                    <Loader2 className="h-3 w-3 animate-spin absolute inset-0 m-auto text-white" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <div className="text-xs">
                                  <div className="font-medium">
                                    KW {w.isoWeek} · {w.rangeLabel}
                                  </div>
                                  {holidayTip && (
                                    <div className="text-warning-700">{holidayTip}</div>
                                  )}
                                  <div className="mt-1">
                                    Status: {isActive ? '🟢 Aktiv' : '⚪ Inaktiv'}
                                  </div>
                                  {status?.reason && (
                                    <div className="text-muted-foreground">
                                      Grund: {status.reason}
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </TooltipProvider>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Klicke auf eine Zelle, um den Status zu wechseln. Ferienwochen sind gelb hinterlegt. Per
          Bulk-Button aktivierst/deaktivierst du alle Wochen einer Gruppe auf einmal.
        </p>
      </CardContent>
    </Card>
  );
}

export default SeasonCalendarView;
