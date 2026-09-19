'use client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  Hourglass,
  Trash2,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from '@/lib/locale';
import { apiFetch } from '@/lib/api-fetch';

import { createLogger } from '@/lib/logger';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const log = createLogger('admin:hours-logs:hours-logs-client');

const HOURS_STATUS_ICONS: Record<string, LucideIcon> = {
  approved: CheckCircle,
  rejected: XCircle,
  pending: Hourglass,
};

interface HoursLog {
  id: string;
  trainer_id: string;
  trainer_name: string;
  date: string;
  hours: number;
  session_id?: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

export default function HoursLogsClient() {
  const [logs, setLogs] = useState<HoursLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [trainerFilter, setTrainerFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchHoursLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (trainerFilter !== 'all') params.set('trainerId', trainerFilter);
      if (selectedMonth) {
        params.set('startDate', `${selectedMonth}-01`);
        const end = new Date(`${selectedMonth}-01`);
        end.setMonth(end.getMonth() + 1);
        params.set('endDate', end.toISOString().substring(0, 10));
      }

      const response = await apiFetch(`/api/hours-logs?${params.toString()}`);
      if (!response.ok) throw new Error('Fehler beim Laden');
      const data = await response.json();
      setLogs(data.hoursLogs || []);
    } catch (error) {
      log.error('Fetch error:', error);
      toast.error('Fehler beim Laden der Stundennachweise');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, trainerFilter, selectedMonth]);

