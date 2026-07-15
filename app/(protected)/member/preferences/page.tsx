'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Target,
  MessageSquare,
  Save,
  Send,
  CheckCircle,
  AlertTriangle,
  Plus,
  X,
  Users,
  Loader2,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const MAX_TIME_PREFS = 4;
const MAX_WISH_PARTNERS = 3;

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

const LEVELS = [
  { key: 'beginner', label: 'Anfänger' },
  { key: 'intermediate', label: 'Mittel' },
  { key: 'advanced', label: 'Fortgeschritten' },
  { key: 'professional', label: 'Profi' },
] as const;

type TimePref = { day: string; start: string };
type WeeklyAvailability = Record<string, { start: string; end: string }[]>;
type Member = { id: string; name: string };

function prefsToAvailability(prefs: TimePref[]): WeeklyAvailability {
  const result: WeeklyAvailability = {};
  for (const { day, start } of prefs) {
    if (!day || !start) continue;
    const end = `${String(parseInt(start) + 1).padStart(2, '0')}:00`;
    if (!result[day]) result[day] = [];
    if (!result[day].some((s) => s.start === start)) result[day].push({ start, end });
  }
  return result;
}

function availabilityToPrefs(avail: WeeklyAvailability): TimePref[] {
  const prefs: TimePref[] = [];
  for (const [day, slots] of Object.entries(avail || {}))
    for (const { start } of slots) prefs.push({ day, start });
  return prefs.slice(0, MAX_TIME_PREFS);
}

