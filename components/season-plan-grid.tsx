'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, Users, Clock, MapPin, LayoutGrid, List } from 'lucide-react';

// ── Types ──────────────────────────────────────────────

export interface GridSlot {
  id: string;
  group_id: string | null;
  group_name: string;
  group_color: string;
  trainer_id: string;
  trainer_name: string;
  court_id: string | null;
  court_name: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  duration_min: number;
  member_ids: string[];
  member_count: number;
  status: string;
}

export interface GridGroup {
  id: string;
  name: string;
  color: string;
  level: string;
  age_group: string;
}

export interface GridCourt {
  id: string;
  name: string;
}

interface SeasonPlanGridProps {
  slots: GridSlot[];
  groups: GridGroup[];
  courts: GridCourt[];
  seasonName?: string;
  onSlotClick?: (slot: GridSlot) => void;
  loading?: boolean;
}

// ── Constants ──────────────────────────────────────────

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
function formatTime(time: string) {
  return time.substring(0, 5);
}

// ── Component ──────────────────────────────────────────

export default function SeasonPlanGrid({
  slots,
  groups,
  courts,
  seasonName,
  onSlotClick,
  loading = false,
}: SeasonPlanGridProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterCourt, setFilterCourt] = useState<string>('all');
  const [filterDay, setFilterDay] = useState<string>('all');

  // Filter slots
  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (
        search &&
        !slot.group_name.toLowerCase().includes(search.toLowerCase()) &&
        !slot.trainer_name.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (filterGroup !== 'all' && slot.group_id !== filterGroup) return false;
      if (filterCourt !== 'all' && slot.court_id !== filterCourt) return false;
      if (filterDay !== 'all' && slot.day_of_week !== parseInt(filterDay)) return false;
      return true;
    });
  }, [slots, search, filterGroup, filterCourt, filterDay]);

  // Group slots by court for the grid view
  const slotsByCourt = useMemo(() => {
    const map = new Map<string | 'none', GridSlot[]>();
    filteredSlots.forEach((slot) => {
      const key = slot.court_id || 'none';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    });
    return map;
  }, [filteredSlots]);

  // Group slots by week for list view
  const slotsByDay = useMemo(() => {
    const map = new Map<number, GridSlot[]>();
    filteredSlots.forEach((slot) => {
      if (!map.has(slot.day_of_week)) map.set(slot.day_of_week, []);
      map.get(slot.day_of_week)!.push(slot);
    });
    return map;
  }, [filteredSlots]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          Lade Stundenplan…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {seasonName ? `Stundenplan: ${seasonName}` : 'Wochenstundenplan'}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{slots.length} geplante Einheiten</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-1" />
            Liste
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Gruppe oder Trainer suchen…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterGroup} onValueChange={setFilterGroup}>
                <SelectTrigger className="h-9 w-[160px] text-sm">
                  <SelectValue placeholder="Alle Gruppen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Gruppen</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: g.color }}
                        />
                        {g.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCourt} onValueChange={setFilterCourt}>
                <SelectTrigger className="h-9 w-[160px] text-sm">
                  <SelectValue placeholder="Alle Plätze" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Plätze</SelectItem>
                  {courts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterDay} onValueChange={setFilterDay}>
                <SelectTrigger className="h-9 w-[140px] text-sm">
                  <SelectValue placeholder="Alle Tage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Tage</SelectItem>
                  {DAY_NAMES.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Grid Header - Court rows × Day columns */}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `140px repeat(7, 1fr)`,
                }}
              >
                {/* Corner cell */}
                <div className="h-10 border-b border-r border-border bg-muted flex items-center px-3">
                  <span className="text-xs font-semibold text-muted-foreground">Platz / Tag</span>
                </div>
                {/* Day headers */}
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="h-10 border-b border-r border-border bg-muted flex items-center justify-center"
                  >
                    <span className="text-xs font-semibold text-muted-foreground">{day}</span>
                  </div>
                ))}

                {/* Court rows */}
                {courts.length === 0 ? (
                  <div className="col-span-8 h-20 flex items-center justify-center text-sm text-muted-foreground">
                    Keine Plätze gefunden
                  </div>
                ) : (
                  courts.map((court) =>
                    [0, 1, 2, 3, 4, 5, 6].map((day) => {
                      const courtSlots = (slotsByCourt.get(court.id) || []).filter(
                        (s) => s.day_of_week === day
                      );
                      return (
                        <div
                          key={`${court.id}-${day}`}
                          className="min-h-[60px] border-b border-r border-border p-1 space-y-1"
                        >
                          {day === 0 && (
                            <div className="text-xs font-medium text-muted-foreground mb-1 px-1">
                              {court.name}
                            </div>
                          )}
                          {courtSlots.length === 0 ? (
                            <div className="h-full flex items-center justify-center">
                              <span className="text-[10px] text-muted-foreground/50">—</span>
                            </div>
                          ) : (
                            courtSlots.map((slot) => (
                              <button
                                key={slot.id}
                                onClick={() => onSlotClick?.(slot)}
                                className="w-full text-left rounded px-1.5 py-1 text-white text-xs transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer"
                                style={{ backgroundColor: slot.group_color }}
                                title={`${slot.group_name} · ${slot.trainer_name} · ${slot.member_count} TN`}
                              >
                                <div className="font-semibold truncate leading-tight">
                                  {slot.group_name}
                                </div>
                                <div className="opacity-80 text-[10px] leading-tight">
                                  {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => {
            const daySlots = slotsByDay.get(day) || [];
            if (daySlots.length === 0 && filterDay === 'all') return null;
            return (
              <Card key={day}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    {DAY_NAMES[day]}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {daySlots.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {daySlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Keine Einheiten
                    </p>
                  ) : (
                    <div className="divide-y">
                      {daySlots
                        .sort((a, b) => a.start_time.localeCompare(b.start_time))
                        .map((slot) => (
                          <div
                            key={slot.id}
                            className="flex items-center gap-4 py-3 hover:bg-muted px-2 rounded-lg transition-colors cursor-pointer"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSlotClick?.(slot);
                              }
                            }}
                            onClick={() => onSlotClick?.(slot)}
                          >
                            <div
                              className="w-1 h-10 rounded-full shrink-0"
                              style={{ backgroundColor: slot.group_color }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm truncate">
                                  {slot.group_name}
                                </span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                  {slot.status === 'published'
                                    ? 'Veröffentlicht'
                                    : slot.status === 'planned'
                                      ? 'Geplant'
                                      : slot.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {slot.trainer_name}
                                </span>
                                {slot.court_name && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {slot.court_name}
                                  </span>
                                )}
                                <span className="text-muted-foreground">
                                  {slot.member_count} TN
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Legend */}
      {groups.length > 0 && viewMode === 'grid' && (
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-4">
              {groups.map((group) => (
                <div key={group.id} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                  <span className="text-muted-foreground">{group.name}</span>
                  <span className="text-muted-foreground">
                    ({group.level},{' '}
                    {group.age_group === 'youth'
                      ? 'Jugend'
                      : group.age_group === 'adult'
                        ? 'Erwachsene'
                        : 'Senioren'}
                    )
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {slots.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <LayoutGrid className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Keine geplanten Einheiten</p>
            <p className="text-sm text-muted-foreground mt-1">
              Führe zuerst die Saisonplanung im Wizard durch.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
