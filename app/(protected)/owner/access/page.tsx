import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OwnerAccessPage() {
  await requireAuth();
  const sb = createServiceClient();

  const { data: requests, error } = await sb
    .from('club_access_requests')
    .select('id, name, club_name, email, message, status, created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Zugänge & Anfragen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Interessenten die einen Zugang angefragt haben.
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Migration <code>20260622_club_access_requests.sql</code> noch nicht ausgeführt.
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
            {requests!.map((r: any) => (
              <div key={r.id} className="py-4 flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="font-medium text-sm">{r.name}</p>
                  {r.club_name && <p className="text-xs text-muted-foreground">{r.club_name}</p>}
                  <a
                    href={`mailto:${r.email}`}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                  >
                    <Mail className="h-3 w-3" />
                    {r.email}
                  </a>
                  {r.message && (
                    <p className="text-xs text-muted-foreground italic mt-1">"{r.message}"</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge variant="secondary" className="text-xs">
                    {r.status === 'pending' ? 'Ausstehend' : r.status}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(r.created_at).toLocaleDateString('de-DE')}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
