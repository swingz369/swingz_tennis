'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, List, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface GridSlot {
  id: string;
  group_id: string | null;
  group_name: string;
  group_color: string;
  trainer_id: string | null;
  trainer_name: string;
  court_id: string | null;
  court_name: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  duration_min: number;
  member_count: number;
  status: string;
}

interface GroupInfo {
  id: string;
  name: string;
  color: string;
  level: string | null;
  age_group: string | null;
}

interface CourtInfo {
  id: string;
  name: string;
}

interface Props {
  seasonId: string;
  clubId: string;
  seasonName: string;
}

interface TimeRow {
  label: string;
  hour: number;
  minute: number;
}

const TIME_START = 7; // 07:00
const TIME_END = 22; // 22:00 (exclusive)
const ROW_MIN = 30; // 30-min granularity

function buildTimeRows(): TimeRow[] {
  const rows: TimeRow[] = [];
  for (let h = TIME_START; h < TIME_END; h++) {
    for (let m = 0; m < 60; m += ROW_MIN) {
      rows.push({
        label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        hour: h,
        minute: m,
      });
    }
  }
  return rows;
}

function parseHHMM(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(':').map(Number);
  return { hour: h, minute: m };
}

function rowIndex(t: string): number {
  const { hour, minute } = parseHHMM(t);
  return (hour - TIME_START) * (60 / ROW_MIN) + minute / ROW_MIN;
}

function durationRows(slot: GridSlot): number {
  return Math.max(1, Math.ceil(slot.duration_min / ROW_MIN));
}

export function SeasonPlanGridClient({ seasonId, seasonName }: Props) {
  const router = useRouter();
  const [slots, setSlots] = useState<GridSlot[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [courts, setCourts] = useState<CourtInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(`/api/seasons/${seasonId}/plan-grid`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        const data = await res.json();
        setSlots(data.slots ?? []);
        setGroups(data.groups ?? []);
        setCourts(data.courts ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Stundenplan konnte nicht geladen werden');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [seasonId]);

  const timeRows = useMemo(() => buildTimeRows(), []);

  // Group slots by (day, rowStart) so we can place them
  const grid = useMemo(() => {
    const map = new Map<string, GridSlot[]>();
    for (const s of slots) {
      const r = rowIndex(s.start_time);
      const key = `${s.day_of_week}-${r}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [slots]);

  // For each day, find occupied row indices so we can show 1h-blocks
  const occupiedRowsByDay = useMemo(() => {
    const out: Record<number, Set<number>> = {};
    for (const s of slots) {
      if (!out[s.day_of_week]) out[s.day_of_week] = new Set();
      const start = rowIndex(s.start_time);
      const dur = durationRows(s);
      for (let i = 0; i < dur; i++) out[s.day_of_week].add(start + i);
    }
    return out;
  }, [slots]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/admin/seasons/${seasonId}`)}
            aria-label="Zurück zur Saison"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Stundenplan: {seasonName}</h1>
            <p className="text-sm text-muted-foreground">Wochenraster mit farbcodierten Gruppen</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/seasons/${seasonId}/plan`}>
            <Button variant="outline">
              <List className="mr-2 h-4 w-4" />
              Listen-Ansicht
            </Button>
          </Link>
          <Link href={`/admin/seasons/${seasonId}/planning`}>
            <Button>
              <Calendar className="mr-2 h-4 w-4" />
              Planung öffnen
            </Button>
          </Link>
        </div>
      </div>

      {/* Legend */}
      {groups.length > 0 && (
        <Card variant="bordered" className="p-4">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
            <span>Gruppen-Legende</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <div
                key={g.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: g.color }}
              >
                {g.name}
                {g.level && <span className="opacity-75 text-[10px]">· {g.level}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Lade Stundenplan…
        </div>
      ) : slots.length === 0 ? (
        <Card variant="bordered" className="p-12">
          <div className="text-center space-y-3">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold">Keine Einträge im Stundenplan</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Für diese Saison wurden noch keine Trainingseinheiten geplant. Öffne die Planung, um
              den Algorithmus zu starten oder Einträge manuell anzulegen.
            </p>
            <Button onClick={() => router.push(`/admin/seasons/${seasonId}/planning`)}>
              Planung öffnen
            </Button>
          </div>
        </Card>
      ) : (
        <Card variant="bordered" className="overflow-x-auto">
          <div
            className="grid border-b border-border/60 dark:border-white/10"
            style={{ gridTemplateColumns: '60px repeat(7, minmax(120px, 1fr))' }}
          >
            <div className="p-2 text-xs font-semibold text-muted-foreground border-r border-border/60 dark:border-white/10 sticky left-0 bg-card z-10">
              Zeit
            </div>
            {DAY_LABELS.map((d, i) => (
              <div
                key={d}
                className="p-2 text-xs font-semibold text-center border-r border-border/60 dark:border-white/10 last:border-r-0"
              >
                {d}
                {occupiedRowsByDay[i] && occupiedRowsByDay[i].size > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-4 px-1 rounded-full bg-brand-light/15 text-brand-light text-[10px] tabular-nums">
                    {occupiedRowsByDay[i].size}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div
            className="grid"
            style={{ gridTemplateColumns: '60px repeat(7, minmax(120px, 1fr))' }}
          >
            {timeRows.map((row, rowIdx) => {
              const showHourLabel = row.minute === 0;
              return (
                <div key={row.label} className="contents">
                  <div
                    className={`p-1.5 text-[10px] tabular-nums text-right text-muted-foreground border-r border-b border-border/40 dark:border-white/5 sticky left-0 bg-card z-10 ${
                      row.minute === 30 ? 'opacity-60' : 'font-medium'
                    }`}
                    style={{ minHeight: 32 }}
                  >
                    {showHourLabel ? row.label : ''}
                  </div>
                  {DAY_LABELS.map((_, dayIdx) => {
                    const slot = grid.get(`${dayIdx}-${rowIdx}`);
                    const showHourBg = row.minute === 0;
                    if (slot && slot.length > 0) {
                      const s = slot[0];
                      const rows = durationRows(s);
                      return (
                        <div
                          key={`${dayIdx}-${rowIdx}`}
                          className="border-r border-b border-border/40 dark:border-white/5 p-1 relative"
                          style={{
                            minHeight: 32,
                            gridRow: `span ${rows}`,
                            backgroundColor: `${s.group_color}1A`,
                            borderLeft: `3px solid ${s.group_color}`,
                          }}
                          title={`${s.group_name} · ${s.trainer_name} · ${s.start_time}-${s.end_time}`}
                        >
                          <div
                            className="text-[10px] font-semibold leading-tight truncate"
                            style={{ color: s.group_color }}
                          >
                            {s.group_name}
                          </div>
                          <div className="text-[10px] text-foreground/80 tabular-nums">
                            {s.start_time}–{s.end_time}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {s.trainer_name}
                            {s.court_name && ` · ${s.court_name}`}
                          </div>
                          {rows > 1 && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {s.member_count} TN
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div
                        key={`${dayIdx}-${rowIdx}`}
                        className={`border-r border-b border-border/40 dark:border-white/5 ${
                          showHourBg ? 'bg-muted/20 dark:bg-background/20' : ''
                        }`}
                        style={{ minHeight: 32 }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Court summary */}
      {courts.length > 0 && (
        <Card variant="bordered" className="p-4">
          <div className="text-sm font-semibold mb-2">Verfügbare Plätze ({courts.length})</div>
          <div className="flex flex-wrap gap-2">
            {courts.map((c) => (
              <Badge key={c.id} variant="outline">
                {c.name}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
