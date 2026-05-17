'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Clock, Plus, Trash2, Save } from 'lucide-react';

interface AvailabilitySlot {
  id?: string;
  weekday: number;
  fromTime: string;
  untilTime: string;
  isAvailable: boolean;
}

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const HOURS = Array.from({ length: 14 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);

export default function TrainerAvailabilityManager() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch('/api/trainer/availability');
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      setSlots(data.slots || []);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const addSlot = () => {
    const defaultStart = slots.length > 0 ? slots[slots.length - 1].fromTime : '08:00';
    const defaultEnd = slots.length > 0 ? slots[slots.length - 1].untilTime : '10:00';
    setSlots((prev) => [
      ...prev,
      { weekday: 0, fromTime: defaultStart, untilTime: defaultEnd, isAvailable: true },
    ]);
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSlot = (
    index: number,
    field: keyof AvailabilitySlot,
    value: string | number | boolean
  ) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const saveSlots = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/trainer/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots }),
      });
      if (!res.ok) throw new Error('Fehler beim Speichern');
      setMessage('Verfügbarkeit gespeichert ✓');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage(`Fehler: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Verfügbarkeit</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deine wöchentlichen Trainingszeiten
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addSlot}>
            <Plus className="h-4 w-4 mr-1" /> Hinzufügen
          </Button>
          <Button size="sm" onClick={saveSlots} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Speichern
          </Button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${message.startsWith('Fehler') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}
        >
          {message}
        </div>
      )}

      {slots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-muted-foreground mb-3">Keine Verfügbarkeiten eingetragen</p>
            <Button onClick={addSlot} size="sm" variant="brand">
              <Plus className="h-4 w-4 mr-1" /> Erste Verfügbarkeit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {slots.map((slot, index) => (
            <Card key={index}>
              <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={slot.weekday}
                    onChange={(e) => updateSlot(index, 'weekday', parseInt(e.target.value))}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary bg-background"
                  >
                    {WEEKDAYS.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">von</span>
                  <select
                    value={slot.fromTime}
                    onChange={(e) => updateSlot(index, 'fromTime', e.target.value)}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary bg-background"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-muted-foreground">bis</span>
                  <select
                    value={slot.untilTime}
                    onChange={(e) => updateSlot(index, 'untilTime', e.target.value)}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary bg-background"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1" />

                <Badge variant={slot.isAvailable ? 'default' : 'secondary'} className="text-xs">
                  {slot.isAvailable ? 'Verfügbar' : 'Nicht verfügbar'}
                </Badge>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSlot(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
