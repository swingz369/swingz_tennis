import { createClient } from '@/infrastructure/external/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, Trophy } from 'lucide-react';

type Member = {
  id: string;
  full_name: string | null;
  email: string;
  created_at: string;
  phone: string | null;
  club_memberships: any[];
};

type Booking = {
  id: string;
  status: string;
  booked_at: string;
  booking_number: string | null;
  booking_type: string | null;
  cancellation_notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  club_id: string;
  end_time: string | null;
  is_recurring: boolean | null;
  member_id: string | null;
  notes: string | null;
  payment_status: string | null;
  schedule_id: string | null;
  session_id: string | null;
  session_start_time: string | null;
  start_time: string | null;
  sessions: {
    id: string;
    timeslot_start: string;
    timeslot_end: string;
    trainer_id: string;
  } | null;
};

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let member: Member | null = null;
  let bookings: Booking[] = [];

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
    .select('*, club_memberships(clubs(id, name, status))')
    .eq('id', id)
    .single();

  if (!memberData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Mitglied nicht gefunden</p>
      </div>
    );
  }

  member = memberData as any;

  const { data: bookingsData } = await supabase
    .from('bookings')
    .select(
      `
         *,
         sessions (
           id,
           timeslot_start,
           timeslot_end,
           trainer_id
         )
       `
    )
    .eq('member_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  bookings = bookingsData || [];

  // If member is still null, show an error (should not happen)
  if (!member) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Fehler beim Laden des Mitgliedsprofils</p>
      </div>
    );
  }

  // Stats (both modes) – only use bookings data we have
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed').length;
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled').length;
  const noShowBookings = bookings.filter((b) => b.status === 'no_show').length;

  // Simple attendance rate from these bookings (good enough for demo)
  const attendanceRate =
    totalBookings > 0
      ? Math.round(((confirmedBookings + noShowBookings) / totalBookings) * 100)
      : 0;

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
              <p className="font-medium">{member!.full_name || 'Nicht angegeben'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">E-Mail</p>
              <p className="font-medium">{member!.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telefon</p>
              <p className="font-medium">{member!.phone || 'Nicht angegeben'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mitglied seit</p>
              <p className="font-medium">
                {member!.created_at
                  ? new Date(member!.created_at).toLocaleDateString('de-DE')
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
            {member!.club_memberships && member!.club_memberships.length > 0 ? (
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
          {bookings!.length > 0 ? (
            <div className="space-y-3">
              {bookings!.map((booking: Booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">Training</p>
                    <p className="text-sm text-muted-foreground">
                      {booking.sessions?.timeslot_start
                        ? new Date(booking.sessions.timeslot_start).toLocaleString('de-DE')
                        : 'N/A'}
                    </p>
                  </div>
                  <Badge
                    variant={
                      booking.status === 'confirmed'
                        ? 'success'
                        : booking.status === 'cancelled'
                          ? 'error'
                          : 'warning'
                    }
                  >
                    {booking.status === 'confirmed'
                      ? 'Bestätigt'
                      : booking.status === 'cancelled'
                        ? 'Abgesagt'
                        : 'No-Show'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Buchungen vorhanden</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
