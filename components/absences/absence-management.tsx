'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { PageHeader } from '@/components/ui/page-header';
import { Loader2, CheckCircle, XCircle, CalendarOff } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { formatDate } from '@/lib/format';

interface Absence {
  id: string;
  trainerId: string;
  trainerName: string;
  type: 'sick' | 'vacation' | 'personal' | 'other' | 'training';
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
}

const TYPE_LABELS: Record<Absence['type'], string> = {
  vacation: 'Urlaub',
  sick: 'Krankheit',
  personal: 'Persönlich',
  training: 'Fortbildung',
  other: 'Sonstiges',
};

const STATUS_LABELS: Record<Absence['status'], string> = {
  pending: 'Ausstehend',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
};

export function AbsenceManagement({
  isAdmin = false,
  adminUserId,
  trainerId,
  trainerName,
}: {
  isAdmin?: boolean;
  adminUserId?: string;
  trainerId?: string;
  trainerName?: string;
}) {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  // Antrags-Formular (nur Trainer-Modus)
  const [type, setType] = useState<Absence['type']>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = isAdmin ? '/api/absences' : `/api/absences?trainerId=${trainerId}`;
      const res = await apiFetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAbsences(data.absences ?? []);
    } catch {
      toast.error('Abwesenheiten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, trainerId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    if (!trainerId || !trainerName || !startDate || !endDate) {
      toast.error('Bitte Zeitraum angeben');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trainerId,
          trainerName,
          type,
          startDate,
          endDate,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Antrag konnte nicht gespeichert werden');
      }
      const data = await res.json();
      if (data.absence) setAbsences((prev) => [data.absence, ...prev]);
      setStartDate('');
      setEndDate('');
      setReason('');
      toast.success('Abwesenheit beantragt');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Antrag konnte nicht gespeichert werden');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecision = async (id: string, decision: 'approve' | 'reject') => {
    if (!adminUserId) return;
    setActing(`${id}:${decision}`);
    try {
      const res = await apiFetch(`/api/absences/${id}/${decision}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          decision === 'approve' ? { approvedBy: adminUserId } : { rejectedBy: adminUserId }
        ),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Aktion fehlgeschlagen');
      }
      const data = await res.json().catch(() => ({}));
      setAbsences((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: decision === 'approve' ? 'approved' : 'rejected' } : a
        )
      );
      toast.success(decision === 'approve' ? 'Abwesenheit genehmigt' : 'Abwesenheit abgelehnt');

      const sessionConflicts = data?.sessionConflicts as
        Array<{ id: string; date: string }> | undefined;
      if (decision === 'approve' && sessionConflicts && sessionConflicts.length > 0) {
        toast.warning(
          `Achtung: ${sessionConflicts.length} bereits geplante Trainingseinheit${
            sessionConflicts.length === 1 ? '' : 'en'
          } fällt/fallen in den Abwesenheitszeitraum — bitte Vertretung organisieren oder Termine verschieben.`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abwesenheiten"
        description={
          isAdmin
            ? 'Abwesenheitsanträge der Trainer prüfen und genehmigen'
            : 'Urlaub, Krankheit oder andere Abwesenheiten melden'
        }
      />

      {!isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" aria-hidden="true" />
              Abwesenheit beantragen
            </CardTitle>
            <CardDescription>
              Genehmigte Abwesenheiten werden bei der Saison- und Wochenplanung berücksichtigt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="absence-type">
                  Art
                </label>
                <Select value={type} onValueChange={(v) => setType(v as Absence['type'])}>
                  <SelectTrigger id="absence-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacation">Urlaub</SelectItem>
                    <SelectItem value="sick">Krankheit</SelectItem>
                    <SelectItem value="personal">Persönlich</SelectItem>
                    <SelectItem value="other">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="absence-start">
                  Von
                </label>
                <input
                  id="absence-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="absence-end">
                  Bis
                </label>
                <input
                  id="absence-end"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="absence-reason">
                Grund (optional)
              </label>
              <Textarea
                id="absence-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="z. B. Familienurlaub"
              />
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Abwesenheit beantragen
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isAdmin ? 'Alle Anträge' : 'Meine Abwesenheiten'}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" aria-hidden="true" />
              Abwesenheiten werden geladen …
            </div>
          ) : absences.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Keine Abwesenheiten vorhanden.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && <TableHead>Trainer</TableHead>}
                    <TableHead>Zeitraum</TableHead>
                    <TableHead>Art</TableHead>
                    <TableHead>Grund</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead className="text-right">Aktionen</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absences.map((a) => (
                    <TableRow key={a.id}>
                      {isAdmin && <TableCell className="font-medium">{a.trainerName}</TableCell>}
                      <TableCell>
                        {formatDate(a.startDate)} – {formatDate(a.endDate)}
                      </TableCell>
                      <TableCell>{TYPE_LABELS[a.type] ?? a.type}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {a.reason || '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} label={STATUS_LABELS[a.status]} size="sm" />
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {a.status === 'pending' && (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={acting === `${a.id}:approve`}
                                onClick={() => handleDecision(a.id, 'approve')}
                                className="gap-1"
                              >
                                {acting === `${a.id}:approve` ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" aria-hidden="true" />
                                )}
                                Genehmigen
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={acting === `${a.id}:reject`}
                                onClick={() => handleDecision(a.id, 'reject')}
                                className="gap-1 text-muted-foreground"
                              >
                                <XCircle className="h-4 w-4" aria-hidden="true" />
                                Ablehnen
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
