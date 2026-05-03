'use client';

import { useState, useEffect } from 'react';
import { format, parseISO, subDays, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Search,
  Filter,
  Download,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  Activity,
  Calendar,
  Database,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Info,
  GitBranch,
  Zap,
  Settings,
  Users,
  Globe,
  Lock,
  Key,
} from 'lucide-react';
import { toast } from 'sonner';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: {
    before?: any;
    after?: any;
  };
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AuditLogStatistics {
  total: number;
  byStatus: Record<string, number>;
  byAction: Record<string, number>;
  byEntityType: Record<string, number>;
  byUser: Record<string, number>;
  recentActivity: number;
}

export default function AuditLogManagement() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [statistics, setStatistics] = useState<AuditLogStatistics | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadAuditLogs();
  }, [dateRange]);

  const loadAuditLogs = async () => {
    try {
      setIsLoading(true);
      const [logsRes, statsRes] = await Promise.all([
        fetch('/api/audit-logs'),
        fetch('/api/audit-logs?statistics=true'),
      ]);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setAuditLogs(logsData.auditLogs || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData.statistics);
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      toast.error('Fehler beim Laden des Audit-Logs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOldLogs = async () => {
    if (!confirm('Möchten Sie alte Audit-Logs wirklich löschen?')) {
      return;
    }

    try {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const response = await fetch('/api/audit-logs/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete old logs');
      }

      const data = await response.json();
      toast.success(`${data.deleted} Audit-Logs gelöscht`);
      loadAuditLogs();
    } catch (error) {
      toast.error('Fehler beim Löschen der Audit-Logs');
      console.error('Delete error:', error);
    }
  };

  const getStatusColor = (status: AuditLog['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const getStatusLabel = (status: AuditLog['status']) => {
    switch (status) {
      case 'success':
        return 'Erfolgreich';
      case 'failed':
        return 'Fehlgeschlagen';
      case 'pending':
        return 'Ausstehend';
    }
  };

  const getActionIcon = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('create') || actionLower.includes('erstellen')) {
      return <Plus className="h-4 w-4" />;
    }
    if (actionLower.includes('update') || actionLower.includes('aktualisieren')) {
      return <RefreshCw className="h-4 w-4" />;
    }
    if (actionLower.includes('delete') || actionLower.includes('löschen')) {
      return <Trash2 className="h-4 w-4" />;
    }
    if (actionLower.includes('login') || actionLower.includes('anmelden')) {
      return <Key className="h-4 w-4" />;
    }
    if (actionLower.includes('logout') || actionLower.includes('abmelden')) {
      return <Lock className="h-4 w-4" />;
    }
    return <Activity className="h-4 w-4" />;
  };

  const getEntityTypeIcon = (entityType: string) => {
    const typeLower = entityType.toLowerCase();
    if (typeLower.includes('member')) {
      return <Users className="h-4 w-4" />;
    }
    if (typeLower.includes('trainer')) {
      return <User className="h-4 w-4" />;
    }
    if (typeLower.includes('trial')) {
      return <Clock className="h-4 w-4" />;
    }
    if (typeLower.includes('billing') || typeLower.includes('abrechnung')) {
      return <DollarSign className="h-4 w-4" />;
    }
    if (typeLower.includes('payment') || typeLower.includes('zahlung')) {
      return <CreditCard className="h-4 w-4" />;
    }
    if (typeLower.includes('setting') || typeLower.includes('einstellung')) {
      return <Settings className="h-4 w-4" />;
    }
    return <Database className="h-4 w-4" />;
  };

  const filteredLogs = auditLogs.filter((log) => {
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesEntityType = entityTypeFilter === 'all' || log.entityType === entityTypeFilter;
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      `${log.action} ${log.entityType} ${log.userName}`.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesAction && matchesEntityType && matchesStatus && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Audit-Log</h1>
          <p className="text-gray-500">Überwachung aller Systemaktivitäten</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteOldLogs}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Alte löschen
          </Button>
        </div>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Gesamt
              </CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total}</div>
              <p className="text-xs text-gray-500 mt-1">
                Audit-Logs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Erfolgreich
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statistics.byStatus.success || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Erfolgreiche Aktionen
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Fehlgeschlagen
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {statistics.byStatus.failed || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Fehlgeschlagene Aktionen
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Letzte Stunde
              </CardTitle>
              <Clock className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {statistics.recentActivity}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Aktivitäten letzte Stunde
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Suche nach Aktion, Entität oder Benutzer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="all">Alle Aktionen</option>
            <option value="create">Erstellen</option>
            <option value="update">Aktualisieren</option>
            <option value="delete">Löschen</option>
            <option value="login">Anmelden</option>
            <option value="logout">Abmelden</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="all">Alle Entitäten</option>
            <option value="member">Mitglieder</option>
            <option value="trainer">Trainer</option>
            <option value="trial_training">Probetrainings</option>
            <option value="billing">Abrechnungen</option>
            <option value="payment">Zahlungen</option>
            <option value="settings">Einstellungen</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="all">Alle Status</option>
            <option value="success">Erfolgreich</option>
            <option value="failed">Fehlgeschlagen</option>
            <option value="pending">Ausstehend</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="7d">Letzte 7 Tage</option>
            <option value="30d">Letzte 30 Tage</option>
            <option value="90d">Letzte 90 Tage</option>
            <option value="all">Alle Zeit</option>
          </select>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Audit-Logs</h2>
        {filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">Keine Audit-Logs gefunden</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredLogs.map((log) => (
            <Card
              key={log.id}
              className="hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedLog(log)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-brand-primary/10 rounded-lg">
                        {getActionIcon(log.action)}
                      </div>
                      <div>
                        <div className="font-semibold">{log.action}</div>
                        <div className="text-sm text-gray-600">{log.entityType}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className={getStatusColor(log.status)}>
                      {getStatusLabel(log.status)}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500">
                    {format(parseISO(log.createdAt), 'dd. MMM yyyy HH:mm:ss', { locale: de })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-3">
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="h-4 w-4" />
                    <span>{log.userName}</span>
                  </div>
                  {log.ipAddress && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Globe className="h-4 w-4" />
                      <span>{log.ipAddress}</span>
                    </div>
                  )}
                  {log.entityId && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Database className="h-4 w-4" />
                      <span>ID: {log.entityId}</span>
                    </div>
                  )}
                </div>

                {log.errorMessage && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">{log.errorMessage}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Audit-Log Details</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedLog(null)}
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getStatusColor(selectedLog.status)}>
                  {getStatusLabel(selectedLog.status)}
                </Badge>
              </div>

              {/* User Information */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Benutzerinformation
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 font-medium">{selectedLog.userName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Benutzer-ID:</span>
                    <span className="ml-2 font-medium">{selectedLog.userId}</span>
                  </div>
                </div>
              </div>

              {/* Action Information */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Aktion
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Aktion:</span>
                    <span className="ml-2 font-medium">{selectedLog.action}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Entitätstyp:</span>
                    <span className="ml-2 font-medium">{selectedLog.entityType}</span>
                  </div>
                  {selectedLog.entityId && (
                    <div>
                      <span className="text-gray-600">Entitäts-ID:</span>
                      <span className="ml-2 font-medium">{selectedLog.entityId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Changes */}
              {selectedLog.changes && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    Änderungen
                  </h3>
                  <div className="space-y-3">
                    {selectedLog.changes.before && (
                      <div>
                        <span className="text-gray-600">Vorher:</span>
                        <pre className="mt-1 p-3 bg-gray-50 rounded text-xs overflow-x-auto">
                          {JSON.stringify(selectedLog.changes.before, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedLog.changes.after && (
                      <div>
                      <span className="text-gray-600">Nachher:</span>
                      <pre className="mt-1 p-3 bg-gray-50 rounded text-xs overflow-x-auto">
                        {JSON.stringify(selectedLog.changes.after, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Technical Information */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Technische Informationen
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Zeitstempel:</span>
                    <span className="ml-2 font-medium">
                      {format(parseISO(selectedLog.createdAt), 'dd. MMM yyyy HH:mm:ss', { locale: de })}
                    </span>
                  </div>
                  {selectedLog.ipAddress && (
                    <div>
                      <span className="text-gray-600">IP-Adresse:</span>
                      <span className="ml-2 font-medium">{selectedLog.ipAddress}</span>
                    </div>
                  )}
                  {selectedLog.userAgent && (
                    <div>
                      <span className="text-gray-600">User-Agent:</span>
                      <span className="ml-2 font-medium text-xs break-all">
                        {selectedLog.userAgent}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Metadaten
                  </h3>
                  <pre className="mt-1 p-3 bg-gray-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
