'use client';
import { Skeleton } from '@/components/ui/skeleton';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock, X, Loader2 } from 'lucide-react';
import { formatTime, formatWeekdayDate } from '@/lib/format';
import { EmptyState } from '@/components/ui/empty-state';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

interface ApiBooking {
  id: string;
  status: string;
  session_start_time?: string;
  start_time?: string;
  end_time?: string;
  session_id?: string;
  sessions?: {
    timeslot_start: string;
    timeslot_end: string;
    courts?: { name: string };
  };
}

interface DisplayBooking {
  id: string;
  type: string;
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  location: string;
  status: string;
}

/**
 * `sessions.timeslot_start/-end` sind `timestamp` OHNE Zeitzone: der Wert ist der
 * UTC-Zeitpunkt, trägt aber kein `Z`. `new Date()` liest ihn deshalb als Ortszeit
 * des Browsers — ein 18:00-Training erschien in Deutschland als 16:00. Die Felder
 * auf `bookings` sind dagegen `timestamptz` und damit eindeutig.
 */
const asUtc = (value: string | undefined): string =>
  value && !/(Z|[+-]\d{2}:?\d{2})$/.test(value) ? `${value}Z` : (value ?? '');

function toDisplay(b: ApiBooking): DisplayBooking {
  // Reihenfolge bewusst: erst die zonenbehafteten Felder der Buchung, erst danach
  // — und dann als UTC gelesen — die zonenlosen der Session.
  const start = b.start_time ?? b.session_start_time ?? asUtc(b.sessions?.timeslot_start) ?? '';
  const end = b.end_time ?? asUtc(b.sessions?.timeslot_end) ?? '';
  const date = start ? new Date(start) : new Date();
  return {
    id: b.id,
    type: b.session_id ? 'session' : 'court',
    title: b.sessions?.courts?.name ? `Training — ${b.sessions.courts.name}` : 'Buchung',
    date,
    // formatTime/formatWeekdayDate aus @/lib/format legen Europe/Berlin fest.
    // date-fns `format()` rendert dagegen in der Zeitzone der Laufzeit — auf
    // Vercel (UTC) erschien ein 18:00-Training deshalb als 16:00.
    startTime: formatTime(start),
    endTime: formatTime(end),
    location: b.sessions?.courts?.name ?? '—',
    status: b.status,
  };
}

export function MyBookings() {
  const router = useRouter();
  const [bookings, setBookings] = useState<DisplayBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await apiFetch('/api/bookings', { credentials: 'include' });
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();
        // ponytail: nur Kommendes, aufsteigend — die API liefert 50 Buchungen
        // absteigend, was als Trainingsplan mit alten Terminen oben startete.
        // Verlauf bei Bedarf als eigener Tab.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setBookings(
          (data.bookings ?? [])
            .map(toDisplay)
            .filter((b: DisplayBooking) => b.date >= today)
            .sort((a: DisplayBooking, b: DisplayBooking) => a.date.getTime() - b.date.getTime())
        );
      } catch {
        toast.error('Buchungen konnten nicht geladen werden');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCancel = async (id: string) => {
    setCancelling(id);
    try {
      const res = await apiFetch(`/api/bookings/${id}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err) || 'Stornierung fehlgeschlagen');
      }
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)));
      toast.success('Buchung storniert');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Stornierung fehlgeschlagen');
    } finally {
      setCancelling(null);
    }
  };

  const handleReactivate = async (id: string) => {
    setCancelling(id);
    try {
      const res = await apiFetch(`/api/bookings/${id}/reactivate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err) || 'Anmeldung fehlgeschlagen');
      }
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'confirmed' } : b)));
      toast.success('Du bist wieder angemeldet');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen');
    } finally {
      setCancelling(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-success-500">Bestätigt</Badge>;
      case 'pending':
        return (
          <Badge variant="outline" className="border-warning-500 text-warning-700">
            Ausstehend
          </Badge>
        );
      case 'cancelled':
        return <Badge variant="error">Storniert</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center py-8">
          <div className="w-full space-y-3" role="status" aria-label="Wird geladen">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={Calendar}
            title="Keine kommenden Buchungen"
            description="Du hast aktuell keine bevorstehenden Trainings oder Platzbuchungen. Buche eine Einheit, um loszulegen."
            action={{
              label: 'Jetzt buchen',
              onClick: () => router.push('/bookings'),
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meine Buchungen</CardTitle>
        <CardDescription>Übersicht über alle deine aktiven Buchungen</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="border rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{booking.title}</h3>
                    {getStatusBadge(booking.status)}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{formatWeekdayDate(booking.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        {booking.startTime} – {booking.endTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{booking.location}</span>
                    </div>
                  </div>
                  <div>
                    <Badge variant="outline" className="text-xs">
                      {booking.type === 'session' ? 'Training' : 'Platzreservierung'}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {booking.status !== 'cancelled' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-error-600 hover:text-error-700 hover:bg-error-50"
                      disabled={cancelling === booking.id}
                      onClick={() => handleCancel(booking.id)}
                    >
                      {cancelling === booking.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-1" />
                          {booking.type === 'session' ? 'Abmelden' : 'Stornieren'}
                        </>
                      )}
                    </Button>
                  )}
                  {/* Eine versehentliche Abmeldung war bis dahin endgültig — das
                      Mitglied musste beim Admin anrufen. */}
                  {booking.status === 'cancelled' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancelling === booking.id}
                      onClick={() => handleReactivate(booking.id)}
                    >
                      {cancelling === booking.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Doch teilnehmen'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gesamt</span>
            <span className="font-medium">
              {bookings.filter((b) => b.status !== 'cancelled').length} aktive Buchungen
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
