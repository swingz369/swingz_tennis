'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  User,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface Trainer {
  id: string;
  full_name: string;
  email: string;
  specialties?: string[];
  nextSlot?: Slot | null;
}

interface Slot {
  id: string;
  trainer_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'available' | 'booked';
  notes: string | null;
}

function getWeekDays(anchor: Date): Date[] {
  const days: Date[] = [];
  const monday = new Date(anchor);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function toLocalDateString(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function MemberTrainerBookingPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loadingTrainers, setLoadingTrainers] = useState(true);
  const [errorTrainers, setErrorTrainers] = useState<string | null>(null);

  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [trainerSlots, setTrainerSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [confirmSlot, setConfirmSlot] = useState<Slot | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const weekDays = getWeekDays(weekAnchor);
  const weekFrom = toLocalDateString(weekDays[0]);
  const weekTo = toLocalDateString(weekDays[6]);

  // Fetch trainers
  useEffect(() => {
    const load = async () => {
      setLoadingTrainers(true);
      setErrorTrainers(null);
      try {
        // Use trainer-profiles to get list
        const res = await fetch('/api/trainers');
        if (!res.ok) throw new Error('Fehler beim Laden der Trainer');
        const data = await res.json();
        const trainerList: Trainer[] = (data.trainers ?? data.members ?? []).map((t: any) => ({
          id: t.id ?? t.user_id ?? t.trainer_id,
          full_name: t.full_name ?? t.name ?? t.users?.full_name ?? 'Trainer',
          email: t.email ?? t.users?.email ?? '',
          specialties: t.specialties ?? t.skills ?? [],
        }));
        setTrainers(trainerList);
      } catch (e: any) {
        setErrorTrainers(e.message);
      } finally {
        setLoadingTrainers(false);
      }
    };
    load();
  }, []);

  // Fetch trainer slots when trainer or week changes
  const fetchSlots = useCallback(async () => {
    if (!selectedTrainer) return;
    setLoadingSlots(true);
    try {
      const res = await fetch(
        `/api/trainer/availability?trainerId=${selectedTrainer.id}&from=${weekFrom}T00:00:00Z&to=${weekTo}T23:59:59Z`
      );
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      setTrainerSlots((data.slots ?? []).filter((s: Slot) => s.status === 'available'));
    } catch {
      setTrainerSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedTrainer, weekFrom, weekTo]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleBook = async () => {
    if (!confirmSlot || !selectedTrainer) return;
    setBookingLoading(true);
    setBookingError(null);
    try {
      const res = await fetch('/api/trainer/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainerId: selectedTrainer.id,
          date: confirmSlot.date,
          startTime: confirmSlot.start_time,
          endTime: confirmSlot.end_time,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Buchung fehlgeschlagen');
      setBookingSuccess(true);
      setConfirmSlot(null);
      await fetchSlots();
    } catch (e: any) {
      setBookingError(e.message);
    } finally {
      setBookingLoading(false);
    }
  };

  const formatWeekRange = () => {
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };
    return `${weekDays[0].toLocaleDateString('de-DE', opts)} – ${weekDays[6].toLocaleDateString('de-DE', opts)}`;
  };

  const getSlotsForDay = (day: Date) => {
    const ds = toLocalDateString(day);
    return trainerSlots.filter((s) => s.date.startsWith(ds));
  };

  if (bookingSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle className="h-8 w-8 text-brand-light" />
        </div>
        <h2 className="text-xl font-bold">Buchung erfolgreich!</h2>
        <p className="text-sm text-muted-foreground">
          Deine Einzelstunde wurde gebucht. Du erhältst eine Bestätigung.
        </p>
        <Button
          className="bg-brand-light hover:bg-brand-light/80 text-white"
          onClick={() => {
            setBookingSuccess(false);
            setSelectedTrainer(null);
          }}
        >
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  // Trainer list view
  if (!selectedTrainer) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trainer buchen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Wähle einen Trainer für deine Einzelstunde
          </p>
        </div>

        {loadingTrainers ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Trainer werden geladen…
          </div>
        ) : errorTrainers ? (
          <div className="text-center py-10 text-red-500 text-sm">{errorTrainers}</div>
        ) : trainers.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Keine Trainer verfügbar
          </div>
        ) : (
          <div className="space-y-3">
            {trainers.map((trainer) => (
              <Card
                key={trainer.id}
                className="cursor-pointer hover:border-brand-light/40 hover:shadow-sm transition-all p-0"
                onClick={() => setSelectedTrainer(trainer)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-light/10 shrink-0">
                      <User className="h-5 w-5 text-brand-light" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{trainer.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{trainer.email}</p>
                      {trainer.specialties && trainer.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {trainer.specialties.slice(0, 3).map((s) => (
                            <Badge
                              key={s}
                              className="text-[11px] bg-brand-light/10 text-brand-light border-0"
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Trainer calendar view
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedTrainer(null)}
          className="p-1 h-auto"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{selectedTrainer.full_name}</h1>
          <p className="text-xs text-muted-foreground">Verfügbare Zeitfenster wählen</p>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setWeekAnchor((w) => {
              const d = new Date(w);
              d.setDate(d.getDate() - 7);
              return d;
            })
          }
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{formatWeekRange()}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setWeekAnchor((w) => {
              const d = new Date(w);
              d.setDate(d.getDate() + 7);
              return d;
            })
          }
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week calendar */}
      {loadingSlots ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Laden…</div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((day, idx) => {
            const daySlots = getSlotsForDay(day);
            const isToday = toLocalDateString(day) === toLocalDateString(new Date());
            return (
              <div key={idx} className="min-h-24">
                <div
                  className={`text-center text-[11px] font-semibold mb-1 py-1 rounded-lg ${
                    isToday ? 'bg-brand-light text-white' : 'text-muted-foreground'
                  }`}
                >
                  <div>{DAY_NAMES[idx]}</div>
                  <div className="text-[11px] font-normal">{day.getDate()}</div>
                </div>
                <div className="space-y-1">
                  {daySlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => {
                        setConfirmSlot(slot);
                        setBookingError(null);
                      }}
                      className="w-full text-left rounded-md px-1.5 py-1 text-[11px] leading-tight bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors cursor-pointer"
                    >
                      <div className="font-medium">{slot.start_time}</div>
                      <div className="text-[11px] opacity-75">{slot.end_time}</div>
                    </button>
                  ))}
                  {daySlots.length === 0 && (
                    <div className="h-8 rounded-md border-2 border-dashed border-gray-100 dark:border-white/5" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {trainerSlots.length === 0 && !loadingSlots && (
        <p className="text-center text-sm text-muted-foreground py-4">
          Keine verfügbaren Slots in dieser Woche
        </p>
      )}

      {/* Confirm booking dialog */}
      <Dialog open={!!confirmSlot} onOpenChange={() => setConfirmSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-light" />
              Stunde buchen
            </DialogTitle>
          </DialogHeader>
          {confirmSlot && (
            <div className="space-y-3 py-2">
              <div className="rounded-xl bg-brand-light/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-brand-light" />
                  <span className="text-sm font-medium">{selectedTrainer?.full_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {new Date(confirmSlot.date).toLocaleDateString('de-DE', {
                      weekday: 'long',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {confirmSlot.start_time} – {confirmSlot.end_time} Uhr
                  </span>
                </div>
              </div>
              {confirmSlot.notes && (
                <p className="text-xs text-muted-foreground">{confirmSlot.notes}</p>
              )}
              {bookingError && <p className="text-xs text-red-500">{bookingError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmSlot(null)}
              disabled={bookingLoading}
            >
              Abbrechen
            </Button>
            <Button
              className="bg-brand-light hover:bg-brand-light/80 text-white"
              onClick={handleBook}
              disabled={bookingLoading}
            >
              {bookingLoading ? 'Buchen…' : 'Jetzt buchen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
