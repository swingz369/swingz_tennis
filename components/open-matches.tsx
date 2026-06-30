'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Users,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Loader2,
  Trophy,
  UserPlus,
  UserMinus,
  X,
  Sparkles,
  Shield,
  Swords,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from '@/lib/locale';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { Badge } from '@/components/ui/badge';

interface OpenMatch {
  id: string;
  title: string;
  description: string | null;
  match_date: string;
  start_time: string;
  end_time: string;
  skill_level: string;
  match_type: string;
  max_players: number;
  current_players: number;
  status: string;
  creator_id: string;
  creatorName: string;
  courtName: string | null;
  participantNames: string[];
  joinedByUser: boolean;
  created_at: string;
}

interface Props {
  clubId: string;
  userId?: string;
}

const SKILL_LEVELS = [
  { value: 'all', label: 'Alle Level' },
  { value: 'beginner', label: 'Anfänger' },
  { value: 'intermediate', label: 'Mittelstufe' },
  { value: 'advanced', label: 'Fortgeschritten' },
  { value: 'tournament', label: 'Turnierspieler' },
];

const MATCH_TYPES = [
  { value: 'singles', label: 'Einzel' },
  { value: 'doubles', label: 'Doppel' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'social', label: 'Social Play' },
];

function getSkillBadge(level: string) {
  const map: Record<string, { label: string; className: string }> = {
    beginner: {
      label: 'Anfänger',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    },
    intermediate: {
      label: 'Mittel',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    },
    advanced: {
      label: 'Fortg.',
      className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    },
    tournament: {
      label: 'Turnier',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    },
    all: { label: 'Alle', className: 'bg-muted text-muted-foreground' },
  };
  return map[level] ?? map.all;
}