export default function MemberPreferencesPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const userId = user?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seasons, setSeasons] = useState<
    Array<{ id: string; name: string; preferences_open: boolean }>
  >([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [clubId, setClubId] = useState('');
  const [currentAgeGroup, setCurrentAgeGroup] = useState('senior');

  const [timePrefs, setTimePrefs] = useState<TimePref[]>([]);
  const [level, setLevel] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [wishPartnerIds, setWishPartnerIds] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [prefId, setPrefId] = useState<string | null>(null);

  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  // Load club + season
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('user_club_memberships')
      .select('club_id, age_group')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('role', 'member')
      .limit(1)
      .then(({ data: m }) => {
        if (!m?.length) {
          setLoading(false);
          return;
        }
        const cid = m[0].club_id;
        setClubId(cid);
        setCurrentAgeGroup(m[0].age_group || 'senior');
        supabase
          .from('seasons')
          .select('id, name, preferences_open')
          .eq('club_id', cid)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(5)
          .then(({ data }) => {
            setSeasons(data || []);
            if (data?.length) setSelectedSeasonId(data[0].id);
            setLoading(false);
          });
      });
  }, [userId, supabase]);

  // Load eligible wish-partner members (same club, same age group, not self)
  useEffect(() => {
    if (!clubId || !userId) return;
    supabase
      .from('user_club_memberships')
      .select('user_id, age_group, users(full_name)')
      .eq('club_id', clubId)
      .eq('role', 'member')
      .eq('is_active', true)
      .eq('age_group', currentAgeGroup)
      .neq('user_id', userId)
      .then(({ data }) => {
        if (!data) return;
        setAllMembers(
          data
            .map((d) => ({
              id: d.user_id,
              name:
                (Array.isArray(d.users)
                  ? (d.users as { full_name: string }[])[0]?.full_name
                  : (d.users as { full_name: string } | null)?.full_name) || 'Unbekannt',
            }))
            .filter((m) => m.name !== 'Unbekannt')
            .sort((a, b) => a.name.localeCompare(b.name, 'de'))
        );
      });
  }, [clubId, userId, currentAgeGroup, supabase]);

  // Load existing preferences
  useEffect(() => {
    if (!userId || !selectedSeasonId) return;
    supabase
      .from('user_training_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('season_id', selectedSeasonId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrefId(data.id);
          setTimePrefs(availabilityToPrefs(data.weekly_availability as WeeklyAvailability));
          setLevel(data.self_assessed_level || data.preferred_level || '');
          setSpecialRequests(data.special_requests || '');
          setWishPartnerIds((data.wish_partner_ids as string[]) || []);
          setIsSubmitted(data.is_submitted || false);
        } else {
          setPrefId(null);
          setTimePrefs([]);
          setLevel('');
          setSpecialRequests('');
          setWishPartnerIds([]);
          setIsSubmitted(false);
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

  const toggleWishPartner = useCallback((id: string) => {
    setWishPartnerIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_WISH_PARTNERS) return prev;
      return [...prev, id];
    });
  }, []);

  const buildPayload = useCallback(async () => {
    if (!clubId) {
      const { data: m } = await supabase
        .from('user_club_memberships')
        .select('club_id')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .limit(1);
      return m?.[0]?.club_id;
    }
    return clubId;
  }, [clubId, supabase, userId]);

  const handleSave = async () => {
    if (!userId || !selectedSeasonId) return;
    setSaving(true);
    setError(null);
    try {
      const cid = await buildPayload();
      if (!cid) throw new Error('Club nicht gefunden');

      const payload = {
        season_id: selectedSeasonId,
        user_id: userId,
        club_id: cid,
        user_role: 'member',
        weekly_availability: prefsToAvailability(timePrefs),
        preferred_level: level || null,
        self_assessed_level: level || null,
        preferred_age_group: currentAgeGroup,
        special_requests: specialRequests || null,
        wish_partner_ids: wishPartnerIds,
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
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Auto-save first if no prefId yet
      if (!prefId) await handleSave();
      await supabase
        .from('user_training_preferences')
        .update({ is_submitted: true, submitted_at: new Date().toISOString() })
        .eq('id', prefId!);
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Einreichen');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 py-8 px-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);
  const preferencesOpen = selectedSeason?.preferences_open ?? false;
  const filledPrefs = timePrefs.filter((p) => p.day && p.start);
  const filteredMembers = allMembers.filter((m) =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5 py-8 px-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trainings&shy;präferenzen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Wann möchtest du trainieren? Mit wem? — wird für die Gruppenplanung genutzt.
          </p>
        </div>
        {isSubmitted && (
          <Badge className="bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 border-success-200 dark:border-success-800 mt-1 flex-shrink-0">
            <CheckCircle className="h-3 w-3 mr-1" /> Eingereicht
          </Badge>
        )}
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
                  {s.name}{' '}
                  <span className="text-muted-foreground text-xs">
                    {s.preferences_open ? '· offen' : '· geschlossen'}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!preferencesOpen && selectedSeasonId && (
        <div className="flex items-center gap-2 rounded-xl border border-warning-200 dark:border-warning-800 bg-warning-50/60 dark:bg-warning-900/20 px-3 py-2 text-sm text-warning-700 dark:text-warning-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Präferenzabgabe für diese Saison geschlossen — Speichern bleibt möglich.
        </div>
      )}

      {/* 1 — Time preferences */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-primary" />
              Wann kannst du trainieren?
            </CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {filledPrefs.length} / {MAX_TIME_PREFS}
            </span>
          </div>
          <CardDescription>
            Bis zu {MAX_TIME_PREFS} Wunschzeiten — je mehr, desto besser die Einplanung.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {timePrefs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Noch keine Wunschzeit angegeben.
            </p>
          )}

          {timePrefs.map((pref, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-2.5"
            >
              <span className="text-xs font-semibold text-muted-foreground w-5 text-center shrink-0">
                {idx + 1}
              </span>
              <Select
                value={pref.day}
                onValueChange={(v) => updateTimePref(idx, 'day', v)}
                disabled={isSubmitted}
              >
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
              <Select
                value={pref.start}
                onValueChange={(v) => updateTimePref(idx, 'start', v)}
                disabled={isSubmitted}
              >
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
                disabled={isSubmitted}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {timePrefs.length < MAX_TIME_PREFS && !isSubmitted && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 mt-1"
              onClick={addTimePref}
            >
              <Plus className="h-4 w-4" />
              Wunschzeit hinzufügen ({MAX_TIME_PREFS - timePrefs.length} verbleibend)
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 2 — Level */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-primary" />
            Mein Spielniveau
          </CardTitle>
          <CardDescription>
            Deine Selbsteinschätzung — Grundlage für die Gruppenzuteilung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => !isSubmitted && setLevel(level === key ? '' : key)}
                disabled={isSubmitted}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                  level === key
                    ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                    : 'border-border bg-background text-foreground hover:bg-muted'
                } disabled:opacity-50`}
              >
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 3 — Wish partners */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-primary" />
              Mit wem möchtest du trainieren?
            </CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {wishPartnerIds.length} / {MAX_WISH_PARTNERS}
            </span>
          </div>
          <CardDescription>
            Optional — bis zu {MAX_WISH_PARTNERS} Wunschpartner aus deiner Altersgruppe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Selected partners */}
          {wishPartnerIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {wishPartnerIds.map((id) => {
                const m = allMembers.find((x) => x.id === id);
                return (
                  <Badge key={id} variant="secondary" className="gap-1 pl-3 pr-1 py-1">
                    {m?.name ?? id}
                    {!isSubmitted && (
                      <button
                        onClick={() => toggleWishPartner(id)}
                        className="ml-1 rounded-md hover:text-error-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Search + list */}
          {!isSubmitted && wishPartnerIds.length < MAX_WISH_PARTNERS && allMembers.length > 0 && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Mitglied suchen..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                {filteredMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Keine Mitglieder gefunden
                  </p>
                ) : (
                  filteredMembers.map((m) => {
                    const selected = wishPartnerIds.includes(m.id);
                    const maxReached = wishPartnerIds.length >= MAX_WISH_PARTNERS;
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleWishPartner(m.id)}
                        disabled={!selected && maxReached}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
                          selected
                            ? 'bg-brand-primary/10 text-brand-primary font-medium'
                            : maxReached
                              ? 'opacity-40 cursor-not-allowed'
                              : 'hover:bg-muted'
                        }`}
                      >
                        <span>{m.name}</span>
                        {selected && <CheckCircle className="h-4 w-4 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {allMembers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Keine weiteren Mitglieder in deiner Altersgruppe gefunden.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 4 — Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-brand-primary" />
            Anmerkungen
          </CardTitle>
          <CardDescription>
            z.B. &quot;Nur nachmittags wegen Arbeit&quot; oder &quot;Verletzung beachten&quot;
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            disabled={isSubmitted}
            placeholder="Optionale Hinweise an den Trainer / Admin..."
            className="w-full min-h-[80px] rounded-xl border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
          />
        </CardContent>
      </Card>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/20 px-3 py-2 text-sm text-error-600 dark:text-error-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {savedOk && (
        <div className="flex items-center gap-2 rounded-xl border border-success-200 dark:border-success-800 bg-success-50 dark:bg-success-900/20 px-3 py-2 text-sm text-success-700 dark:text-success-300">
          <CheckCircle className="h-4 w-4 shrink-0" /> Gespeichert
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleSave}
          disabled={saving || isSubmitted}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Speichern
        </Button>
        <Button
          variant="primary"
          className="gap-2"
          onClick={handleSubmit}
          disabled={submitting || isSubmitted || filledPrefs.length === 0}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isSubmitted ? 'Eingereicht ✓' : 'Einreichen'}
        </Button>
      </div>
    </div>
  );
}
