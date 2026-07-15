'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, CheckCircle, XCircle, Plus, Calendar, Filter, Hourglass } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from '@/lib/locale';
import { apiFetch } from '@/lib/api-fetch';

interface HoursLog {
  id: string;
  trainer_id: string;
  trainer_name: string;
  date: string;
  hours: number;
  session_id?: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
}

interface NewEntry {
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  notes: string;
}

export default function TrainerHoursLogsPage() {
  const [logs, setLogs] = useState<HoursLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [showForm, setShowForm] = useState(false);

  // New entry form
  const [newEntry, setNewEntry] = useState<NewEntry>({
    date: new Date().toISOString().substring(0, 10),
    startTime: '09:00',
    endTime: '10:00',
    type: 'training',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchHoursLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (selectedMonth) {
        params.set('startDate', selectedMonth + '-01');
        const end = new Date(selectedMonth + '-01');
        end.setMonth(end.getMonth() + 1);
        params.set('endDate', end.toISOString().substring(0, 10));
      }

      const response = await apiFetch(`/api/hours-logs?${params.toString()}`);
      if (!response.ok) throw new Error('Fehler beim Laden');

      const data = await response.json();
      setLogs(data.hoursLogs || []);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Fehler beim Laden der Stundennachweise');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedMonth]);

  useEffect(() => {
    fetchHoursLogs();
  }, [fetchHoursLogs]);

  const handleCreate = async () => {
    if (!newEntry.date || !newEntry.startTime || !newEntry.endTime) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    // Basic validation: start before end
    if (newEntry.startTime >= newEntry.endTime) {
      toast.error('Endzeit muss nach Startzeit liegen');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch('/api/hours-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newEntry.date,
          startTime: newEntry.startTime,
          endTime: newEntry.endTime,
          type: newEntry.type,
          notes: newEntry.notes || null,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Fehler beim Erstellen');
      }

      toast.success('Stundennachweis erstellt');
      setShowForm(false);
      setNewEntry({
        date: new Date().toISOString().substring(0, 10),
        startTime: '09:00',
        endTime: '10:00',
        type: 'training',
        notes: '',
      });
      fetchHoursLogs();
    } catch (error) {
      console.error('Create error:', error);
      toast.error(error instanceof Error ? error.message : 'Fehler beim Erstellen');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Genehmigt
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="error" className="gap-1">
            <XCircle className="h-3 w-3" />
            Abgelehnt
          </Badge>
        );
      default:
        return (
          <Badge variant="warning" className="gap-1">
            <Hourglass className="h-3 w-3" />
            Ausstehend
          </Badge>
        );
    }
  };

  const stats = {
    total: logs.length,
    pending: logs.filter((l) => l.status === 'pending').length,
    approved: logs.filter((l) => l.status === 'approved').length,
    rejected: logs.filter((l) => l.status === 'rejected').length,
    totalHours: logs.reduce((sum, l) => sum + l.hours, 0),
    pendingHours: logs.filter((l) => l.status === 'pending').reduce((sum, l) => sum + l.hours, 0),
    approvedHours: logs.filter((l) => l.status === 'approved').reduce((sum, l) => sum + l.hours, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-primary dark:text-white">
            Meine Stundennachweise
          </h1>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">
            Erfasse und verwalte deine geleisteten Stunden
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? 'Schließen' : 'Neue Stunden'}
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="border-brand-light/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-brand-light" />
              Neue Stundeneintragung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="trainer-hl-date"
                  className="text-sm font-medium mb-1.5 block text-foreground dark:text-foreground"
                >
                  Datum *
                </label>
                <Input
                  id="trainer-hl-date"
                  type="date"
                  value={newEntry.date}
                  onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                />
              </div>
              <div>
                <label
                  htmlFor="trainer-hl-start"
                  className="text-sm font-medium mb-1.5 block text-foreground dark:text-foreground"
                >
                  Startzeit *
                </label>
                <Input
                  id="trainer-hl-start"
                  type="time"
                  value={newEntry.startTime}
                  onChange={(e) => setNewEntry({ ...newEntry, startTime: e.target.value })}
                />
              </div>
              <div>
                <label
                  htmlFor="trainer-hl-end"
                  className="text-sm font-medium mb-1.5 block text-foreground dark:text-foreground"
                >
                  Endzeit *
                </label>
                <Input
                  id="trainer-hl-end"
                  type="time"
                  value={newEntry.endTime}
                  onChange={(e) => setNewEntry({ ...newEntry, endTime: e.target.value })}
                />
              </div>
              <div>
                <label
                  htmlFor="trainer-hl-type"
                  className="text-sm font-medium mb-1.5 block text-foreground dark:text-foreground"
                >
                  Typ *
                </label>
                <Select
                  value={newEntry.type}
                  onValueChange={(v) => setNewEntry({ ...newEntry, type: v })}
                >
                  <SelectTrigger id="trainer-hl-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="preparation">Vorbereitung</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="other">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label
                htmlFor="trainer-hl-notes"
                className="text-sm font-medium mb-1.5 block text-foreground dark:text-foreground"
              >
                Notizen
              </label>
              <Textarea
                id="trainer-hl-notes"
                placeholder="Optionale Notizen zur Tätigkeit..."
                value={newEntry.notes}
                onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? 'Wird erstellt...' : 'Stunden eintragen'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        <Card className="sm:col-span-1 col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                  Stunden gesamt
                </p>
                <p className="text-xl font-bold mt-0.5 text-brand-primary dark:text-brand-light">
                  {stats.totalHours.toFixed(1)}h
                </p>
              </div>
              <Clock className="h-5 w-5 text-brand-light/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approved Hours Summary */}
      {stats.approvedHours > 0 && (
        <div className="rounded-xl bg-success-50 dark:bg-success-900/10 border border-success-200 dark:border-success-900/20 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-success-600" />
            <div>
              <p className="text-sm font-medium text-success-800 dark:text-success-200">
                Bestätigte Stunden
              </p>
              <p className="text-xs text-success-600 dark:text-success-400">
                Bereits von deinem Verein genehmigt
              </p>
            </div>
          </div>
          <p className="text-2xl font-bold text-success-700 dark:text-success-300">
            {stats.approvedHours.toFixed(1)}h
          </p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="trainer-hl-filter-status"
                className="text-xs font-medium mb-1.5 block text-muted-foreground dark:text-muted-foreground"
              >
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="trainer-hl-filter-status">
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
                htmlFor="trainer-hl-filter-month"
                className="text-xs font-medium mb-1.5 block text-muted-foreground dark:text-muted-foreground"
              >
                Monat
              </label>
              <Input
                id="trainer-hl-filter-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-foreground dark:text-gray-200">
            Einträge ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {logs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="h-16 w-16 rounded-xl bg-muted dark:bg-card/5 flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8" />
              </div>
              <p className="font-medium text-muted-foreground">Keine Stundennachweise</p>
              <p className="text-sm mt-1">
                {showForm
                  ? 'Fülle das Formular oben aus, um deine erste Eintragung zu machen.'
                  : 'Klicke auf "Neue Stunden", um einen Eintrag zu erfassen.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 rounded-xl border bg-background dark:bg-card/5 hover:border-border dark:hover:border-white/20 transition-all"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground dark:text-white">
                        {log.hours.toFixed(1)}h
                      </span>
                      {getStatusBadge(log.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground dark:text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(log.date), 'dd. MMM yyyy', { locale: de })}
                      </span>
                    </div>
                    {log.description && (
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground line-clamp-1">
                        {log.description}
                      </p>
                    )}
                    {log.status === 'rejected' && log.rejection_reason && (
                      <p className="text-xs text-error-500 mt-1">Grund: {log.rejection_reason}</p>
                    )}
                    {log.status === 'approved' && log.approved_at && (
                      <p className="text-xs text-success-500">
                        Genehmigt am{' '}
                        {format(parseISO(log.approved_at), 'dd.MM.yyyy', { locale: de })}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0 ml-4">
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                      {format(parseISO(log.created_at), 'dd.MM.', { locale: de })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
