'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from '@/lib/locale';
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

function toDisplay(b: ApiBooking): DisplayBooking {
  const start = b.sessions?.timeslot_start ?? b.start_time ?? b.session_start_time ?? '';
  const end = b.sessions?.timeslot_end ?? b.end_time ?? '';
  const date = start ? new Date(start) : new Date();
  return {
    id: b.id,
    type: b.session_id ? 'session' : 'court',
    title: b.sessions?.courts?.name ? `Training — ${b.sessions.courts.name}` : 'Buchung',
    date,
    startTime: start ? format(new Date(start), 'HH:mm') : '—',
    endTime: end ? format(new Date(end), 'HH:mm') : '—',
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
        setBookings((data.bookings ?? []).map(toDisplay));
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
      const res = await apiFetch(`/api/bookings/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Stornierung fehlgeschlagen');
      }
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)));
      toast.success('Buchung storniert');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Stornierung fehlgeschlagen');
    } finally {
      setCancelling(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500">Bestätigt</Badge>;
      case 'pending':
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-700">
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
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
            title="Keine Buchungen"
            description="Du hast noch keine aktiven Buchungen. Buche ein Training oder einen Platz, um loszulegen."
            action={{
              label: 'Jetzt buchen',
              onClick: () => router.push('/bookings-unified'),
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
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
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
                      <span>{format(booking.date, 'EEEE, d. MMMM', { locale: de })}</span>
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
                  <Button variant="outline" size="sm">
                    Details
                  </Button>
                  {booking.status !== 'cancelled' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={cancelling === booking.id}
                      onClick={() => handleCancel(booking.id)}
                    >
                      {cancelling === booking.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-1" />
                          Stornieren
                        </>
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
