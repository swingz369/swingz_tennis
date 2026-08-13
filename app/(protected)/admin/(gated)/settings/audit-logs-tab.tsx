'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Clock,
  ShieldAlert,
  UserCheck,
  Settings,
  LogIn,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import { PaginationNav } from '@/components/ui/pagination-nav';
import type { PaginationMeta } from '@/lib/pagination';
import { apiFetch } from '@/lib/api-fetch';

import { createLogger } from '@/lib/logger';

const log = createLogger('admin:settings:audit-logs-tab');

const actionIcons: Record<string, React.ReactNode> = {
  user_created: <UserCheck className="h-4 w-4 text-success-500" />,
  user_deleted: <ShieldAlert className="h-4 w-4 text-error-500" />,
  role_changed: <ShieldAlert className="h-4 w-4 text-warning-500" />,
  settings_updated: <Settings className="h-4 w-4 text-info-500" />,
  login: <LogIn className="h-4 w-4 text-success-500" />,
  logout: <LogOut className="h-4 w-4 text-muted-foreground" />,
  season_created: <Clock className="h-4 w-4 text-brand-light" />,
  season_published: <Clock className="h-4 w-4 text-brand-light" />,
  billing_generated: <AlertTriangle className="h-4 w-4 text-warning-500" />,
  member_deactivated: <ShieldAlert className="h-4 w-4 text-warning-500" />,
  member_status_changed: <ShieldAlert className="h-4 w-4 text-warning-500" />,
  member_bulk_deactivated: <ShieldAlert className="h-4 w-4 text-warning-500" />,
  members_bulk_imported: <UserCheck className="h-4 w-4 text-success-500" />,
  session_bulk_deleted: <ShieldAlert className="h-4 w-4 text-error-500" />,
  membership_cancelled: <ShieldAlert className="h-4 w-4 text-error-500" />,
  family_account_created: <UserCheck className="h-4 w-4 text-success-500" />,
  family_account_member_added: <UserCheck className="h-4 w-4 text-success-500" />,
  family_account_member_removed: <ShieldAlert className="h-4 w-4 text-warning-500" />,
  STRIPE_QUANTITY_SYNC: <Settings className="h-4 w-4 text-info-500" />,
  hardware_vendor_update: <Settings className="h-4 w-4 text-info-500" />,
  DSGVO_DELETE: <ShieldAlert className="h-4 w-4 text-error-500" />,
  PII_READ: <UserCheck className="h-4 w-4 text-muted-foreground" />,
  READ_MEMBER: <UserCheck className="h-4 w-4 text-muted-foreground" />,
};

const actionLabels: Record<string, string> = {
  user_created: 'Mitglied erstellt',
  user_deleted: 'Mitglied gelöscht',
  role_changed: 'Rolle geändert',
  settings_updated: 'Einstellungen aktualisiert',
  login: 'Anmeldung',
  logout: 'Abmeldung',
  season_created: 'Saison erstellt',
  season_published: 'Saison veröffentlicht',
  billing_generated: 'Abrechnung erstellt',
  member_deactivated: 'Mitglied deaktiviert',
  member_status_changed: 'Mitgliedsstatus geändert',
  member_bulk_deactivated: 'Mitglieder deaktiviert (Sammelaktion)',
  members_bulk_imported: 'Mitglieder importiert (Sammelaktion)',
  session_bulk_deleted: 'Trainingseinheiten gelöscht (Sammelaktion)',
  membership_cancelled: 'Mitgliedschaft gekündigt',
  family_account_created: 'Familienkonto erstellt',
  family_account_member_added: 'Mitglied zu Familienkonto hinzugefügt',
  family_account_member_removed: 'Mitglied aus Familienkonto entfernt',
  STRIPE_QUANTITY_SYNC: 'Stripe-Abrechnung synchronisiert',
  hardware_vendor_update: 'Hardware-Anbieter geändert',
  DSGVO_DELETE: 'Konto gelöscht (DSGVO)',
  PII_READ: 'Personenbezogene Daten eingesehen',
  READ_MEMBER: 'Mitgliedsdaten eingesehen',
};

export default function AuditLogsTab({ clubId }: { clubId: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  const fetchLogs = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/admin/audit-logs?page=${p}&limit=20&clubId=${clubId}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs ?? []);
          setPagination(data.pagination ?? null);
        }
      } catch {
        log.error('Failed to fetch audit logs');
      } finally {
        setLoading(false);
      }
    },
    [clubId]
  );

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-brand-primary">Audit-Logs</h2>
        <p className="text-sm text-muted-foreground">Sicherheitsrelevante Aktivitäten im Verein</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground">Keine Audit-Logs vorhanden.</p>
        </div>
      ) : (
        <Card className="border border-border dark:border-white/10">
          <CardContent className="p-0 divide-y divide-border dark:divide-white/5">
            {logs.map((log: any) => (
              <div
                key={log.id}
                className="flex items-start gap-4 px-5 py-3 hover:bg-muted/50 dark:hover:bg-background/[0.02] transition-colors"
              >
                <div className="mt-0.5 shrink-0">
                  {actionIcons[log.action] ?? <Clock className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground dark:text-white">
                      {actionLabels[log.action] ?? log.action}
                    </span>
                    <Badge variant="secondary" className="text-2xs font-mono">
                      {log.action}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-2xs text-muted-foreground flex items-center gap-1">
                      <UserCheck className="h-3 w-3" />
                      {log.performed_by_name ?? log.performed_by ?? 'System'}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {pagination && <PaginationNav meta={pagination} compact onPageChange={setPage} />}
    </div>
  );
}
