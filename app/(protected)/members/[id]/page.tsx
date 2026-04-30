import { createClient } from '@/infrastructure/external/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, Trophy } from 'lucide-react';

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Bitte einloggen</p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from('users')
    .select('*, club_memberships(clubs(name, status))')
    .eq('id', id)
    .single();

  if (!member) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Mitglied nicht gefunden</p>
      </div>
    );
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      `
      *,
      sessions (
        id,
        timeslot_start,
        timeslot_end,
        trainer_id,
        schedules (name)
      )
    `
    )
    .eq('member_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: attendance } = await supabase.from('bookings').select('status').eq('member_id', id);

  const totalBookings = attendance?.length || 0;
  const confirmedBookings =
    attendance?.filter((b: { status: string }) => b.status === 'confirmed').length || 0;
  const cancelledBookings =
    attendance?.filter((b: { status: string }) => b.status === 'cancelled').length || 0;
  const noShows = attendance?.filter((b: { status: string }) => b.status === 'no_show').length || 0;

  const attendanceRate =
    totalBookings > 0 ? Math.round(((confirmedBookings + noShows) / totalBookings) * 100) : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Mitgliedprofil</h1>
        <Button variant="outline">Bearbeiten</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamtbuchungen</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBookings}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bestätigt</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{confirmedBookings}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abgesagt</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cancelledBookings}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No-Show</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{noShows}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Stammdaten</CardTitle>
            <CardDescription>Persönliche Informationen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{member.full_name || 'Nicht angegeben'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">E-Mail</p>
              <p className="font-medium">{member.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telefon</p>
              <p className="font-medium">{member.phone || 'Nicht angegeben'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mitglied seit</p>
              <p className="font-medium">
                {member.created_at
                  ? new Date(member.created_at).toLocaleDateString('de-DE')
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Teilnahmequote</p>
              <p className="font-medium">{attendanceRate}%</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vereinsmitgliedschaft</CardTitle>
            <CardDescription>Zugeordnete Vereine</CardDescription>
          </CardHeader>
          <CardContent>
            {member.club_memberships && member.club_memberships.length > 0 ? (
              <div className="space-y-2">
                {member.club_memberships.map(
                  (membership: { clubs: { id: string; name: string; status: string } }) => (
                    <div
                      key={membership.clubs.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{membership.clubs.name}</p>
                        <Badge
                          variant={membership.clubs.status === 'active' ? 'default' : 'secondary'}
                        >
                          {membership.clubs.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Vereinsmitgliedschaft</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buchungsverlauf</CardTitle>
          <CardDescription>Letzte 10 Buchungen</CardDescription>
        </CardHeader>
        <CardContent>
          {bookings && bookings.length > 0 ? (
            <div className="space-y-3">
              {bookings.map(
                (booking: {
                  id: string;
                  status: string;
                  sessions?: {
                    timeslot_start: string;
                    schedules?: { name: string };
                  } | null;
                }) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">
                        {booking.sessions?.schedules?.name || 'Training'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {booking.sessions?.timeslot_start
                          ? new Date(booking.sessions.timeslot_start).toLocaleString('de-DE')
                          : 'N/A'}
                      </p>
                    </div>
                    <Badge
                      variant={
                        booking.status === 'confirmed'
                          ? 'default'
                          : booking.status === 'cancelled'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {booking.status === 'confirmed'
                        ? 'Bestätigt'
                        : booking.status === 'cancelled'
                          ? 'Abgesagt'
                          : 'No-Show'}
                    </Badge>
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Buchungen vorhanden</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
