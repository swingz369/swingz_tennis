'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Flag,
  Users,
  Plus,
  ChevronRight,
  Target,
  Trophy,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

interface Team {
  id: string;
  name: string;
  points: number;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  position: number | null;
}

interface League {
  id: string;
  name: string;
  season_year: number;
  league_type: string;
  division: string | null;
  sport: string;
  age_group: string | null;
  status: string;
  teams: Team[];
}

const sportLabels: Record<string, string> = {
  tennis: 'Tennis',
  squash: 'Squash',
  badminton: 'Badminton',
};

export default function LeaguesClient() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newLeague, setNewLeague] = useState({
    name: '',
    season_year: new Date().getFullYear(),
    league_type: 'regular',
    division: '',
    sport: 'tennis',
    age_group: '',
    nuliga_url: '',
  });

  const fetchLeagues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/leagues');
      if (res.ok) {
        const data = await res.json();
        setLeagues(data.leagues ?? []);
      }
    } catch {
      toast.error('Fehler beim Laden der Ligen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  const handleCreate = async () => {
    if (!newLeague.name) {
      toast.error('Name erforderlich');
      return;
    }
    try {
      const res = await apiFetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLeague),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Liga erstellt');
      setShowNew(false);
      setNewLeague({
        name: '',
        season_year: new Date().getFullYear(),
        league_type: 'regular',
        division: '',
        sport: 'tennis',
        age_group: '',
        nuliga_url: '',
      });
      fetchLeagues();
    } catch {
      toast.error('Fehler beim Erstellen');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">Laden…</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ligen & Mannschaften</h2>
          <p className="text-xs text-muted-foreground">{leagues.length} Liga(s) verwaltet</p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Neue Liga
        </Button>
      </div>

      {/* League Cards */}
      {leagues.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <Flag className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Noch keine Ligen angelegt</p>
          <p className="text-sm text-muted-foreground mt-1">
            Erstelle deine erste Liga für die Mannschaftsaufstellung.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {leagues.map((league) => (
            <Card
              key={league.id}
              className="hover:shadow-md hover:border-brand-primary/30 transition-all duration-200 cursor-pointer group"
              onClick={() => router.push(`/admin/leagues/${league.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base group-hover:text-brand-primary transition-colors">
                      {league.name}
                    </CardTitle>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {sportLabels[league.sport] ?? league.sport}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {league.season_year}
                      </Badge>
                      {league.division && (
                        <Badge variant="outline" className="text-xs">
                          {league.division}
                        </Badge>
                      )}
                      {league.age_group && (
                        <Badge variant="outline" className="text-xs">
                          {league.age_group}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge
                    className={
                      league.status === 'active'
                        ? 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-300'
                        : 'bg-muted text-muted-foreground'
                    }
                  >
                    {league.status === 'active' ? 'Aktiv' : 'Abgeschlossen'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {league.teams.length === 0 ? (
                  <div className="flex flex-col items-center py-4 text-center">
                    <Trophy className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Noch keine Teams</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {league.teams
                      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
                      .slice(0, 3)
                      .map((team, idx) => (
                        <div
                          key={team.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-muted/60 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-bold w-5 text-center ${
                                idx === 0
                                  ? 'text-warning-500'
                                  : idx === 1
                                    ? 'text-gray-400'
                                    : idx === 2
                                      ? 'text-warning-700'
                                      : 'text-muted-foreground'
                              }`}
                            >
                              {team.position ?? '–'}
                            </span>
                            <span className="text-sm font-medium">{team.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {team.matches_won}S {team.matches_lost}N
                            </span>
                            <span className="font-semibold text-foreground tabular-nums">
                              {team.points} Pkt
                            </span>
                          </div>
                        </div>
                      ))}
                    {league.teams.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        +{league.teams.length - 3} weitere Teams
                      </p>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {league.teams.length} Team(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/leagues/${league.id}/export/verband`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      download
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-background hover:bg-muted hover:text-foreground transition-colors"
                      title="Medenspiel-CSV für Verband herunterladen"
                    >
                      <FileSpreadsheet className="h-3 w-3" />
                      <Download className="h-3 w-3" />
                      <span className="font-medium">CSV</span>
                    </a>
                    <span className="flex items-center gap-1 group-hover:text-brand-primary transition-colors">
                      Details
                      <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New League Form */}
      {showNew && (
        <Card>
          <CardHeader className="border-b border-border dark:border-white/10">
            <CardTitle className="text-base">Neue Liga anlegen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="lg-league-name" className="text-xs font-medium">
                  Liganame *
                </label>
                <Input
                  id="lg-league-name"
                  value={newLeague.name}
                  onChange={(e) => setNewLeague({ ...newLeague, name: e.target.value })}
                  placeholder="z.B. Herren 1 — Bezirksliga"
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="lg-season" className="text-xs font-medium">
                  Saison
                </label>
                <Input
                  id="lg-season"
                  type="number"
                  value={newLeague.season_year}
                  onChange={(e) =>
                    setNewLeague({ ...newLeague, season_year: parseInt(e.target.value) || 2026 })
                  }
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="lg-sport" className="text-xs font-medium">
                  Sportart
                </label>
                <select
                  id="lg-sport"
                  value={newLeague.sport}
                  onChange={(e) => setNewLeague({ ...newLeague, sport: e.target.value })}
                  className="w-full mt-1 p-2 rounded border bg-background text-sm"
                >
                  <option value="tennis">Tennis</option>
                  <option value="squash">Squash</option>
                  <option value="badminton">Badminton</option>
                </select>
              </div>
              <div>
                <label htmlFor="lg-division" className="text-xs font-medium">
                  Division
                </label>
                <Input
                  id="lg-division"
                  value={newLeague.division}
                  onChange={(e) => setNewLeague({ ...newLeague, division: e.target.value })}
                  placeholder="z.B. Bezirksliga"
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="lg-age-group" className="text-xs font-medium">
                  Altersgruppe
                </label>
                <Input
                  id="lg-age-group"
                  value={newLeague.age_group}
                  onChange={(e) => setNewLeague({ ...newLeague, age_group: e.target.value })}
                  placeholder="z.B. Herren, Damen, U14"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label htmlFor="lg-nuliga-url" className="text-xs font-medium">
                nuLiga URL <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="lg-nuliga-url"
                value={newLeague.nuliga_url}
                onChange={(e) => setNewLeague({ ...newLeague, nuliga_url: e.target.value })}
                placeholder="https://htv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/groupPage?championship=...&group=..."
                className="mt-1 font-mono text-xs"
              />
              <p className="text-2xs text-muted-foreground mt-1">
                Verbindet die Liga automatisch mit nuLiga für Tabellen-Sync
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={handleCreate}>
                Liga erstellen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
