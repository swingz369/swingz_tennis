'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Clock, Check, X, Filter, Download, Search, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

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

export default function HoursLogsOverviewPage() {
  const [logs, setLogs] = useState<HoursLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<HoursLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    fetchHoursLogs();
  }, []);

  const fetchHoursLogs = async () => {
    try {
      const response = await fetch('/api/hours-logs');
      if (!response.ok) throw new Error('Fehler beim Laden');

      const data = await response.json();
      setLogs(data.hoursLogs || []);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Fehler beim Laden der Stundennachweise');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = useCallback(() => {
    let filtered = [...logs];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((log) => log.status === statusFilter);
    }

    // Search filter (trainer name)
    if (searchTerm) {
      filtered = filtered.filter((log) =>
        log.trainer_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Month filter
    if (selectedMonth) {
      filtered = filtered.filter((log) => log.date.startsWith(selectedMonth));
    }

    setFilteredLogs(filtered);
  }, [logs, statusFilter, searchTerm, selectedMonth]);

  useEffect(() => {
    applyFilters();
  }, [logs, statusFilter, searchTerm, selectedMonth, applyFilters]);

  const handleApprove = async (logId: string) => {
    try {
      const response = await fetch(`/api/hours-logs/${logId}/approve`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Genehmigung fehlgeschlagen');

      toast.success('Stundennachweis genehmigt');
      fetchHoursLogs();
    } catch (error) {
      console.error('Approve error:', error);
      toast.error('Fehler bei der Genehmigung');
    }
  };

  const handleReject = async (logId: string, reason: string) => {
    try {
      const response = await fetch(`/api/hours-logs/${logId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) throw new Error('Ablehnung fehlgeschlagen');

      toast.success('Stundennachweis abgelehnt');
      fetchHoursLogs();
    } catch (error) {
      console.error('Reject error:', error);
      toast.error('Fehler bei der Ablehnung');
    }
  };

  const exportToCSV = () => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const headers = ['Datum', 'Trainer', 'Stunden', 'Status', 'Beschreibung'];
    const rows = filteredLogs.map((log) => [
      log.date,
      log.trainer_name,
      log.hours,
      log.status,
      log.description || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stundennachweise-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('CSV-Export erfolgreich');
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { label: 'Ausstehend', variant: 'warning' as const },
      approved: { label: 'Genehmigt', variant: 'success' as const },
      rejected: { label: 'Abgelehnt', variant: 'error' as const },
    };
    const config = variants[status as keyof typeof variants] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const stats = {
    total: logs.length,
    pending: logs.filter((l) => l.status === 'pending').length,
    approved: logs.filter((l) => l.status === 'approved').length,
    rejected: logs.filter((l) => l.status === 'rejected').length,
    totalHours: logs.reduce((sum, l) => sum + l.hours, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Stundennachweise</h1>
        <p className="text-gray-500">Übersicht aller Trainer-Stundennachweise</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Gesamt</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Ausstehend</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Genehmigt</p>
            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Abgelehnt</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Gesamt-Stunden</p>
            <p className="text-2xl font-bold text-brand-primary">{stats.totalHours}h</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
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

            {/* Search */}
            <div>
              <label className="text-sm font-medium mb-2 block">Trainer suchen</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Month Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Monat</label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>

            {/* Export Button */}
            <div className="flex items-end">
              <Button onClick={exportToCSV} variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                CSV Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Nachweise ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Keine Stundennachweise gefunden</p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-white dark:bg-gray-900 hover:shadow-md transition-shadow"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{log.trainer_name}</p>
                      {getStatusBadge(log.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(log.date), 'dd.MM.yyyy', { locale: de })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {log.hours}h
                      </span>
                    </div>
                    {log.description && <p className="text-sm text-gray-600">{log.description}</p>}
                  </div>

                  {log.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprove(log.id)}
                        className="text-green-600 hover:bg-green-50"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Genehmigen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const reason = prompt('Grund für Ablehnung:');
                          if (reason) handleReject(log.id, reason);
                        }}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Ablehnen
                      </Button>
                    </div>
                  )}

                  {log.status === 'approved' && log.approved_at && (
                    <p className="text-xs text-gray-400">
                      Genehmigt am {format(parseISO(log.approved_at), 'dd.MM.yyyy', { locale: de })}
                    </p>
                  )}

                  {log.status === 'rejected' && log.rejection_reason && (
                    <p className="text-xs text-red-500">Grund: {log.rejection_reason}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
