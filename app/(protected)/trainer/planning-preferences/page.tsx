'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  MessageSquare,
  Save,
  Plus,
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { createLogger } from '@/lib/logger';

const log = createLogger('trainer:planning-preferences');

const MAX_TIME_PREFS = 5;

const DAYS = [
  { key: 'monday', label: 'Montag' },
  { key: 'tuesday', label: 'Dienstag' },
  { key: 'wednesday', label: 'Mittwoch' },
  { key: 'thursday', label: 'Donnerstag' },
  { key: 'friday', label: 'Freitag' },
  { key: 'saturday', label: 'Samstag' },
  { key: 'sunday', label: 'Sonntag' },
] as const;

const TIME_OPTIONS = Array.from({ length: 13 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`);

type TimePref = { day: string; start: string };
type WeeklyAvailability = Record<string, { start: string; end: string }[]>;

function prefsToAvailability(prefs: TimePref[]): WeeklyAvailability {
  const result: WeeklyAvailability = {};
  for (const { day, start } of prefs) {
    if (!day || !start) continue;
    const hour = parseInt(start, 10);
    const end = `${String(hour + 1).padStart(2, '0')}:00`;
    if (!result[day]) result[day] = [];
    if (!result[day].some((s) => s.start === start)) result[day].push({ start, end });
  }
  return result;
}

function availabilityToPrefs(avail: WeeklyAvailability): TimePref[] {
  const prefs: TimePref[] = [];
  for (const [day, slots] of Object.entries(avail ?? {}))
    for (const { start } of slots) prefs.push({ day, start });
  return prefs.slice(0, MAX_TIME_PREFS);
}

export default function TrainerPlanningPreferencesPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const userId = user?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seasons, setSeasons] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [clubId, setClubId] = useState('');
  const [timePrefs, setTimePrefs] = useState<TimePref[]>([]);
  const [notes, setNotes] = useState('');
  const [prefId, setPrefId] = useState<string | null>(null);

  // Load club + seasons
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('user_club_memberships')
      .select('club_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('role', 'trainer')
      .limit(1)
      .then(({ data: m }) => {
        if (!m?.length) {
          setLoading(false);
          return;
        }
        const cid = m[0].club_id;
        setClubId(cid);
        supabase
          .from('seasons')
          .select('id, name')
          .eq('club_id', cid)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(5)
          .then(({ data }) => {
            setSeasons(data ?? []);
            if (data?.length) setSelectedSeasonId(data[0].id);
            setLoading(false);
          });
      });
  }, [userId, supabase]);

  // Load existing preferences for selected season
  useEffect(() => {
    if (!userId || !selectedSeasonId) return;
    supabase
      .from('user_training_preferences')
      .select('id, weekly_availability, special_requests')
      .eq('user_id', userId)
      .eq('season_id', selectedSeasonId)
      .eq('user_role', 'trainer')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrefId(data.id);
          setTimePrefs(availabilityToPrefs(data.weekly_availability as WeeklyAvailability));
          setNotes((data as any).special_requests ?? '');
        } else {
          setPrefId(null);
          setTimePrefs([]);
          setNotes('');
        }
      });
  }, [userId, selectedSeasonId, supabase]);

  const addTimePref = useCallback(() => {
    if (timePrefs.length >= MAX_TIME_PREFS) return;
    setTimePrefs((p) => [...p, { day: 'monday', start: '18:00' }]);
  }, [timePrefs.length]);

  const updateTimePref = useCallback((idx: number, field: keyof TimePref, value: string) => {
    setTimePrefs((p) => p.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }, []);

  const removeTimePref = useCallback((idx: number) => {
    setTimePrefs((p) => p.filter((_, i) => i !== idx));
  }, []);

  const handleSave = useCallback(async () => {
    if (!userId || !selectedSeasonId || !clubId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        season_id: selectedSeasonId,
        user_id: userId,
        club_id: clubId,
        user_role: 'trainer',
        weekly_availability: prefsToAvailability(timePrefs),
        special_requests: notes || null,
        last_modified_at: new Date().toISOString(),
      };

      if (prefId) {
        const { error: upErr } = await supabase
          .from('user_training_preferences')
          .update(payload)
          .eq('id', prefId);
        if (upErr) throw upErr;
      } else {
        const { data, error: insErr } = await supabase
          .from('user_training_preferences')
          .insert(payload)
          .select('id')
          .single();
        if (insErr) throw insErr;
        if (data) setPrefId((data as { id: string }).id);
      }

      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (err) {
      log.error('Save error', err instanceof Error ? err : undefined);
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }, [userId, selectedSeasonId, clubId, prefId, timePrefs, notes, supabase]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 py-8 px-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const filledPrefs = timePrefs.filter((p) => p.day && p.start);

  return (
    <div className="max-w-2xl mx-auto space-y-5 py-8 px-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Planungspräferenzen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Wöchentliche Verfügbarkeit für die Saisonplanung — wird vom Clustering-Algorithmus
          genutzt.
        </p>
      </div>

      {/* Season selector */}
      {seasons.length > 0 && (
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Saison auswählen" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {seasons.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning-200 bg-warning-50/60 px-3 py-2 text-sm text-warning-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Keine aktiven Saisons gefunden.
        </div>
      )}

      {/* Time preferences */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-primary" />
              Wann bist du verfügbar?
            </CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {filledPrefs.length} / {MAX_TIME_PREFS}
            </span>
          </div>
          <CardDescription>
            Bis zu {MAX_TIME_PREFS} wöchentlich wiederkehrende Zeitpräferenzen für die
            Gruppenplanung.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {timePrefs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Noch keine Verfügbarkeit angegeben.
            </p>
          )}

          {timePrefs.map((pref, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2.5"
            >
              <span className="text-xs font-semibold text-muted-foreground w-5 text-center shrink-0">
                {idx + 1}
              </span>
              <Select value={pref.day} onValueChange={(v) => updateTimePref(idx, 'day', v)}>
                <SelectTrigger className="flex-1 h-9">
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
              <Select value={pref.start} onValueChange={(v) => updateTimePref(idx, 'start', v)}>
                <SelectTrigger className="w-28 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t} Uhr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-error-500 shrink-0"
                onClick={() => removeTimePref(idx)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {timePrefs.length < MAX_TIME_PREFS && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 mt-1"
              onClick={addTimePref}
            >
              <Plus className="h-4 w-4" />
              Zeit hinzufügen ({MAX_TIME_PREFS - timePrefs.length} verbleibend)
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-brand-primary" />
            Anmerkungen
          </CardTitle>
          <CardDescription>
            z.B. &quot;Nur nachmittags&quot; oder &quot;Nicht Samstags&quot;
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optionale Hinweise zur Saisonplanung..."
            className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </CardContent>
      </Card>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-600">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {savedOk && (
        <div className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-700">
          <CheckCircle className="h-4 w-4 shrink-0" /> Gespeichert
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleSave}
          disabled={saving || !selectedSeasonId}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Speichern
        </Button>
      </div>
    </div>
  );
}
