'use client';
import { KpiBand } from '@/components/ui/kpi-band';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, XCircle, Clock, Users, Search, BarChart3, ArrowUpDown } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

interface Assignment {
  id: string;
  member_id: string;
  status: string;
  completed_at: string | null;
  name: string;
}

interface DutyWithAssignments {
  id: string;
  title: string;
  duty_type: string;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  priority: string;
  work_duty_assignments: Assignment[];
}

interface MemberStat {
  name: string;
  assigned: number;
  completed: number;
}

type SortKey = 'name' | 'assigned' | 'completed' | 'rate';

export default function AssignmentsClient({
  duties,
  memberStats,
}: {
  duties: DutyWithAssignments[];
  memberStats: Record<string, MemberStat>;
}) {
  const [activeView, setActiveView] = useState<'assignments' | 'stats'>('assignments');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('assigned');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [confirmLoading, setConfirmLoading] = useState<string | null>(null);

  // Flatten all assignments with duty info
  const allAssignments = duties.flatMap((duty) =>
    (duty.work_duty_assignments ?? []).map((a) => ({
      ...a,
      dutyId: duty.id,
      dutyTitle: duty.title,
      dutyDate: duty.scheduled_date,
      dutyTime: duty.start_time,
      dutyStatus: duty.status,
    }))
  );

  // Filter assignments
  const filteredAssignments = allAssignments.filter((a) => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.dutyTitle.toLowerCase().includes(q);
    }
    return true;
  });

  // Member stats array
  const memberStatsArray = Object.entries(memberStats)
    .map(([id, stat]) => ({
      id,
      ...stat,
      rate: stat.assigned > 0 ? Math.round((stat.completed / stat.assigned) * 100) : 0,
    }))
    .filter((m) => {
      if (search) {
        const q = search.toLowerCase();
        return m.name.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const mult = sortDir === 'desc' ? -1 : 1;
      if (sortKey === 'name') return mult * a.name.localeCompare(b.name);
      if (sortKey === 'assigned') return mult * (a.assigned - b.assigned);
      if (sortKey === 'completed') return mult * (a.completed - b.completed);
      return mult * (a.rate - b.rate);
    });

  const handleConfirmCompletion = async (
    dutyId: string,
    assignmentId: string,
    action: 'confirm' | 'reject'
  ) => {
    setConfirmLoading(assignmentId);
    try {
      const res = await apiFetch(`/api/work-duties/${dutyId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(extractErrorMessage(err) || 'Fehler');
        return;
      }
      toast.success(action === 'confirm' ? 'Bestätigt' : 'Abgelehnt');
      // Refresh the page to get updated data
      window.location.reload();
    } catch {
      toast.error('Fehler beim Aktualisieren');
    } finally {
      setConfirmLoading(null);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'assigned':
        return (
          <Badge className="bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-300 text-xs gap-1">
            <Clock className="h-3 w-3" /> Ausstehend
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300 text-xs gap-1">
            <CheckCircle2 className="h-3 w-3" /> Erledigt
          </Badge>
        );
      case 'excused':
        return (
          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 text-xs">
            Entschuldigt
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <KpiBand
        items={[
          { label: 'Gesamt Zuweisungen', value: allAssignments.length },
          {
            label: 'Ausstehend',
            value: allAssignments.filter((a) => a.status === 'assigned').length,
          },
          {
            label: 'Erledigt',
            value: allAssignments.filter((a) => a.status === 'completed').length,
          },
          { label: 'Aktive Mitglieder', value: Object.keys(memberStats).length },
        ]}
      />

      {/* View Toggle + Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('assignments')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeView === 'assignments'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Zuweisungen
          </button>
          <button
            onClick={() => setActiveView('stats')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeView === 'stats'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Statistik
            </span>
          </button>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Assignments View */}
      {activeView === 'assignments' && (
        <div className="space-y-4">
          {/* Status Filter */}
          <div className="flex gap-2">
            {['all', 'assigned', 'completed', 'excused'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterStatus === f
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f === 'all'
                  ? `Alle (${allAssignments.length})`
                  : f === 'assigned'
                    ? `Ausstehend (${allAssignments.filter((a) => a.status === 'assigned').length})`
                    : f === 'completed'
                      ? `Erledigt (${allAssignments.filter((a) => a.status === 'completed').length})`
                      : `Entschuldigt (${allAssignments.filter((a) => a.status === 'excused').length})`}
              </button>
            ))}
          </div>

          {/* Assignments List */}
          {filteredAssignments.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl">
              <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">Keine Zuweisungen gefunden</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAssignments.map((a) => (
                <Card key={`${a.dutyId}-${a.id}`} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{a.name}</span>
                        <span className="text-muted-foreground text-xs">→</span>
                        <span className="text-sm truncate">{a.dutyTitle}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {a.dutyDate && (
                          <span>{new Date(a.dutyDate).toLocaleDateString('de-DE')}</span>
                        )}
                        {a.dutyTime && <span>{a.dutyTime} Uhr</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(a.status)}
                      {a.status === 'completed' && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-success-600"
                            onClick={() => handleConfirmCompletion(a.dutyId, a.id, 'confirm')}
                            disabled={confirmLoading === a.id}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-error-600"
                            onClick={() => handleConfirmCompletion(a.dutyId, a.id, 'reject')}
                            disabled={confirmLoading === a.id}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats View */}
      {activeView === 'stats' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Mitglieder-Statistik
            </CardTitle>
          </CardHeader>
          <CardContent>
            {memberStatsArray.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Keine Daten vorhanden</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        onClick={() => toggleSort('name')}
                        className="flex items-center gap-1 font-medium hover:text-foreground"
                      >
                        Mitglied <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        onClick={() => toggleSort('assigned')}
                        className="flex items-center gap-1 font-medium hover:text-foreground ml-auto"
                      >
                        Zugewiesen <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        onClick={() => toggleSort('completed')}
                        className="flex items-center gap-1 font-medium hover:text-foreground ml-auto"
                      >
                        Erledigt <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        onClick={() => toggleSort('rate')}
                        className="flex items-center gap-1 font-medium hover:text-foreground ml-auto"
                      >
                        Quote <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberStatsArray.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-right">{m.assigned}</TableCell>
                      <TableCell className="text-right text-success-600">{m.completed}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          className={`text-xs ${
                            m.rate >= 80
                              ? 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300'
                              : m.rate >= 50
                                ? 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300'
                                : 'bg-error-100 text-error-800 dark:bg-error-900/30 dark:text-error-300'
                          }`}
                        >
                          {m.rate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
