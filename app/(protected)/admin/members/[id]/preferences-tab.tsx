'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, Target, Users, Save, Loader2, CheckCircle2 } from 'lucide-react';

type DaySchedule = Array<{ start: string; end: string }>;

interface WeeklyAvailability {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface MemberPrefs {
  id?: string;
  preferred_level: string | null;
  preferred_age_group: string | null;
  weekly_availability: WeeklyAvailability;
  wish_partner_ids: string[];
  preferred_trainer_ids: string[];
  preferred_court_ids: string[];
  max_sessions_per_week: number | null;
  special_requests: string | null;
  notes: string | null;
}

const DAYS: { key: keyof WeeklyAvailability; label: string }[] = [
  { key: 'monday', label: 'Montag' },
  { key: 'tuesday', label: 'Dienstag' },
  { key: 'wednesday', label: 'Mittwoch' },
  { key: 'thursday', label: 'Donnerstag' },
  { key: 'friday', label: 'Freitag' },
  { key: 'saturday', label: 'Samstag' },
  { key: 'sunday', label: 'Sonntag' },
];

const HOURS = Array.from({ length: 18 }, (_, i) => {
  const h = i + 6; // 06:00 - 23:00
  return `${String(h).padStart(2, '0')}:00`;
});

const emptyAvailability = (): WeeklyAvailability => ({
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
});

interface Props {
  userId: string;
  clubId: string;
}

export function PreferencesTab({ userId, clubId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<MemberPrefs>({
    preferred_level: null,
    preferred_age_group: null,
    weekly_availability: emptyAvailability(),
    wish_partner_ids: [],
    preferred_trainer_ids: [],
    preferred_court_ids: [],
    max_sessions_per_week: null,
    special_requests: null,
    notes: null,
  });

  const fetchPrefs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/members/${userId}/schedule-preferences?clubId=${clubId}`);
      if (res.ok) {
        const data = await res.json();
        setPrefs(
          data.preferences ?? {
            preferred_level: null,
            preferred_age_group: null,
            weekly_availability: emptyAvailability(),
            wish_partner_ids: [],
            preferred_trainer_ids: [],
            preferred_court_ids: [],
            max_sessions_per_week: null,
            special_requests: null,
            notes: null,
          }
        );
      }
    } catch (err) {
      console.error('Failed to fetch schedule preferences:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, clubId]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/members/${userId}/schedule-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId,
          ...prefs,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Speichern');
      }

      toast.success('Präferenzen gespeichert');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const addTimeSlot = (day: keyof WeeklyAvailability) => {
    setPrefs((prev) => ({
      ...prev,
      weekly_availability: {
        ...prev.weekly_availability,
        [day]: [...prev.weekly_availability[day], { start: '09:00', end: '10:00' }],
      },
    }));
  };

  const removeTimeSlot = (day: keyof WeeklyAvailability, index: number) => {
    setPrefs((prev) => ({
      ...prev,
      weekly_availability: {
        ...prev.weekly_availability,
        [day]: prev.weekly_availability[day].filter((_, i) => i !== index),
      },
    }));
  };

  const updateTimeSlot = (
    day: keyof WeeklyAvailability,
    index: number,
    field: 'start' | 'end',
    value: string
  ) => {
    setPrefs((prev) => ({
      ...prev,
      weekly_availability: {
        ...prev.weekly_availability,
        [day]: prev.weekly_availability[day].map((slot, i) =>
          i === index ? { ...slot, [field]: value } : slot
        ),
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Lade Präferenzen...</span>
      </div>
    );
  }

  const totalSlots = Object.values(prefs.weekly_availability).reduce(
    (sum, slots) => sum + slots.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Level & Age Group */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-brandPrimary" />
            Trainingslevel & Altersgruppe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Bevorzugtes Level</Label>
              <Select
                value={prefs.preferred_level || ''}
                onValueChange={(v) => setPrefs({ ...prefs, preferred_level: v || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Keine Präferenz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Anfänger</SelectItem>
                  <SelectItem value="intermediate">Fortgeschritten</SelectItem>
                  <SelectItem value="advanced">Leistungsniveau</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Altersgruppe</Label>
              <Select
                value={prefs.preferred_age_group || ''}
                onValueChange={(v) => setPrefs({ ...prefs, preferred_age_group: v || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Keine Präferenz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Junioren</SelectItem>
                  <SelectItem value="senior">Senioren</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Availability */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-brandAccent" />
                Wöchentliche Verfügbarkeit
              </CardTitle>
              <CardDescription>
                {totalSlots > 0
                  ? `${totalSlots} Zeitfenster eingetragen`
                  : 'Noch keine Zeitfenster definiert'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {DAYS.map(({ key, label }) => {
            const slots = prefs.weekly_availability[key];
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{label}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => addTimeSlot(key)}
                  >
                    + Zeitfenster
                  </Button>
                </div>
                {slots.length === 0 ? (
                  <p className="text-xs text-gray-400 pl-2">Keine Verfügbarkeit</p>
                ) : (
                  <div className="space-y-1.5">
                    {slots.map((slot, idx) => (
                      <div key={idx} className="flex items-center gap-2 ml-2">
                        <Select
                          value={slot.start}
                          onValueChange={(v) => updateTimeSlot(key, idx, 'start', v)}
                        >
                          <SelectTrigger className="w-[100px] h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {HOURS.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-gray-400 text-sm">–</span>
                        <Select
                          value={slot.end}
                          onValueChange={(v) => updateTimeSlot(key, idx, 'end', v)}
                        >
                          <SelectTrigger className="w-[100px] h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {HOURS.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-600"
                          onClick={() => removeTimeSlot(key, idx)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Max Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-brandPrimary" />
            Trainingspensum
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Maximale Trainingseinheiten pro Woche</Label>
            <Select
              value={String(prefs.max_sessions_per_week || '')}
              onValueChange={(v) =>
                setPrefs({ ...prefs, max_sessions_per_week: v ? Number(v) : null })
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Kein Limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 × pro Woche</SelectItem>
                <SelectItem value="2">2 × pro Woche</SelectItem>
                <SelectItem value="3">3 × pro Woche</SelectItem>
                <SelectItem value="4">4 × pro Woche</SelectItem>
                <SelectItem value="5">5 × pro Woche</SelectItem>
                <SelectItem value="7">Täglich</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Special Requests & Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-brandAccent" />
            Anmerkungen & Wünsche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Besondere Wünsche</Label>
            <Textarea
              value={prefs.special_requests || ''}
              onChange={(e) => setPrefs({ ...prefs, special_requests: e.target.value || null })}
              placeholder="z.B. bevorzugte Trainingspartner, bestimmte Plätze..."
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Interne Notizen (nur Admin)</Label>
            <Textarea
              value={prefs.notes || ''}
              onChange={(e) => setPrefs({ ...prefs, notes: e.target.value || null })}
              placeholder="Admin-Notizen..."
              rows={2}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Speichern...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Präferenzen speichern
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
