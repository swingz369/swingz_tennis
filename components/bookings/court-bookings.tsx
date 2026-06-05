'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Clock, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { de } from '@/lib/locale';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

interface Court {
  id: string;
  name: string;
  surface_type?: string;
  is_indoor?: boolean;
}

interface TimeSlot {
  start_time: string;
  is_available: boolean;
}

interface CourtSchedule {
  days: Array<{
    date: string;
    time_slots: TimeSlot[];
  }>;
}

interface Props {
  clubId?: string;
}

export function CourtBookings({ clubId }: Props) {
  const [selectedDate] = useState(new Date());
  const [courts, setCourts] = useState<Court[]>([]);
  const [schedules, setSchedules] = useState<Record<string, CourtSchedule>>({});
  const [loading, setLoading] = useState(true);
  const [bookingSlot, setBookingSlot] = useState<{ courtId: string; time: string } | null>(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const url = clubId ? `/api/courts?clubId=${clubId}` : '/api/courts';
        const res = await apiFetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();
        setCourts(data.courts ?? data ?? []);
      } catch {
        toast.error('Plätze konnten nicht geladen werden');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [clubId]);

  useEffect(() => {
    if (courts.length === 0) return;
    async function loadSchedules() {
      const result: Record<string, CourtSchedule> = {};
      await Promise.all(
        courts.map(async (court) => {
          try {
            const res = await apiFetch(
              `/api/courts/${court.id}/schedule?start_date=${dateStr}&end_date=${dateStr}`,
              { credentials: 'include' }
            );
            if (res.ok) result[court.id] = await res.json();
          } catch {
            // skip individual court failures
          }
        })
      );
      setSchedules(result);
    }
    loadSchedules();
  }, [courts, dateStr]);

  const handleBook = async (courtId: string, time: string) => {
    setBookingSlot({ courtId, time });
    try {
      const startTime = `${dateStr}T${time}:00`;
      const [h, m] = time.split(':').map(Number);
      const endHour = m === 30 ? h + 1 : h;
      const endMin = m === 30 ? '00' : '30';
      const endTime = `${dateStr}T${String(endHour).padStart(2, '0')}:${endMin}:00`;

      const res = await apiFetch('/api/bookings/court', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ courtId, clubId, startTime, endTime, bookingType: 'court' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Buchung fehlgeschlagen');
      toast.success('Platz erfolgreich gebucht!');
      // Refresh schedule for this court
      const schedRes = await apiFetch(
        `/api/courts/${courtId}/schedule?start_date=${dateStr}&end_date=${dateStr}`,
        { credentials: 'include' }
      );
      if (schedRes.ok)
        setSchedules((prev) => ({
          ...prev,
          [courtId]: schedRes.json() as unknown as CourtSchedule,
        }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Buchung fehlgeschlagen');
    } finally {
      setBookingSlot(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platzreservierung</CardTitle>
        <CardDescription>Reserviere einen Platz für dein freies Spiel</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">
            {format(selectedDate, 'EEEE, d. MMMM yyyy', { locale: de })}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : courts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Keine Plätze verfügbar</p>
        ) : (
          <div className="grid gap-4">
            {courts.map((court) => {
              const slots = schedules[court.id]?.days?.[0]?.time_slots ?? [];
              return (
                <div key={court.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-brand-light" />
                        {court.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {court.surface_type} · {court.is_indoor ? 'Indoor' : 'Outdoor'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                    {slots.slice(0, 8).map((slot) => {
                      const time = slot.start_time.substring(11, 16);
                      const busy = bookingSlot?.courtId === court.id && bookingSlot?.time === time;
                      return (
                        <Button
                          key={slot.start_time}
                          variant={slot.is_available ? 'outline' : 'ghost'}
                          size="sm"
                          disabled={!slot.is_available || !!bookingSlot}
                          className={`text-xs ${!slot.is_available ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => slot.is_available && handleBook(court.id, time)}
                        >
                          {busy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Clock className="h-3 w-3 mr-1" />
                              {time}
                            </>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Buchungsregeln</h4>
          <ul className="text-sm text-blue-700 dark:text-blue-200 space-y-1">
            <li>• Maximale Buchungsdauer: 90 Minuten</li>
            <li>• Buchungen bis zu 7 Tage im Voraus möglich</li>
            <li>• Kostenlose Stornierung bis 24h vor Beginn</li>
            <li>• Maximal 2 Buchungen pro Tag</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
