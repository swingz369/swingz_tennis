'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Filter, Download, Clock, User, Activity, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { AuditLog, AuditLogSummary } from '@/src/domain/entities/audit-log.entity';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface AuditLogViewerProps {
  className?: string;
}

export function AuditLogViewer({ className }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<AuditLogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntityType, setFilterEntityType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadAuditLogs();
    loadSummary();
  }, [searchTerm, filterAction, filterEntityType, filterStatus]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterAction !== 'all') params.append('action', filterAction);
      if (filterEntityType !== 'all') params.append('entityType', filterEntityType);
      if (filterStatus !== 'all') params.append('status', filterStatus);

      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await fetch('/api/audit-logs/summary');
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error loading audit log summary:', error);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      if (searchTerm) params.append('search', searchTerm);
      if (filterAction !== 'all') params.append('action', filterAction);
      if (filterEntityType !== 'all') params.append('entityType', filterEntityType);
      if (filterStatus !== 'all') params.append('status', filterStatus);

      const response = await fetch(`/api/audit-logs/export?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting audit logs:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

   const getStatusBadge = (status: string) => {
     switch (status) {
       case 'success':
         return <Badge variant="default" className="bg-green-500">Erfolgreich</Badge>;
       case 'failed':
         return <Badge variant="error">Fehlgeschlagen</Badge>;
       case 'partial':
         return <Badge variant="secondary" className="bg-yellow-500">Teilweise</Badge>;
       default:
         return <Badge variant="outline">{status}</Badge>;
     }
   };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      create: 'bg-blue-500',
      update: 'bg-yellow-500',
      delete: 'bg-red-500',
      read: 'bg-gray-500',
      login: 'bg-green-500',
      logout: 'bg-gray-500',
      approve: 'bg-green-500',
      reject: 'bg-red-500',
      export: 'bg-purple-500',
      import: 'bg-purple-500',
      send: 'bg-blue-500',
      sign: 'bg-green-500',
      convert: 'bg-blue-500',
      cancel: 'bg-red-500',
      reschedule: 'bg-yellow-500',
      book: 'bg-green-500',
      unbook: 'bg-red-500',
      pay: 'bg-green-500',
      refund: 'bg-yellow-500',
      upload: 'bg-blue-500',
      download: 'bg-blue-500',
      configure: 'bg-purple-500',
      reset: 'bg-red-500'
    };
    return <Badge className={colors[action] || 'bg-gray-500'}>{action}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Lade Audit-Logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Audit-Log</h2>
          <p className="text-muted-foreground">Verfolgung aller Systemaktionen</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="summary">Zusammenfassung</TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Aktivitäts-Log</CardTitle>
                  <CardDescription>Alle Systemaktionen und Änderungen</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Suchen..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-[250px]"
                    />
                  </div>
                  <Select value={filterAction} onValueChange={setFilterAction}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Aktion" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Aktionen</SelectItem>
                      <SelectItem value="create">Erstellen</SelectItem>
                      <SelectItem value="update">Aktualisieren</SelectItem>
                      <SelectItem value="delete">Löschen</SelectItem>
                      <SelectItem value="approve">Genehmigen</SelectItem>
                      <SelectItem value="reject">Ablehnen</SelectItem>
                      <SelectItem value="export">Exportieren</SelectItem>
                      <SelectItem value="login">Anmelden</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Entität" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Entitäten</SelectItem>
                      <SelectItem value="member">Mitglied</SelectItem>
                      <SelectItem value="trainer">Trainer</SelectItem>
                      <SelectItem value="booking">Buchung</SelectItem>
                      <SelectItem value="trial_training">Probetraining</SelectItem>
                      <SelectItem value="hours_log">Stundenlog</SelectItem>
                      <SelectItem value="billing">Abrechnung</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Status</SelectItem>
                      <SelectItem value="success">Erfolgreich</SelectItem>
                      <SelectItem value="failed">Fehlgeschlagen</SelectItem>
                      <SelectItem value="partial">Teilweise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zeitstempel</TableHead>
                      <TableHead>Aktion</TableHead>
                      <TableHead>Entität</TableHead>
                      <TableHead>Benutzer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {format(new Date(log.timestamp), 'dd.MM.yyyy HH:mm:ss', { locale: de })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.entityType}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{log.userName}</div>
                              <div className="text-xs text-muted-foreground">{log.userEmail}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.status)}
                            {getStatusBadge(log.status)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                                Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Log-Details</DialogTitle>
                                <DialogDescription>
                                  Vollständige Informationen zu dieser Aktion
                                </DialogDescription>
                              </DialogHeader>
                              {selectedLog && (
                                <ScrollArea className="h-[400px]">
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">ID</p>
                                        <p className="font-mono text-sm">{selectedLog.id}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">Zeitstempel</p>
                                        <p className="text-sm">
                                          {format(new Date(selectedLog.timestamp), 'dd.MM.yyyy HH:mm:ss', { locale: de })}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">Aktion</p>
                                        <p className="text-sm">{selectedLog.action}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">Entitätstyp</p>
                                        <p className="text-sm">{selectedLog.entityType}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">Entitäts-ID</p>
                                        <p className="font-mono text-sm">{selectedLog.entityId}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">Status</p>
                                        <div className="flex items-center gap-2">
                                          {getStatusIcon(selectedLog.status)}
                                          <span className="text-sm">{selectedLog.status}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground mb-2">Benutzer</p>
                                      <div className="bg-secondary p-3 rounded-lg">
                                        <p className="font-medium">{selectedLog.userName}</p>
                                        <p className="text-sm text-muted-foreground">{selectedLog.userEmail}</p>
                                        <Badge variant="outline" className="mt-2">{selectedLog.userRole}</Badge>
                                      </div>
                                    </div>

                                    {selectedLog.changes && selectedLog.changes.length > 0 && (
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Änderungen</p>
                                        <div className="space-y-2">
                                          {selectedLog.changes.map((change, index) => (
                                            <div key={index} className="bg-secondary p-3 rounded-lg">
                                              <p className="font-medium">{change.field}</p>
                                              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                                                <div>
                                                  <span className="text-muted-foreground">Alt:</span>{' '}
                                                  <span className="line-through text-red-500">{String(change.oldValue)}</span>
                                                </div>
                                                <div>
                                                  <span className="text-muted-foreground">Neu:</span>{' '}
                                                  <span className="text-green-500">{String(change.newValue)}</span>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Metadaten</p>
                                        <div className="bg-secondary p-3 rounded-lg">
                                          <pre className="text-xs overflow-auto">
                                            {JSON.stringify(selectedLog.metadata, null, 2)}
                                          </pre>
                                        </div>
                                      </div>
                                    )}

                                    {selectedLog.errorMessage && (
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Fehlermeldung</p>
                                        <div className="bg-destructive/10 p-3 rounded-lg text-destructive">
                                          {selectedLog.errorMessage}
                                        </div>
                                      </div>
                                    )}

                                    {selectedLog.ipAddress && (
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Netzwerk-Informationen</p>
                                        <div className="bg-secondary p-3 rounded-lg text-sm">
                                          <p>IP: {selectedLog.ipAddress}</p>
                                          {selectedLog.userAgent && (
                                            <p className="text-muted-foreground mt-1">{selectedLog.userAgent}</p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </ScrollArea>
                              )}
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          {summary && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Gesamtlogs</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.totalLogs}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Erfolgreich</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{summary.logsByStatus.success || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Fehlgeschlagen</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{summary.logsByStatus.failed || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Top-Benutzer</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.topUsers.length}</div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Aktivitäten nach Aktion</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(summary.logsByAction).map(([action, count]) => (
                      <div key={action} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{action}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Aktivitäten nach Entität</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(summary.logsByEntityType).map(([entityType, count]) => (
                      <div key={entityType} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{entityType.replace('_', ' ')}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Top-Benutzer</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {summary.topUsers.map((user, index) => (
                      <div key={user.userId} className="flex items-center justify-between p-2 bg-secondary rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{index + 1}</Badge>
                          <span className="text-sm font-medium">{user.userName}</span>
                        </div>
                        <Badge>{user.actionCount} Aktionen</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Letzte Aktivitäten</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {summary.recentActivity.map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-2 bg-secondary rounded">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span className="text-sm">{log.userName}</span>
                          <span className="text-xs text-muted-foreground">{log.action}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.timestamp), 'HH:mm', { locale: de })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