  useEffect(() => {
    fetchHoursLogs();
  }, [fetchHoursLogs]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/hours-logs/${id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err) || 'Fehler bei der Genehmigung');
      }
      toast.success('Stundennachweis genehmigt');
      fetchHoursLogs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) {
      toast.error('Bitte einen Ablehnungsgrund eingeben');
      return;
    }
    setActionLoading(rejectId);
    try {
      const res = await apiFetch(`/api/hours-logs/${rejectId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err) || 'Fehler bei der Ablehnung');
      }
      toast.success('Stundennachweis abgelehnt');
      setRejectId(null);
      setRejectReason('');
      fetchHoursLogs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setActionLoading(deleteId);
    try {
      const res = await apiFetch(`/api/hours-logs/${deleteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err) || 'Fehler beim Löschen');
      }
      toast.success('Stundennachweis gelöscht');
      setDeleteId(null);
      fetchHoursLogs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => (
    <StatusBadge status={status} icon={HOURS_STATUS_ICONS[status]} />
  );

  const getTypeLabel = (hours: number, description?: string) => {
    if (description) return description;
    return `${hours.toFixed(1)}h`;
  };

  // Unique trainers for filter dropdown
  const uniqueTrainers = Array.from(
    new Map(logs.map((l) => [l.trainer_id, l.trainer_name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  // Stats
  const stats = {
    total: logs.length,
    pending: logs.filter((l) => l.status === 'pending').length,
    approved: logs.filter((l) => l.status === 'approved').length,
    rejected: logs.filter((l) => l.status === 'rejected').length,
    totalHours: logs.reduce((sum, l) => sum + l.hours, 0),
    pendingHours: logs.filter((l) => l.status === 'pending').reduce((sum, l) => sum + l.hours, 0),
    approvedHours: logs.filter((l) => l.status === 'approved').reduce((sum, l) => sum + l.hours, 0),
    uniqueTrainers: uniqueTrainers.length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground">Gesamt</p>
                <p className="text-xl font-bold mt-0.5">{stats.total}</p>
              </div>
              <Clock className="h-5 w-5 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                  Ausstehend
                </p>
                <p className="text-xl font-bold mt-0.5 text-warning-600">{stats.pending}</p>
              </div>
              <Hourglass className="h-5 w-5 text-warning-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                  Genehmigt
                </p>
                <p className="text-xl font-bold mt-0.5 text-success-600">{stats.approved}</p>
              </div>
              <CheckCircle className="h-5 w-5 text-success-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                  Stunden gesamt
                </p>
                <p className="text-xl font-bold mt-0.5 text-primary dark:text-brand-light">
                  {stats.totalHours.toFixed(1)}h
                </p>
              </div>
              <TrendingUp className="h-5 w-5 text-brand-light/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Alert */}
      {stats.pending > 0 && (
        <div className="rounded-xl bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-900/20 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning-600" />
            <div>
              <p className="text-sm font-medium text-warning-800 dark:text-warning-200">
                {stats.pending} ausstehende Stundennachweise
              </p>
              <p className="text-xs text-warning-600 dark:text-warning-400">
                {stats.pendingHours.toFixed(1)}h warten auf Genehmigung
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground dark:text-foreground">
            <Filter className="h-4 w-4" />
            Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="hl-filter-status"
                className="text-xs font-medium mb-1.5 block text-muted-foreground dark:text-muted-foreground"
              >
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="hl-filter-status">
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="pending">Ausstehend</SelectItem>
                  <SelectItem value="approved">Genehmigt</SelectItem>
                  <SelectItem value="rejected">Abgelehnt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label
                htmlFor="hl-filter-trainer"
                className="text-xs font-medium mb-1.5 block text-muted-foreground dark:text-muted-foreground"
              >
                Trainer
              </label>
              <Select value={trainerFilter} onValueChange={setTrainerFilter}>
                <SelectTrigger id="hl-filter-trainer">
                  <SelectValue placeholder="Alle Trainer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Trainer</SelectItem>
                  {uniqueTrainers.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label
                htmlFor="hl-filter-month"
                className="text-xs font-medium mb-1.5 block text-muted-foreground dark:text-muted-foreground"
              >
                Monat
              </label>
              <Input
                id="hl-filter-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="p-0">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-sm text-foreground dark:text-gray-200">
            Einträge ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {logs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="h-16 w-16 rounded-xl bg-muted dark:bg-card/5 flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8" />
              </div>
              <p className="font-medium text-muted-foreground">Keine Stundennachweise</p>
              <p className="text-sm mt-1">
                {statusFilter !== 'all' || trainerFilter !== 'all' || selectedMonth
                  ? 'Passe deine Filterkriterien an.'
                  : 'Es wurden noch keine Stunden erfasst.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-muted dark:bg-muted">
                  <TableRow>
                    <TableHead className="px-4 py-3 text-left text-xs font-semibold text-foreground dark:text-foreground">
                      Trainer
                    </TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-semibold text-foreground dark:text-foreground">
                      Datum
                    </TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-semibold text-foreground dark:text-foreground">
                      Zeit
                    </TableHead>
                    <TableHead className="px-4 py-3 text-right text-xs font-semibold text-foreground dark:text-foreground">
                      Stunden
                    </TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-semibold text-foreground dark:text-foreground">
                      Status
                    </TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-semibold text-foreground dark:text-foreground hidden md:table-cell">
                      Notizen
                    </TableHead>
                    <TableHead className="px-4 py-3 text-right text-xs font-semibold text-foreground dark:text-foreground">
                      Aktionen
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border dark:divide-white/10">
                  {logs.map((log) => (
                    <>
                      <TableRow
                        key={log.id}
                        className="hover:bg-muted dark:hover:bg-background/5 transition-colors"
                      >
                        <TableCell className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary text-xs font-semibold shrink-0">
                              {log.trainer_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-sm text-foreground dark:text-white truncate max-w-[150px]">
                              {log.trainer_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground dark:text-muted-foreground">
                          {format(parseISO(log.date), 'dd. MMM yyyy', { locale: de })}
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground dark:text-muted-foreground">
                          {getTypeLabel(log.hours, log.description)}
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-right text-foreground dark:text-white">
                          {log.hours.toFixed(1)}h
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap">
                          {getStatusBadge(log.status)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground dark:text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                          {log.description || '—'}
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            {log.status === 'pending' && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-success-600 hover:text-success-700 hover:bg-success-50"
                                      disabled={actionLoading === log.id}
                                      onClick={() => handleApprove(log.id)}
                                      aria-label="Genehmigen"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Genehmigen</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-warning-600 hover:text-warning-700 hover:bg-warning-50"
                                      disabled={actionLoading === log.id}
                                      onClick={() => setRejectId(log.id)}
                                      aria-label="Ablehnen"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ablehnen</TooltipContent>
                                </Tooltip>
                              </>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-error-400 hover:text-error-600 hover:bg-error-50"
                                  disabled={actionLoading === log.id}
                                  onClick={() => setDeleteId(log.id)}
                                  aria-label="Löschen"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Löschen</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                      {log.status === 'rejected' && log.rejection_reason && (
                        <TableRow className="bg-error-50/50 dark:bg-error-900/5">
                          <TableCell
                            colSpan={7}
                            className="px-4 py-2 text-xs text-error-600 dark:text-error-400"
                          >
                            <span className="font-medium">Ablehnungsgrund:</span>{' '}
                            {log.rejection_reason}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Footer */}
      {logs.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground dark:text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            {stats.uniqueTrainers} Trainer
          </span>
          <span>·</span>
          <span>{stats.totalHours.toFixed(1)}h gesamt</span>
          <span>·</span>
          <span className="text-success-600">{stats.approvedHours.toFixed(1)}h genehmigt</span>
          {stats.pendingHours > 0 && (
            <>
              <span>·</span>
              <span className="text-warning-600">{stats.pendingHours.toFixed(1)}h ausstehend</span>
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background dark:bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-bold text-foreground dark:text-white">
              Stundennachweis löschen?
            </h3>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              Dieser Eintrag wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig
              gemacht werden.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteId(null)}
                disabled={!!actionLoading}
              >
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDelete}
                disabled={!!actionLoading}
              >
                {actionLoading === deleteId ? 'Wird gelöscht...' : 'Löschen'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background dark:bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-bold text-foreground dark:text-white">
              Stundennachweis ablehnen
            </h3>
            <div>
              <label
                htmlFor="hl-reject-reason"
                className="text-sm font-medium mb-1.5 block text-foreground dark:text-foreground"
              >
                Ablehnungsgrund *
              </label>
              <Input
                id="hl-reject-reason"
                placeholder="Grund für die Ablehnung..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setRejectId(null);
                  setRejectReason('');
                }}
                disabled={!!actionLoading}
              >
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleReject}
                disabled={!!actionLoading || !rejectReason.trim()}
              >
                {actionLoading === rejectId ? 'Wird abgelehnt...' : 'Ablehnen'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
