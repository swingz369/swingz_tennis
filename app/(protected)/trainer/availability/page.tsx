'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  User,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Slot {
  id: string;
  trainer_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'available' | 'booked';
  notes: string | null;
  trainers?: {
    id: string;
    users?: { full_name: string; email: string };
  };
  bookedBy?: { full_name: string; email: string } | null;
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

export default function TrainerAvailabilityPage() {
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add slot dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState('');
  const [addStart, setAddStart] = useState('09:00');
  const [addEnd, setAddEnd] = useState('10:00');
  const [addNotes, setAddNotes] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Info dialog
  const [infoSlot, setInfoSlot] = useState<Slot | null>(null);

  const weekDays = getWeekDays(weekAnchor);
  const weekFrom = toLocalDateString(weekDays[0]);
  const weekTo = toLocalDateString(weekDays[6]);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/trainer/availability?from=${weekFrom}T00:00:00Z&to=${weekTo}T23:59:59Z`
      );
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [weekFrom, weekTo]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleAddSlot = async () => {
    if (!addDate || !addStart || !addEnd) {
      setAddError('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch('/api/trainer/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: `${addDate}T00:00:00Z`,
          start_time: addStart,
          end_time: addEnd,
          notes: addNotes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Speichern');
      setAddOpen(false);
      setAddDate('');
      setAddStart('09:00');
      setAddEnd('10:00');
      setAddNotes('');
      await fetchSlots();
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Slot wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/trainer/availability/${slotId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Fehler beim Löschen');
        return;
      }
      await fetchSlots();
    } catch {
      alert('Fehler beim Löschen');
    }
  };

  // Stats
  const availableSlots = slots.filter((s) => s.status === 'available');
  const bookedSlots = slots.filter((s) => s.status === 'booked');
  const calcHours = (slotList: Slot[]) =>
    slotList.reduce((sum, s) => {
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      return sum + (eh * 60 + em - (sh * 60 + sm)) / 60;
    }, 0);
  const availableHours = calcHours(availableSlots);
  const bookedHours = calcHours(bookedSlots);

  const formatWeekRange = () => {
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };
    return `${weekDays[0].toLocaleDateString('de-DE', opts)} – ${weekDays[6].toLocaleDateString('de-DE', opts)}`;
  };

  const getSlotsForDay = (day: Date) => {
    const ds = toLocalDateString(day);
    return slots.filter((s) => s.date.startsWith(ds));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Verfügbarkeit</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Deine verfügbaren Zeitfenster</p>
        </div>
        <Button
          size="sm"
          className="bg-[#40916C] hover:bg-[#2d6a4f] text-white gap-1.5"
          onClick={() => {
            setAddDate(toLocalDateString(new Date()));
            setAddOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Verfügbar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-[#40916C]" />
              <p className="text-xs text-muted-foreground">Diese Woche verfügbar</p>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {availableHours % 1 === 0 ? availableHours : availableHours.toFixed(1)}h
            </p>
            <p className="text-xs text-muted-foreground">{availableSlots.length} Slots</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-red-500" />
              <p className="text-xs text-muted-foreground">Diese Woche gebucht</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-red-600">
              {bookedHours % 1 === 0 ? bookedHours : bookedHours.toFixed(1)}h
            </p>
            <p className="text-xs text-muted-foreground">{bookedSlots.length} Slots</p>
          </CardContent>
        </Card>
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
      {loading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Laden…</div>
      ) : error ? (
        <div className="text-center py-10 text-red-500 text-sm">{error}</div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((day, idx) => {
            const daySlots = getSlotsForDay(day);
            const isToday = toLocalDateString(day) === toLocalDateString(new Date());
            return (
              <div key={idx} className="min-h-24">
                <div
                  className={`text-center text-[11px] font-semibold mb-1 py-1 rounded-lg ${
                    isToday ? 'bg-[#40916C] text-white' : 'text-muted-foreground'
                  }`}
                >
                  <div>{DAY_NAMES[idx]}</div>
                  <div className="text-[10px] font-normal">{day.getDate()}</div>
                </div>
                <div className="space-y-1">
                  {daySlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => (slot.status === 'booked' ? setInfoSlot(slot) : null)}
                      className={`w-full text-left rounded-md px-1.5 py-1 text-[10px] leading-tight transition-colors ${
                        slot.status === 'booked'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 cursor-pointer hover:bg-red-200'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      }`}
                    >
                      <div className="font-medium">{slot.start_time}</div>
                      <div className="text-[9px] opacity-75">{slot.end_time}</div>
                      {slot.status === 'available' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSlot(slot.id);
                          }}
                          className="mt-0.5 text-[9px] opacity-60 hover:opacity-100 flex items-center gap-0.5"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      )}
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

      {/* Add Slot Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#40916C]" />
              Verfügbarkeit hinzufügen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-date">Datum</Label>
              <Input
                id="add-date"
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-start">Von</Label>
                <Input
                  id="add-start"
                  type="time"
                  value={addStart}
                  onChange={(e) => setAddStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-end">Bis</Label>
                <Input
                  id="add-end"
                  type="time"
                  value={addEnd}
                  onChange={(e) => setAddEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-notes">Notizen (optional)</Label>
              <Input
                id="add-notes"
                placeholder="z.B. Anfänger bevorzugt"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
              />
            </div>
            {addError && <p className="text-xs text-red-500">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addLoading}>
              Abbrechen
            </Button>
            <Button
              className="bg-[#40916C] hover:bg-[#2d6a4f] text-white"
              onClick={handleAddSlot}
              disabled={addLoading}
            >
              {addLoading ? 'Speichern…' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booked slot info dialog */}
      <Dialog open={!!infoSlot} onOpenChange={() => setInfoSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-4 w-4 text-red-500" />
              Gebuchte Stunde
            </DialogTitle>
          </DialogHeader>
          {infoSlot && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(infoSlot.date).toLocaleDateString('de-DE', {
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
                  {infoSlot.start_time} – {infoSlot.end_time} Uhr
                </span>
              </div>
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-0">
                Gebucht
              </Badge>
              {infoSlot.notes && <p className="text-sm text-muted-foreground">{infoSlot.notes}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInfoSlot(null)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
