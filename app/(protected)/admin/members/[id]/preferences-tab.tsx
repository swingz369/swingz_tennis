'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, Target, Users, Save, Loader2, CheckCircle2, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

type DaySchedule = Array<{ start: string; end: string }>;

const PRESET_STARTS = [
  '08:00',
  '09:30',
  '11:00',
  '13:00',
  '14:30',
  '16:00',
  '17:30',
  '19:00',
] as const;

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

  // Custom time range form
  const [customDay, setCustomDay] = useState<keyof WeeklyAvailability>('monday');
  const [customFrom, setCustomFrom] = useState('08:00');
  const [customTo, setCustomTo] = useState('10:00');

  const fetchPrefs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/members/${userId}/schedule-preferences?clubId=${clubId}`);
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

  const togglePresetSlot = useCallback((day: keyof WeeklyAvailability, start: string) => {
    const [h, m] = start.split(':').map(Number);
    const end = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setPrefs((prev) => {
      const daySlots = prev.weekly_availability[day];
      const exists = daySlots.some((s) => s.start === start && s.end === end);
      return {
        ...prev,
        weekly_availability: {
          ...prev.weekly_availability,
          [day]: exists
            ? daySlots.filter((s) => !(s.start === start && s.end === end))
            : [...daySlots, { start, end }],
        },
      };
    });
  }, []);

  const removeSlot = useCallback((day: keyof WeeklyAvailability, start: string, end: string) => {
    setPrefs((prev) => ({
      ...prev,
      weekly_availability: {
        ...prev.weekly_availability,
        [day]: prev.weekly_availability[day].filter((s) => !(s.start === start && s.end === end)),
      },
    }));
  }, []);

  const addCustomSlot = useCallback(() => {
    if (customFrom >= customTo) {
      toast.error('Startzeit muss vor Endzeit liegen');
      return;
    }
    setPrefs((prev) => ({
      ...prev,
      weekly_availability: {
        ...prev.weekly_availability,
        [customDay]: [...prev.weekly_availability[customDay], { start: customFrom, end: customTo }],
      },
    }));
    setCustomFrom('08:00');
    setCustomTo('10:00');
    toast.success('Zeitfenster hinzugefügt');
  }, [customDay, customFrom, customTo]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await apiFetch(`/api/members/${userId}/schedule-preferences`, {
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
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
            <Target className="h-4 w-4 text-brand-primary" />
            Trainingslevel & Altersgruppe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bevorzugtes Level</Label>
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
              <Label className="text-xs text-muted-foreground">Altersgruppe</Label>
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
                <Clock className="h-4 w-4 text-brand-accent" />
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
        <CardContent className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const slots = prefs.weekly_availability[key];
            return (
              <div key={key} className="space-y-2">
                <Label className="text-sm font-medium">{label}</Label>
                {/* Preset chip toggles */}
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_STARTS.map((start) => {
                    const [h, m] = start.split(':').map(Number);
                    const end = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    const active = slots.some((s) => s.start === start && s.end === end);
                    return (
                      <button
                        key={start}
                        onClick={() => togglePresetSlot(key, start)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                          active
                            ? 'bg-brand-primary text-white shadow-sm'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {start}
                      </button>
                    );
                  })}
                </div>
                {/* Non-preset (custom) slots */}
                {slots
                  .filter((s) => {
                    const isPreset = PRESET_STARTS.some((ps) => {
                      const [ph, pm] = ps.split(':').map(Number);
                      const pe = `${String(ph + 1).padStart(2, '0')}:${String(pm).padStart(2, '0')}`;
                      return s.start === ps && s.end === pe;
                    });
                    return !isPreset;
                  })
                  .map((slot, idx) => (
                    <div key={`custom-${idx}`} className="flex items-center gap-2 ml-2">
                      <Input
                        type="time"
                        value={slot.start}
                        onChange={(e) => {
                          const newSlots = [...slots];
                          const realIdx = newSlots.findIndex(
                            (s) => s.start === slot.start && s.end === slot.end
                          );
                          if (realIdx >= 0) {
                            newSlots[realIdx] = { ...newSlots[realIdx], start: e.target.value };
                            setPrefs((prev) => ({
                              ...prev,
                              weekly_availability: { ...prev.weekly_availability, [key]: newSlots },
                            }));
                          }
                        }}
                        className="w-[120px] h-8 text-sm"
                      />
                      <span className="text-muted-foreground text-sm">–</span>
                      <Input
                        type="time"
                        value={slot.end}
                        onChange={(e) => {
                          const newSlots = [...slots];
                          const realIdx = newSlots.findIndex(
                            (s) => s.start === slot.start && s.end === slot.end
                          );
                          if (realIdx >= 0) {
                            newSlots[realIdx] = { ...newSlots[realIdx], end: e.target.value };
                            setPrefs((prev) => ({
                              ...prev,
                              weekly_availability: { ...prev.weekly_availability, [key]: newSlots },
                            }));
                          }
                        }}
                        className="w-[120px] h-8 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-error-400 hover:text-error-600"
                        onClick={() => removeSlot(key, slot.start, slot.end)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                {slots.length === 0 && (
                  <p className="text-xs text-muted-foreground pl-1">Keine Verfügbarkeit</p>
                )}
              </div>
            );
          })}

          {/* Custom time range */}
          <div className="pt-3 mt-3 border-t border-border">
            <Label className="text-xs text-muted-foreground mb-2 block">
              Benutzerdefiniertes Zeitfenster hinzufügen
            </Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={customDay}
                onValueChange={(v) => setCustomDay(v as keyof WeeklyAvailability)}
              >
                <SelectTrigger className="w-[120px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map(({ key, label }) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">von</span>
              <Input
                type="time"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-[110px] h-9 text-sm"
              />
              <span className="text-xs text-muted-foreground">bis</span>
              <Input
                type="time"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-[110px] h-9 text-sm"
              />
              <Button size="sm" variant="outline" className="gap-1 h-9" onClick={addCustomSlot}>
                <Plus className="h-4 w-4" />
                Hinzufügen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Max Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-brand-primary" />
            Trainingspensum
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Maximale Trainingseinheiten pro Woche
            </Label>
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
            <CheckCircle2 className="h-4 w-4 text-brand-accent" />
            Anmerkungen & Wünsche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Besondere Wünsche</Label>
            <Textarea
              value={prefs.special_requests || ''}
              onChange={(e) => setPrefs({ ...prefs, special_requests: e.target.value || null })}
              placeholder="z.B. bevorzugte Trainingspartner, bestimmte Plätze..."
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Interne Notizen (nur Admin)</Label>
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
