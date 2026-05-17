'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconBox } from '@/components/ui/icon-box';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AttendanceRecord {
  id: string;
  session_id: string;
  member_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  court?: string;
  group?: string;
  attended: boolean;
  notes?: string;
}

export default function AttendanceHistory() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'attended' | 'missed'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 15;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/attendance-records?page=${page}&pageSize=${pageSize}&filter=${filter}`
      );
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      setRecords(data.records || []);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const stats = {
    total: records.length,
    attended: records.filter((r) => r.attended).length,
    missed: records.filter((r) => !r.attended).length,
    rate:
      records.length > 0
        ? Math.round((records.filter((r) => r.attended).length / records.length) * 100)
        : 0,
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  const formatTime = (t: string) => t?.substring(0, 5) || '';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Anwesenheitshistorie</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Deine Trainings-Anwesenheit im Überblick
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Gesamt',
            value: stats.total,
            icon: Calendar,
            color: 'text-blue-600',
            bg: 'bg-blue-50 dark:bg-blue-900/20',
          },
          {
            label: 'Anwesend',
            value: stats.attended,
            icon: CheckCircle,
            color: 'text-green-600',
            bg: 'bg-green-50 dark:bg-green-900/20',
          },
          {
            label: 'Verpasst',
            value: stats.missed,
            icon: XCircle,
            color: 'text-red-600',
            bg: 'bg-red-50 dark:bg-red-900/20',
          },
          {
            label: 'Quote',
            value: `${stats.rate}%`,
            icon: Clock,
            color: 'text-amber-600',
            bg: 'bg-amber-50 dark:bg-amber-900/20',
          },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'attended', 'missed'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
          >
            <Filter className="h-3.5 w-3.5 mr-1" />
            {f === 'all' ? 'Alle' : f === 'attended' ? 'Anwesend' : 'Verpasst'}
          </Button>
        ))}
      </div>

      {/* Records list */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <Loader2 className="h-6 w-6 animate-spin text-brand-light" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-red-600">{error}</CardContent>
        </Card>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Keine Einträge gefunden
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <Card key={r.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <IconBox
                  icon={r.attended ? CheckCircle : XCircle}
                  size="md"
                  variant={r.attended ? 'green' : 'red'}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{r.court || r.group || 'Training'}</p>
                    <Badge variant={r.attended ? 'default' : 'secondary'} className="text-xs">
                      {r.attended ? 'Anwesend' : 'Abwesend'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(r.session_date)} · {formatTime(r.start_time)}–
                    {formatTime(r.end_time)}
                  </p>
                  {r.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">{r.notes}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Seite {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