export default function OpenMatches({ clubId, userId }: Props) {
  const [matches, setMatches] = useState<OpenMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [challengingId, setChallengingId] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    matchDate: '',
    startTime: '',
    endTime: '',
    skillLevel: 'all',
    matchType: 'singles',
    maxPlayers: '2',
  });

  const loadMatches = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/open-matches?clubId=${clubId}&status=open`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      setMatches(data.matches ?? []);
    } catch {
      toast.error('Spiele konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.matchDate || !form.startTime || !form.endTime) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    setCreating(true);
    try {
      const res = await apiFetch('/api/open-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clubId,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          matchDate: form.matchDate,
          startTime: form.startTime,
          endTime: form.endTime,
          skillLevel: form.skillLevel,
          matchType: form.matchType,
          maxPlayers: parseInt(form.maxPlayers, 10),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erstellung fehlgeschlagen');
      }
      toast.success('Spiel erstellt!');
      setCreateOpen(false);
      setForm({
        title: '',
        description: '',
        matchDate: '',
        startTime: '',
        endTime: '',
        skillLevel: 'all',
        matchType: 'singles',
        maxPlayers: '2',
      });
      loadMatches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (matchId: string) => {
    setJoiningId(matchId);
    try {
      const res = await apiFetch('/api/open-matches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ matchId, action: 'join' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Beitritt fehlgeschlagen');
      }
      toast.success('Du bist beigetreten!');
      loadMatches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = async (matchId: string) => {
    setJoiningId(matchId);
    try {
      const res = await apiFetch('/api/open-matches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ matchId, action: 'leave' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Austritt fehlgeschlagen');
      }
      toast.success('Du hast das Spiel verlassen');
      loadMatches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setJoiningId(null);
    }
  };

  const handleCancel = async (matchId: string) => {
    setCancellingId(matchId);
    try {
      const res = await apiFetch(`/api/open-matches?id=${matchId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Stornierung fehlgeschlagen');
      }
      toast.success('Spiel abgesagt');
      await loadMatches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setCancellingId(null);
    }
  };

  const handleChallenge = async (match: OpenMatch) => {
    setChallengingId(match.id);
    try {
      const res = await apiFetch('/api/open-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clubId,
          title: `Match gegen ${match.creatorName}`,
          matchDate: match.match_date,
          startTime: match.start_time.substring(0, 5),
          endTime: match.end_time.substring(0, 5),
          skillLevel: match.skill_level,
          matchType: 'singles',
          maxPlayers: 2,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erstellung fehlgeschlagen');
      }
      toast.success(`Herausforderung an ${match.creatorName} gesendet!`);
      loadMatches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setChallengingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-brand-primary" />
            Offene Spiele
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Finde Mitspieler oder erstelle ein offenes Spiel
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Spiel erstellen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand-light" />
                Neues offenes Spiel
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="title">Titel *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="z.B. Doppel am Samstag"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="matchDate">Datum *</Label>
                  <Input
                    id="matchDate"
                    type="date"
                    value={form.matchDate}
                    onChange={(e) => setForm((f) => ({ ...f, matchDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label htmlFor="maxPlayers">Spieler</Label>
                  <Select
                    value={form.maxPlayers}
                    onValueChange={(v) => setForm((f) => ({ ...f, maxPlayers: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 6, 8, 10, 12].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} Spieler
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="endTime">Ende *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Spielstärke</Label>
                  <Select
                    value={form.skillLevel}
                    onValueChange={(v) => setForm((f) => ({ ...f, skillLevel: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SKILL_LEVELS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Spieltyp</Label>
                  <Select
                    value={form.matchType}
                    onValueChange={(v) => setForm((f) => ({ ...f, matchType: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MATCH_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="z.B. Suchen noch 2 Spieler für ein lockeres Doppel"
                  rows={2}
                />
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Spiel erstellen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Match list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : matches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">Keine offenen Spiele gefunden</p>
            <p className="text-sm text-muted-foreground/70">
              Erstelle ein offenes Spiel und finde Mitspieler!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => {
            const skill = getSkillBadge(match.skill_level);
            const isFull = match.current_players >= match.max_players;
            const matchDate = new Date(`${match.match_date}T${match.start_time}`);
            const isPast = matchDate < new Date();

            return (
              <Card
                key={match.id}
                className={`group transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                  match.joinedByUser ? 'border-brand-primary/40 bg-brand-primary/5' : ''
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{match.title}</CardTitle>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className={`text-xs ${skill.className}`}>
                        {skill.label}
                      </Badge>
                      {match.joinedByUser && (
                        <Badge className="text-xs bg-brand-primary">Dabei</Badge>
                      )}
                    </div>
                  </div>
                  {match.description && (
                    <CardDescription className="line-clamp-2 text-xs">
                      {match.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{format(matchDate, 'EEE, d. MMM', { locale: de })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {match.start_time.substring(0, 5)} – {match.end_time.substring(0, 5)}
                      </span>
                    </div>
                    {match.courtName && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">{match.courtName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Trophy className="h-3.5 w-3.5" />
                      <span>
                        {MATCH_TYPES.find((t) => t.value === match.match_type)?.label ??
                          match.match_type}
                      </span>
                    </div>
                  </div>

                  {/* Players */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Spieler</span>
                      <span className={`font-medium ${isFull ? 'text-green-600' : ''}`}>
                        {match.current_players}/{match.max_players}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isFull ? 'bg-green-500' : 'bg-brand-primary'
                        }`}
                        style={{ width: `${(match.current_players / match.max_players) * 100}%` }}
                      />
                    </div>
                    {match.participantNames.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {match.participantNames.map((name, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted"
                          >
                            <Shield className="h-3 w-3" />
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    {match.joinedByUser ? (
                      <>
                        {match.creator_id === userId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleCancel(match.id)}
                            disabled={cancellingId === match.id}
                          >
                            {cancellingId === match.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                            Absagen
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5"
                            onClick={() => handleLeave(match.id)}
                            disabled={joiningId === match.id}
                          >
                            {joiningId === match.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserMinus className="h-3.5 w-3.5" />
                            )}
                            Austritt
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5"
                          onClick={() => handleJoin(match.id)}
                          disabled={isFull || isPast || joiningId === match.id}
                        >
                          {joiningId === match.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserPlus className="h-3.5 w-3.5" />
                          )}
                          {isFull ? 'Ausgebucht' : isPast ? 'Vorbei' : 'Beitreten'}
                        </Button>
                        {userId && match.creator_id !== userId && !isPast && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleChallenge(match)}
                            disabled={challengingId === match.id}
                          >
                            {challengingId === match.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Swords className="h-3.5 w-3.5" />
                            )}
                            Fordern
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
