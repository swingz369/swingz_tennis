'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Clock, Loader2, Sun, Snowflake, Layers, Leaf } from 'lucide-react';
import { getSurfaceLabel } from '@/lib/court-calendar-utils';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [courts, setCourts] = useState<Court[]>([]);
  const [schedules, setSchedules] = useState<Record<string, CourtSchedule>>({});
  const [loading, setLoading] = useState(true);
  const [bookingSlot, setBookingSlot] = useState<{ courtId: string; time: string } | null>(null);
  const [bookingDuration, setBookingDuration] = useState(30);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }, []);

  const goToPrevDay = useCallback(() => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d < new Date(new Date().toDateString()) ? prev : d;
    });
  }, []);

  const goToNextDay = useCallback(() => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d > maxDate ? prev : d;
    });
  }, [maxDate]);

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
      const [h, m] = time.split(':').map(Number);
      const endMinutes = h * 60 + m + bookingDuration;
      const endHour = Math.floor(endMinutes / 60);
      const endMin = endMinutes % 60;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

      const res = await apiFetch('/api/bookings/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ courtId, clubId, date: dateStr, startTime: time, endTime }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Buchung fehlgeschlagen');

      // If the club requires payment, redirect to Stripe checkout
      if (data.bookingId && data.requiresPayment) {
        toast.loading('Weiterleitung zur Zahlung…', { id: 'payment-redirect' });
        try {
          const payRes = await apiFetch('/api/stripe/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              type: 'booking',
              bookingId: data.bookingId,
              clubId,
              description: 'Platzreservierung',
            }),
          });
          const payData = await payRes.json();
          toast.dismiss('payment-redirect');
          if (payData.url) {
            window.location.assign(payData.url);
            return;
          }
        } catch {
          toast.dismiss('payment-redirect');
        }
      }

      toast.success('Platz erfolgreich gebucht!');
      // Refresh schedule for this court
      const schedRes = await apiFetch(
        `/api/courts/${courtId}/schedule?start_date=${dateStr}&end_date=${dateStr}`,
        { credentials: 'include' }
      );
      if (schedRes.ok) {
        const updatedSchedule = await schedRes.json();
        setSchedules((prev) => ({
          ...prev,
          [courtId]: updatedSchedule as CourtSchedule,
        }));
      }
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">
              {format(selectedDate, 'EEEE, d. MMMM yyyy', { locale: de })}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Buchungsdauer:</span>
          {[30, 60, 90].map((mins) => (
            <Button
              key={mins}
              variant={bookingDuration === mins ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setBookingDuration(mins)}
            >
              {mins} Min
            </Button>
          ))}
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
                <div key={court.id} className="border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-brand-light" />
                        {court.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            court.surface_type === 'clay'
                              ? 'bg-brand-accent-100 text-brand-accent-800 dark:bg-brand-accent-900/30 dark:text-brand-accent-300'
                              : court.surface_type === 'grass'
                                ? 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300'
                                : court.surface_type === 'artificial_grass'
                                  ? 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300'
                                  : 'bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-300'
                          }`}
                        >
                          {court.surface_type === 'clay' || court.surface_type === 'grass' ? (
                            <Leaf className="h-3 w-3" />
                          ) : (
                            <Layers className="h-3 w-3" />
                          )}
                          {getSurfaceLabel(court.surface_type || 'hard')}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            court.is_indoor
                              ? 'bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-300'
                              : 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300'
                          }`}
                        >
                          {court.is_indoor ? (
                            <Snowflake className="h-3 w-3" />
                          ) : (
                            <Sun className="h-3 w-3" />
                          )}
                          {court.is_indoor ? 'Indoor' : 'Outdoor'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                    {slots.map((slot) => {
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

        <div className="bg-info-50 dark:bg-info-900 border border-info-200 dark:border-info-800 rounded-xl p-4">
          <h4 className="font-medium text-info-900 dark:text-info-100 mb-2">Buchungsregeln</h4>
          <ul className="text-sm text-info-700 dark:text-info-200 space-y-1">
            <li>• Buchungsdauer wählbar: 30, 60 oder 90 Minuten</li>
            <li>• Buchungen bis zu 7 Tage im Voraus möglich</li>
            <li>• Kostenlose Stornierung bis 24h vor Beginn</li>
            <li>• Maximal 2 Buchungen pro Tag</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
