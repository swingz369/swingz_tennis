'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  Target,
  MessageSquare,
  Save,
  Send,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Settings,
  Loader2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DAYS = [
  { key: 'monday', label: 'Montag' },
  { key: 'tuesday', label: 'Dienstag' },
  { key: 'wednesday', label: 'Mittwoch' },
  { key: 'thursday', label: 'Donnerstag' },
  { key: 'friday', label: 'Freitag' },
  { key: 'saturday', label: 'Samstag' },
  { key: 'sunday', label: 'Sonntag' },
] as const;

const LEVELS = ['beginner', 'intermediate', 'advanced', 'professional'] as const;

type AvailabilitySlot = { start: string; end: string };
type WeeklyAvailability = Record<string, AvailabilitySlot[]>;

export default function MemberPreferencesPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const userId = user?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current season
  const [seasons, setSeasons] = useState<
    Array<{ id: string; name: string; preferences_open: boolean }>
  >([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');

  // Preferences state
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability>({});
  const [preferredLevel, setPreferredLevel] = useState<string>('');
  const [preferredAgeGroup, setPreferredAgeGroup] = useState<string>('');
  const [selfAssessedLevel, setSelfAssessedLevel] = useState<string>('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [prefId, setPrefId] = useState<string | null>(null);

  // Load seasons
  useEffect(() => {
    if (!userId) return;
    async function load() {
      const { data: memberships } = await supabase
        .from('user_club_memberships')
        .select('club_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1);

      if (!memberships?.length) {
        setLoading(false);
        return;
      }

      const clubId = memberships[0].club_id;
      const { data: seasonList } = await supabase
        .from('seasons')
        .select('id, name, preferences_open')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);

      setSeasons(seasonList || []);
      if (seasonList?.length) setSelectedSeasonId(seasonList[0].id);
      setLoading(false);
    }
    load();
  }, [userId, supabase]);

  // Load existing preferences for selected season
  useEffect(() => {
    if (!userId || !selectedSeasonId) return;
    async function loadPrefs() {
      const { data } = await supabase
        .from('user_training_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('season_id', selectedSeasonId)
        .maybeSingle();

      if (data) {
        setPrefId(data.id);
        setWeeklyAvailability((data.weekly_availability as WeeklyAvailability) || {});
        setPreferredLevel(data.preferred_level || '');
        setPreferredAgeGroup(data.preferred_age_group || '');
        setSelfAssessedLevel(data.self_assessed_level || '');
        setSpecialRequests(data.special_requests || '');
        setIsSubmitted(data.is_submitted || false);
      } else {
        setPrefId(null);
        setWeeklyAvailability({});
        setPreferredLevel('');
        setPreferredAgeGroup('');
        setSelfAssessedLevel('');
        setSpecialRequests('');
        setIsSubmitted(false);
      }
    }
    loadPrefs();
  }, [userId, selectedSeasonId, supabase]);

  const toggleTimeSlot = useCallback((day: string, start: string, end: string) => {
    setWeeklyAvailability((prev) => {
      const daySlots = [...(prev[day] || [])];
      const exists = daySlots.some((s) => s.start === start && s.end === end);
      if (exists) {
        return { ...prev, [day]: daySlots.filter((s) => !(s.start === start && s.end === end)) };
      }
      return { ...prev, [day]: [...daySlots, { start, end }] };
    });
  }, []);

  const handleSave = async () => {
    if (!userId || !selectedSeasonId) return;
    setSaving(true);
    setError(null);
    try {
      const { data: memberships } = await supabase
        .from('user_club_memberships')
        .select('club_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1);

      const clubId = memberships?.[0]?.club_id;
      if (!clubId) throw new Error('Club-ID nicht gefunden');

      const payload = {
        season_id: selectedSeasonId,
        user_id: userId,
        club_id: clubId,
        user_role: 'member',
        weekly_availability: weeklyAvailability,
        preferred_level: preferredLevel || null,
        preferred_age_group: preferredAgeGroup || null,
        self_assessed_level: selfAssessedLevel || null,
        special_requests: specialRequests || null,
        is_submitted: false,
        last_modified_at: new Date().toISOString(),
      };

      if (prefId) {
        await supabase.from('user_training_preferences').update(payload).eq('id', prefId);
      } else {
        const { data } = await supabase
          .from('user_training_preferences')
          .insert(payload)
          .select('id')
          .single();
        if (data) setPrefId(data.id);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!prefId) return;
    setSubmitting(true);
    setError(null);
    try {
      await supabase
        .from('user_training_preferences')
        .update({
          is_submitted: true,
          submitted_at: new Date().toISOString(),
          last_modified_at: new Date().toISOString(),
        })
        .eq('id', prefId);
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Einreichen');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-8 px-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
        <p className="mt-2 text-sm text-muted-foreground">
          Bitte melde dich an, um deine Präferenzen einzustellen.
        </p>
      </div>
    );
  }

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);
  const preferencesOpen = selectedSeason?.preferences_open ?? false;

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Meine Trainingspräferenzen
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Teile dem Verein mit, wann und mit wem du trainieren möchtest
          </p>
        </div>
        {isSubmitted && (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" /> Eingereicht
          </Badge>
        )}
      </div>

      {/* Season Selector */}
      {seasons.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedSeasonId}
                onValueChange={(value) => setSelectedSeasonId(value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Saison auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.preferences_open ? '(Präferenzen offen)' : '(Geschlossen)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {!preferencesOpen && selectedSeasonId && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Präferenzabgabe geschlossen</p>
              <p className="text-xs text-amber-600">
                Der Administrator hat die Präferenzabgabe für diese Saison geschlossen. Du kannst
                deine Einstellungen trotzdem speichern.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Availability */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand-primary" />
            Wöchentliche Verfügbarkeit
          </CardTitle>
          <CardDescription>
            Wähle die Zeiten aus, an denen du trainieren kannst (Mehrfachauswahl pro Tag)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DAYS.map(({ key, label }) => {
              const slots = weeklyAvailability[key] || [];
              return (
                <div key={key} className="flex items-start gap-3">
                  <span className="w-24 text-sm font-medium text-gray-700 pt-1 flex-shrink-0">
                    {label}
                  </span>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {['08:00', '09:30', '11:00', '13:00', '14:30', '16:00', '17:30', '19:00'].map(
                      (start) => {
                        const [h, m] = start.split(':').map(Number);
                        const end = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        const active = slots.some((s) => s.start === start && s.end === end);
                        return (
                          <button
                            key={start}
                            onClick={() => toggleTimeSlot(key, start, end)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                              active
                                ? 'bg-brand-primary text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {start}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Level & Group Preferences */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-brand-primary" />
              Bevorzugtes Niveau
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setPreferredLevel(preferredLevel === level ? '' : level)}
                  className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    preferredLevel === level
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4 text-brand-primary" />
              Eigene Einschätzung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setSelfAssessedLevel(selfAssessedLevel === level ? '' : level)}
                  className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    selfAssessedLevel === level
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Special Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-brand-primary" />
            Besondere Wünsche / Anmerkungen
          </CardTitle>
          <CardDescription>
            {
              'z.B. "Ich möchte mit Person X in einer Gruppe sein" oder "Ich kann nur vormittags wegen Arbeit"'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            placeholder="Deine Wünsche oder Anmerkungen..."
            className="w-full min-h-[100px] rounded-lg border border-gray-200 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </CardContent>
      </Card>

      {/* Actions */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3">
            <p className="text-sm text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {error}
            </p>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-3">
            <p className="text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Gespeichert!
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || isSubmitted}
          variant="outline"
          className="gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Speichern
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || isSubmitted || !prefId}
          variant="brand"
          className="gap-2"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Einreichen
        </Button>
      </div>
    </div>
  );
}
