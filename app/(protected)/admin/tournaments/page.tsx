import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireAuth } from '@/lib/auth';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';
import Link from 'next/link';
import { Plus, Trophy, Calendar, Users, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  registration: 'Anmeldung',
  active: 'Aktiv',
  completed: 'Abgeschlossen',
  cancelled: 'Abgesagt',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  registration: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  completed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const FORMAT_LABELS: Record<string, string> = {
  single_elimination: 'K.O.',
  double_elimination: 'Doppel-K.O.',
  round_robin: 'Jeder gegen jeden',
  swiss: 'Schweizer System',
};

export default async function AdminTournamentsPage() {
  const { supabase, user } = await requireAuth();

  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const roles = (memberships ?? []).map((m: any) => m.role as string);
  const isAdminOrSuperadmin = roles.some((r) => r === 'admin' || r === 'superadmin');
  if (!isAdminOrSuperadmin) redirect('/dashboard');

  const isSuperadmin = roles.includes('superadmin');
  let clubId: string | null = null;
  if (isSuperadmin) {
    const cookieStore = await cookies();
    clubId = cookieStore.get(ADMIN_CLUB_COOKIE)?.value ?? null;
    if (!clubId) redirect('/select-admin-club');
  } else {
    clubId = (memberships ?? []).find((m: any) => m.role === 'admin')?.club_id ?? null;
  }

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select(
      'id, name, description, format, category, start_date, end_date, status, max_participants, registration_deadline'
    )
    .eq('club_id', clubId ?? '')
    .order('start_date', { ascending: true });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Turniere</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Turnierverwaltung des Vereins</p>
        </div>
        <Button asChild size="sm" className="bg-[#40916C] hover:bg-[#2d6a4f] text-white gap-1.5">
          <Link href="/admin/tournaments/new">
            <Plus className="h-4 w-4" />
            Neues Turnier
          </Link>
        </Button>
      </div>

      {!tournaments || tournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/20">
            <Trophy className="h-7 w-7 text-amber-500" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Noch keine Turniere angelegt</p>
          <Button asChild size="sm" className="bg-[#40916C] hover:bg-[#2d6a4f] text-white">
            <Link href="/admin/tournaments/new">Erstes Turnier anlegen</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {(tournaments ?? []).map((t: any) => {
            const participantCount = 0; // loaded separately if needed
            return (
              <Card key={t.id} className="p-0 hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20 shrink-0">
                      <Trophy className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{t.name}</p>
                        <Badge className={`text-[10px] border-0 ${STATUS_COLORS[t.status] ?? ''}`}>
                          {STATUS_LABELS[t.status] ?? t.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(t.start_date).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {participantCount}/{t.max_participants ?? '∞'}
                        </span>
                        {t.format && <span>{FORMAT_LABELS[t.format] ?? t.format}</span>}
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
