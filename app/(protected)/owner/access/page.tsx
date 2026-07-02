import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { revalidatePath } from 'next/cache';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Clock, CheckCircle, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function updateStatus(id: string, status: 'approved' | 'rejected') {
  'use server';
  const sb = createServiceClient();
  await sb.from('club_access_requests').update({ status }).eq('id', id);
  revalidatePath('/owner/access');
}

const STATUS_LABELS: Record<string, { label: string; variant: 'success' | 'error' | 'secondary' }> =
  {
    pending: { label: 'Ausstehend', variant: 'secondary' },
    approved: { label: 'Genehmigt', variant: 'success' },
    rejected: { label: 'Abgelehnt', variant: 'error' },
  };

export default async function OwnerAccessPage() {
  await requireAuth();
  const sb = createServiceClient();

  const { data: requests, error } = await sb
    .from('club_access_requests')
    .select('id, name, club_name, email, message, status, created_at')
    .order('created_at', { ascending: false });

  const pending = (requests ?? []).filter((r: any) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Zugänge & Anfragen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {pending > 0
            ? `${pending} offene Anfrage${pending !== 1 ? 'n' : ''}`
            : 'Interessenten die einen Zugang angefragt haben.'}
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Migration <code>club_access_requests</code> noch nicht ausgeführt.
          </CardContent>
        </Card>
      ) : (requests ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Noch keine Anfragen eingegangen.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {requests!.length} Anfrage{requests!.length !== 1 ? 'n' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {requests!.map((r: any) => {
              const st = STATUS_LABELS[r.status] ?? STATUS_LABELS.pending;
              return (
                <div key={r.id} className="py-4 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-sm">{r.name}</p>
                    {r.club_name && <p className="text-xs text-muted-foreground">{r.club_name}</p>}
                    <a
                      href={`mailto:${r.email}`}
                      className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <Mail className="h-3 w-3" />
                      {r.email}
                    </a>
                    {r.message && (
                      <p className="text-xs text-muted-foreground italic mt-1">"{r.message}"</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Badge variant={st.variant}>{st.label}</Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(r.created_at).toLocaleDateString('de-DE')}
                    </span>
                    {r.status === 'pending' && (
                      <div className="flex gap-1.5 mt-1">
                        <form action={updateStatus.bind(null, r.id, 'approved')}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-success-700 border-success-300 hover:bg-success-50 dark:text-success-300 dark:border-success-700/50 dark:hover:bg-success-900/20"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Annehmen
                          </Button>
                        </form>
                        <form action={updateStatus.bind(null, r.id, 'rejected')}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-error-700 border-error-300 hover:bg-error-50 dark:text-error-300 dark:border-error-700/50 dark:hover:bg-error-900/20"
                          >
                            <XCircle className="h-3 w-3" />
                            Ablehnen
                          </Button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
