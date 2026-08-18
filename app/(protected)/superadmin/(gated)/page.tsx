import { requireAuth } from '@/lib/auth';
import Link from 'next/link';
import { Building2, Activity, Shield, TrendingUp, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { KpiBand } from '@/components/ui/kpi-band';
import { QuickActions } from '@/components/ui/quick-actions';

export const dynamic = 'force-dynamic';

// Zeilenmasse wie im Admin- und Owner-Dashboard.
const HEAD_CELL = 'h-auto px-5 pb-2.5 pt-0 text-2xs uppercase tracking-[0.09em]';
const BODY_CELL = 'px-5 py-2.5';

export default async function SuperadminPage() {
  const { supabase, user } = await requireAuth();

  // Nur eigene Gruppe: Clubs aus eigenen Memberships
  const { data: myMemberships } = await supabase
    .from('user_club_memberships')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const myClubIds = (myMemberships ?? [])
    .map((m: { club_id: string }) => m.club_id)
    .filter(Boolean);

  const clubCount = myClubIds.length;

  const [{ count: totalTrainers }, { count: activeMembers }] = myClubIds.length
    ? await Promise.all([
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .in('club_id', myClubIds)
          .eq('role', 'trainer')
          .eq('is_active', true),
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .in('club_id', myClubIds)
          .eq('is_active', true),
      ])
    : [{ count: 0 }, { count: 0 }];

  // Nur eigene Clubs
  const { data: clubs } = myClubIds.length
    ? await supabase
        .from('clubs')
        .select('id, name, status, created_at')
        .in('id', myClubIds)
        .order('name')
    : { data: [] };

  const clubsWithStats = await Promise.all(
    (clubs ?? []).map(async (club: any) => {
      const [{ count: members }, { count: trainers }] = await Promise.all([
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('is_active', true),
        supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('role', 'trainer')
          .eq('is_active', true),
      ]);
      return { ...club, members: members ?? 0, trainers: trainers ?? 0 };
    })
  );

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const firstName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'Admin';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Meine Gruppe"
          description={
            <>
              Hallo {firstName} — {clubCount} Verein{clubCount !== 1 ? 'e' : ''} in deiner Gruppe
            </>
          }
        />
        <Badge
          variant="outline"
          className="flex items-center gap-1 border-info-300 text-info-700 dark:border-info-700 dark:text-info-300"
        >
          <Shield className="h-3 w-3" /> Superadmin
        </Badge>
      </div>

      {/* Kennzahlen als Band — dasselbe Muster wie Owner-, Admin- und
          Trainer-Dashboard. Vorher: drei Karten in einem Vierer-Raster (die
          vierte Spalte blieb leer), jede mit getönter Symbolkachel in einer
          eigenen Farbe, die nichts bedeutete. */}
      <KpiBand
        items={[
          {
            label: 'Vereine',
            value: clubCount,
            sub: 'in deiner Gruppe',
            href: '/superadmin/clubs',
          },
          { label: 'Mitgliedschaften', value: activeMembers ?? 0, sub: 'aktiv' },
          { label: 'Trainer', value: totalTrainers ?? 0, sub: 'aktiv' },
          {
            label: 'Ø Mitglieder',
            value: clubCount > 0 ? Math.round((activeMembers ?? 0) / clubCount) : 0,
            sub: 'je Verein',
          },
        ]}
      />

      {/* Vereine als Tabelle in einer Karte — gleiche Bauweise wie im Owner-
          und Admin-Dashboard. Freie Zeilen ohne Spalten liefen auf breiten
          Schirmen zu weit auseinander, um noch als Zeile gelesen zu werden. */}
      <Card className="p-0">
        <CardHeader className="flex-row items-start justify-between space-y-0 px-5 pb-3 pt-5">
          <div>
            <CardTitle className="text-sm font-semibold">Alle Vereine</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {clubsWithStats.length === 1 ? '1 Verein' : `${clubsWithStats.length} Vereine`}
            </p>
          </div>
          <Link
            href="/superadmin/clubs"
            className="shrink-0 text-[12.5px] font-medium text-primary hover:underline"
          >
            Verwalten →
          </Link>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={HEAD_CELL}>Verein</TableHead>
                <TableHead className={cn(HEAD_CELL, 'w-[14%] text-right')}>Mitglieder</TableHead>
                <TableHead className={cn(HEAD_CELL, 'w-[12%] text-right')}>Trainer</TableHead>
                <TableHead className={cn(HEAD_CELL, 'w-[14%]')}>Status</TableHead>
                <TableHead className={cn(HEAD_CELL, 'w-[12%] text-right')}>Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clubsWithStats.map((club: any) => (
                <TableRow key={club.id}>
                  <TableCell className={cn(BODY_CELL, 'font-medium')}>{club.name}</TableCell>
                  <TableCell className={cn(BODY_CELL, 'text-right tabular-nums')}>
                    {club.members}
                  </TableCell>
                  <TableCell className={cn(BODY_CELL, 'text-right tabular-nums')}>
                    {club.trainers}
                  </TableCell>
                  <TableCell className={cn(BODY_CELL, 'text-muted-foreground')}>
                    {club.status === 'inactive' ? (
                      <Badge variant="secondary">Inaktiv</Badge>
                    ) : (
                      'Aktiv'
                    )}
                  </TableCell>
                  <TableCell className={cn(BODY_CELL, 'text-right')}>
                    {/* "Als Admin verwalten" → setzt Cookie + weiter zu /admin */}
                    <Link
                      href={`/api/admin/switch-club-redirect?clubId=${club.id}`}
                      className="whitespace-nowrap text-[12.5px] font-medium text-primary hover:underline"
                    >
                      Als Admin →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {clubsWithStats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className={cn(BODY_CELL, 'text-muted-foreground')}>
                    Noch kein Verein in deiner Gruppe.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <QuickActions
        label="Plattform-Verwaltung"
        mode="detailed"
        actions={[
          { label: 'Vereine verwalten', href: '/superadmin/clubs', icon: Building2 },
          { label: 'Vereinsübersicht', href: '/superadmin/tenants', icon: TrendingUp },
          { label: 'Analytics', href: '/admin/analytics', icon: Activity },
          { label: 'Einstellungen', href: '/admin/settings', icon: Settings },
        ]}
      />
    </div>
  );
}
