'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { KpiBand } from '@/components/ui/kpi-band';
import { PageHeader } from '@/components/ui/page-header';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconBox } from '@/components/ui/icon-box';
import { CheckCircle, XCircle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaginationNav } from '@/components/ui/pagination-nav';
import { buildPaginationMeta } from '@/lib/pagination';
import type { PaginationMeta } from '@/lib/pagination';
import { apiFetch } from '@/lib/api-fetch';

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
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const pageSize = 15;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/attendance-records?page=${page}&pageSize=${pageSize}&filter=${filter}`
      );
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      setRecords(data.records || []);
      setPagination(buildPaginationMeta(page, pageSize, data.total ?? 0));
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError')
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
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
      <PageHeader
        title="Anwesenheitshistorie"
        description="Deine Trainings-Anwesenheit im Überblick"
      />

      {/* Stats cards */}
      <KpiBand
        items={[
          {
            label: 'Gesamt',
            value: stats.total,
          },
          {
            label: 'Anwesend',
            value: stats.attended,
          },
          {
            label: 'Verpasst',
            value: stats.missed,
          },
          {
            label: 'Quote',
            value: `${stats.rate}%`,
          },
        ]}
      />

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
          <div className="w-full space-y-3" role="status" aria-label="Wird geladen">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-error-600">{error}</CardContent>
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
                    <p className="text-sm text-muted-foreground mt-0.5 italic">{r.notes}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && <PaginationNav meta={pagination} compact onPageChange={setPage} />}
    </div>
  );
}
