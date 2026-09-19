'use client';

import { ListState } from '@/components/ui/list-state';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, User, Clock, Search, Download, RefreshCw } from 'lucide-react';
import { PaginationNav } from '@/components/ui/pagination-nav';
import { buildPaginationMeta } from '@/lib/pagination';
import type { PaginationMeta } from '@/lib/pagination';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from '@/lib/locale';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { auditActionLabel, auditResourceLabel } from '@/lib/audit-labels';

import { createLogger } from '@/lib/logger';

const log = createLogger('admin:audit-log-viewer');

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  user_email: string;
  changes: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AuditLogViewerProps {
  clubId?: string;
}

export function AuditLogViewer({ clubId }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  const ITEMS_PER_PAGE = 50;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: ITEMS_PER_PAGE.toString(),
        offset: ((page - 1) * ITEMS_PER_PAGE).toString(),
      });

      if (clubId) {
        params.append('club_id', clubId);
      }

      const response = await apiFetch(`/api/audit-logs?${params}`);
      if (!response.ok) throw new Error('Audit-Logs konnten nicht geladen werden');

      const data = await response.json();
      setLogs(data.logs || []);
      setPagination(buildPaginationMeta(page, ITEMS_PER_PAGE, data.total ?? 0));
    } catch (_error) {
      log.error('Error fetching audit logs:', _error);
      toast.error('Audit-Logs konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  }, [clubId, page]);

  useEffect(() => {
    fetchLogs();
  }, [clubId, page, fetchLogs]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (clubId) params.append('club_id', clubId);
      if (filterAction !== 'all') params.append('action', filterAction);
      if (filterEntity !== 'all') params.append('entity_type', filterEntity);

      const response = await apiFetch(`/api/audit-logs/export?${params}`);
      if (!response.ok) throw new Error('Export fehlgeschlagen');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Audit-Logs exportiert');
    } catch (_error) {
      toast.error('Export fehlgeschlagen');
    }
  };

  const getActionColor = (
    action: string
  ): 'success' | 'default' | 'error' | 'info' | 'secondary' => {
    switch (action.toLowerCase()) {
      case 'create':
        return 'success';
      case 'update':
        return 'default';
      case 'delete':
        return 'error';
      case 'login':
      case 'logout':
        return 'info';
      default:
        return 'secondary';
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterEntity !== 'all' && log.entity_type !== filterEntity) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        log.user_email.toLowerCase().includes(searchLower) ||
        log.action.toLowerCase().includes(searchLower) ||
        log.entity_type.toLowerCase().includes(searchLower) ||
        log.entity_id.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));
  const uniqueEntities = Array.from(new Set(logs.map((l) => l.entity_type)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Audit-Logs</h2>
          <p className="text-muted-foreground">Sicherheitsrelevante Aktivitäten und Änderungen</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Aktualisieren
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Exportieren
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card variant="bordered">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nach Person, Aktion oder Objekt suchen…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Alle Aktionen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Aktionen</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {auditActionLabel(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Alle Objekttypen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Objekttypen</SelectItem>
                  {uniqueEntities.map((entity) => (
                    <SelectItem key={entity} value={entity}>
                      {auditResourceLabel(entity)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card variant="bordered">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Audit-Logs werden geladen…</div>
          ) : filteredLogs.length === 0 ? (
            <ListState empty emptyTitle="Keine Audit-Logs vorhanden" />
          ) : (
            <div className="divide-y">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-muted transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-muted rounded-xl">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={getActionColor(log.action)}>
                          {auditActionLabel(log.action)}
                        </Badge>
                        <span className="text-sm font-medium text-foreground">
                          {auditResourceLabel(log.entity_type)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          #{log.entity_id.slice(0, 8)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{log.user_email}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatDistanceToNow(new Date(log.created_at), {
                              addSuffix: true,
                              locale: de,
                            })}
                          </span>
                        </div>
                      </div>

                      {log.changes && Object.keys(log.changes).length > 0 && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Details anzeigen
                          </summary>
                          <div className="mt-2 p-3 bg-muted rounded-xl">
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(log.changes, null, 2)}
                            </pre>
                          </div>
                        </details>
                      )}

                      {log.ip_address && (
                        <div className="text-xs text-muted-foreground mt-1">
                          IP: {log.ip_address}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground text-right">
                      {format(new Date(log.created_at), 'dd.MM.yyyy HH:mm:ss')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && <PaginationNav meta={pagination} compact onPageChange={setPage} />}
    </div>
  );
}
