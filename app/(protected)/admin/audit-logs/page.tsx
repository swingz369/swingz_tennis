import { requireAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock,
  ShieldAlert,
  UserCheck,
  Settings,
  LogIn,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

const actionIcons: Record<string, ReactNode> = {
  user_created: <UserCheck className="h-4 w-4 text-green-500" />,
  user_deleted: <ShieldAlert className="h-4 w-4 text-red-500" />,
  role_changed: <ShieldAlert className="h-4 w-4 text-amber-500" />,
  settings_updated: <Settings className="h-4 w-4 text-blue-500" />,
  login: <LogIn className="h-4 w-4 text-emerald-500" />,
  logout: <LogOut className="h-4 w-4 text-gray-500" />,
  season_created: <Clock className="h-4 w-4 text-brand-light" />,
  season_published: <Clock className="h-4 w-4 text-brand-light" />,
  billing_generated: <AlertTriangle className="h-4 w-4 text-amber-500" />,
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
};

export default async function AuditLogsPage() {
  const { supabase, user } = await requireAuth();

  // Get club_id from cookie or membership
  const cookieStore = await cookies();
  let clubId: string | undefined = cookieStore.get('club_id')?.value;

  if (!clubId) {
    const { data: membership } = await supabase
      .from('user_club_memberships')
      .select('club_id')
      .eq('user_id', user.id)
      .maybeSingle();

    clubId = membership?.club_id ?? undefined;
  }

  if (!clubId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldAlert className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Kein Verein ausgewählt.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch audit logs
  const sb = supabase as any;
  const { data: auditLogs } = await sb
    .from('audit_logs')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit-Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sicherheitsrelevante Aktivitäten im Verein
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-mono">
          {auditLogs?.length ?? 0} Einträge
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Aktivitätsverlauf
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            {!auditLogs || auditLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ShieldAlert className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground">Keine Audit-Logs vorhanden.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Sobald sicherheitsrelevante Aktionen durchgeführt werden, erscheinen sie hier.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {auditLogs.map((log: Record<string, unknown>) => (
                  <div
                    key={String(log.id)}
                    className="flex items-start gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="mt-0.5 shrink-0">
                      {actionIcons[String(log.action)] ?? (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">
                          {actionLabels[String(log.action)] ?? String(log.action)}
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {String(log.action)}
                        </Badge>
                      </div>
                      {log.metadata != null && typeof log.metadata === 'object' && (
                        <p className="text-xs text-muted-foreground/70 mt-1 font-mono truncate">
                          {JSON.stringify(log.metadata)}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                          <UserCheck className="h-3 w-3" />
                          {String(log.performed_by_name ?? log.performed_by ?? 'System')}
                        </span>
                        <span className="text-[11px] text-muted-foreground/60">
                          {new Date(String(log.created_at)).toLocaleString('de-DE', {
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
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
