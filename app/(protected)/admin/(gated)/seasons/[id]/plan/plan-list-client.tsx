'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, ExternalLink, Filter, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

const DAY_LABELS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];

interface PlanEntry {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  trainer_id: string;
  trainer_name: string;
  court_id: string | null;
  court_name: string | null;
  group_id: string | null;
  group_name: string | null;
  entry_type: string;
  status: string;
  max_participants: number;
  participant_count: number;
  notes: string | null;
}

interface Props {
  seasonId: string;
  seasonName: string;
  planningStatus: string;
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300',
  confirmed: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  cancelled: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300',
  draft: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
};

export function PlanListClient({ seasonId, seasonName, planningStatus }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<PlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'planned' | 'confirmed' | 'cancelled'>('all');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(`/api/seasons/${seasonId}/plan-entries`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        const data = await res.json();
        setEntries(data.entries ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Plan konnte nicht geladen werden');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [seasonId]);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => e.status === filter);
  }, [entries, filter]);

  const groupedByDay = useMemo(() => {
    const groups: Record<number, PlanEntry[]> = {};
    for (const e of filtered) {
      if (!groups[e.day_of_week]) groups[e.day_of_week] = [];
      groups[e.day_of_week].push(e);
    }
    // sort by start_time within each day
    for (const k of Object.keys(groups)) {
      groups[Number(k)].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return groups;
  }, [filtered]);

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
            <h1 className="text-2xl font-bold tracking-tight">Plan: {seasonName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{planningStatus}</Badge>
              <span className="text-sm text-muted-foreground">
                {filtered.length} Einheit{filtered.length !== 1 ? 'en' : ''}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/season-plan/${seasonId}`}>
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Grid-Ansicht
              <ExternalLink className="ml-1.5 h-3 w-3 opacity-60" />
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

      {/* Filter */}
      <Card variant="bordered" className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            Status:
          </div>
          {(['all', 'planned', 'confirmed', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-brand-primary text-white'
                  : 'bg-muted/60 dark:bg-background/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'Alle' : f}
            </button>
          ))}
        </div>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Lade Plan…
        </div>
      ) : filtered.length === 0 ? (
        <Card variant="bordered" className="p-12">
          <div className="text-center space-y-3">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold">Keine Plan-Einträge</h3>
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
        <div className="space-y-4">
          {Object.keys(groupedByDay)
            .map(Number)
            .sort((a, b) => a - b)
            .map((day) => (
              <Card key={day} variant="bordered">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-brand-light/10 text-brand-light text-xs font-bold">
                      {day + 1}
                    </span>
                    {DAY_LABELS[day]}
                    <span className="text-xs text-muted-foreground font-normal ml-2">
                      ({groupedByDay[day].length} Einheiten)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border/60 dark:border-white/10">
                          <th className="py-2 pr-3 font-medium">Zeit</th>
                          <th className="py-2 pr-3 font-medium">Trainer</th>
                          <th className="py-2 pr-3 font-medium">Platz</th>
                          <th className="py-2 pr-3 font-medium">Gruppe</th>
                          <th className="py-2 pr-3 font-medium text-right">Teilnehmer</th>
                          <th className="py-2 pr-3 font-medium">Typ</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedByDay[day].map((e) => (
                          <tr
                            key={e.id}
                            className="border-b border-border/30 dark:border-white/5 hover:bg-muted/40 dark:hover:bg-background/40"
                          >
                            <td className="py-2 pr-3 tabular-nums font-mono text-xs">
                              {e.start_time.slice(0, 5)}–{e.end_time.slice(0, 5)}
                              <span className="ml-1 text-muted-foreground">
                                ({e.duration_minutes}min)
                              </span>
                            </td>
                            <td className="py-2 pr-3">{e.trainer_name}</td>
                            <td className="py-2 pr-3 text-muted-foreground">
                              {e.court_name ?? '—'}
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground">
                              {e.group_name ?? '—'}
                            </td>
                            <td className="py-2 pr-3 tabular-nums text-right">
                              {e.participant_count}/{e.max_participants}
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground">{e.entry_type}</td>
                            <td className="py-2 pr-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-2xs font-medium ${
                                  STATUS_COLORS[e.status] ?? STATUS_COLORS.planned
                                }`}
                              >
                                {e.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile list */}
                  <div className="md:hidden space-y-2">
                    {groupedByDay[day].map((e) => (
                      <div
                        key={e.id}
                        className="p-3 rounded-xl border border-border/60 dark:border-white/10 bg-muted/30 dark:bg-background/30"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-sm tabular-nums font-semibold">
                            {e.start_time.slice(0, 5)}–{e.end_time.slice(0, 5)}
                          </span>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-2xs font-medium ${
                              STATUS_COLORS[e.status] ?? STATUS_COLORS.planned
                            }`}
                          >
                            {e.status}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">{e.trainer_name}</span>
                          {e.court_name && (
                            <span className="text-muted-foreground"> · {e.court_name}</span>
                          )}
                          {e.group_name && (
                            <span className="text-muted-foreground"> · {e.group_name}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {e.entry_type} · {e.participant_count}/{e.max_participants} Teilnehmer
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
