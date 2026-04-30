import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, Trophy } from 'lucide-react';

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');

  let member: any = null;
  let bookings: any[] = [];

  // Demo mode – return mock data
  if (hasDemoMode) {
    member = {
      id: '1',
      user_id: 'demo-user-123',
      full_name: 'Max Mustermann',
      email: 'max@example.com',
      role: 'member',
      is_active: true,
      joined_at: '2025-01-15',
      club_memberships: [
        {
          clubs: { id: 'demo-club', name: 'Demo Tennis Club', status: 'active' },
          role: 'member',
        },
      ],
    };

    bookings = [
      {
        id: 'b1',
        status: 'confirmed',
        created_at: new Date().toISOString(),
        sessions: {
          id: 's1',
          timeslot_start: new Date().toISOString(),
          timeslot_end: new Date(Date.now() + 3600000).toISOString(),
          trainer_id: 'trainer-1',
          schedules: { name: 'Trainingsgruppe A' },
        },
      },
    ];
  } else {
    // Normal Supabase flow
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <p>Bitte einloggen</p>
        </div>
      );
    }

    const { data: memberData } = await supabase
      .from('users')
      .select('*, club_memberships(clubs(name, status))')
      .eq('id', id)
      .single();

    if (!memberData) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <p>Mitglied nicht gefunden</p>
        </div>
      );
    }

    member = memberData;

    const { data: bookingsData } = await supabase
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

    bookings = bookingsData || [];
  }

  // Stats (both modes) – only use bookings data we have
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed').length;
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled').length;
  const noShowBookings = bookings.filter((b) => b.status === 'no_show').length;

  // Simple attendance rate from these bookings (good enough for demo)
  const attendanceRate = totalBookings > 0 ? Math.round(((confirmedBookings + noShowBookings) / totalBookings) * 100) : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Mitgliedprofil</h1>
        <Button variant="outline">Bearbeiten</Button>
      </div>

      {/* KPI Cards */}
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
            <div className="text-2xl font-bold">{noShowBookings}</div>
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