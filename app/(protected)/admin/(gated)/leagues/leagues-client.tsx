'use client';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { extractErrorMessage } from '@/lib/typed-helpers';

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
  Trash2,
  Search,
  Loader2,
  CheckCircle2,
  Link2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface NuligaTeam {
  teamName: string;
  leagueName: string | null;
  championship: string | null;
  seasonYear: number | null;
  portraitUrl: string | null;
  groupUrl: string | null;
  alreadyImported?: boolean;
}

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
    own_team_name: '',
  });

  // ── nuLiga-Mannschaftsübernahme ──
  // Ersetzt das Abtippen von Gruppen-URLs und Mannschaftsnamen: einmal die
  // Vereinsseite hinterlegen, danach kommen alle Mannschaften mit Liga,
  // Spielplan und Meldeliste aus der Quelle.
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [clubUrl, setClubUrl] = useState('');
  const [clubSearch, setClubSearch] = useState('');
  const [clubHits, setClubHits] = useState<
    Array<{ name: string; city: string | null; clubNumber: string; teamsUrl: string }>
  >([]);
  const [discovered, setDiscovered] = useState<NuligaTeam[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const discover = useCallback(async (url?: string) => {
    setDiscovering(true);
    setClubHits([]);
    try {
      const res = await apiFetch('/api/admin/nuliga/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(url ? { url } : {}),
      });
      const data = await res.json().catch(() => ({}));
      // 400 ohne hinterlegte Vereinsseite ist kein Fehler, sondern der
      // Normalfall beim ersten Mal — dann zeigt das Panel die Suchmaske,
      // statt einen roten Toast zu werfen.
      if (res.status === 400 && !url) {
        setDiscovered(null);
        return;
      }
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Abruf fehlgeschlagen');
      setDiscovered(data.teams ?? []);
      // Vorauswahl: alles, was noch nicht angelegt ist — der Regelfall ist
      // „alle eigenen Mannschaften übernehmen".
      // Auswahlschlüssel: Portrait, sonst Gruppenseite. Zeilen ohne Portrait
      // (z. B. Spielgemeinschaften) waren sonst dauerhaft nicht anklickbar.
      setPicked(
        new Set(
          (data.teams ?? [])
            .filter((t: NuligaTeam) => (t.portraitUrl ?? t.groupUrl) && !t.alreadyImported)
            .map((t: NuligaTeam) => (t.portraitUrl ?? t.groupUrl) as string)
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Abruf fehlgeschlagen');
    } finally {
      setDiscovering(false);
    }
  }, []);

  const searchClub = useCallback(async () => {
    if (!clubSearch.trim()) return;
    setDiscovering(true);
    setDiscovered(null);
    try {
      const res = await apiFetch('/api/admin/nuliga/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search: clubSearch.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Suche fehlgeschlagen');
      setClubHits(data.clubs ?? []);
      if ((data.clubs ?? []).length === 0) toast.info('Kein Verein gefunden');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Suche fehlgeschlagen');
    } finally {
      setDiscovering(false);
    }
  }, [clubSearch]);

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

  const importPicked = useCallback(async () => {
    if (picked.size === 0) return;
    setImporting(true);
    try {
      const res = await apiFetch('/api/leagues/import-nuliga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portraitUrls: Array.from(picked) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Übernahme fehlgeschlagen');
      toast.success(
        `${data.created} Mannschaft(en) übernommen${data.skipped ? `, ${data.skipped} bereits vorhanden` : ''}`
      );
      setDiscoverOpen(false);
      setDiscovered(null);
      setPicked(new Set());
      fetchLeagues();

      // Erst-Sync sofort: Sonst bleiben die Ligen bis zum nächsten Cron leer und
      // der Import wirkt wie "geht nicht". Nacheinander (nicht parallel), damit
      // nuLiga höflich abgefragt wird und kein Function-Timeout droht.
      const created: { id: string }[] = data.leagues ?? [];
      let failed = 0;
      for (const [i, l] of created.entries()) {
        toast.loading(`Erste Synchronisierung ${i + 1}/${created.length}`, {
          id: 'nuliga-first-sync',
        });
        const syncRes = await apiFetch(`/api/leagues/${l.id}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }).catch(() => null);
        if (!syncRes?.ok) failed++;
      }
      if (created.length > 0) {
        toast.dismiss('nuliga-first-sync');
        if (failed > 0) {
          toast.error(
            `${failed} Mannschaft(en) konnten nicht synchronisiert werden — später erneut versuchen`
          );
        } else {
          toast.success('Spielplan, Tabelle und Kader sind übernommen');
        }
        fetchLeagues();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Übernahme fehlgeschlagen');
    } finally {
      setImporting(false);
    }
  }, [picked, fetchLeagues]);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  const [confirm, confirmDialog] = useConfirmDialog();

  const handleDelete = async (league: League) => {
    const teamHint = league.teams.length > 0 ? ` samt ${league.teams.length} Team(s)` : '';
    const ok = await confirm({
      title: 'Liga löschen',
      description: `Liga "${league.name}"${teamHint} und allen Spieltagen wirklich löschen? Das lässt sich nicht rückgängig machen.`,
      confirmLabel: 'Löschen',
    });
    if (!ok) return;
    try {
      const res = await apiFetch(`/api/leagues/${league.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Löschen fehlgeschlagen');
      toast.success('Liga gelöscht');
      fetchLeagues();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Löschen');
    }
  };

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
        own_team_name: '',
      });
      fetchLeagues();
    } catch {
      toast.error('Fehler beim Erstellen');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">Laden</div>
    );
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ligen & Mannschaften</h2>
          <p className="text-xs text-muted-foreground">{leagues.length} Liga(s) verwaltet</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDiscoverOpen(true);
              if (!discovered) discover();
            }}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" /> Aus nuLiga holen
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Neue Liga
          </Button>
        </div>
      </div>

      {/* ── nuLiga-Übernahme ──
          Der Admin wählt Mannschaften aus, statt URLs zu kopieren. Name, Liga,
          Saison, Spielplan und Meldeliste kommen aus der Vereinsseite. */}
      {discoverOpen && (
        <Card>
          <CardHeader className="border-b border-border dark:border-white/10">
            <CardTitle className="text-base flex items-center gap-2">
              <Flag className="h-4 w-4" /> Mannschaften aus nuLiga übernehmen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {discovering ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> nuLiga wird abgefragt…
              </div>
            ) : discovered ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {discovered.length} Mannschaft(en) gefunden — Auswahl übernehmen. Für die
                    ausgewählten Mannschaften werden Spielplan, Tabelle und die eigene Meldeliste
                    automatisch verknüpft.
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-xs"
                    onClick={() => {
                      setDiscovered(null);
                      setClubHits([]);
                    }}
                  >
                    Anderer Verein
                  </Button>
                </div>

                <div className="max-h-80 overflow-y-auto rounded-xl border border-border divide-y divide-border/60">
                  {discovered.map((team) => {
                    const url = team.portraitUrl ?? team.groupUrl;
                    const disabled = !url || team.alreadyImported;
                    return (
                      <label
                        key={`${team.teamName}-${team.leagueName ?? ''}`}
                        className={`flex items-center gap-3 px-3 py-2 text-sm ${
                          disabled ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0"
                          disabled={disabled}
                          checked={!!url && picked.has(url)}
                          onChange={(e) => {
                            if (!url) return;
                            setPicked((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(url);
                              else next.delete(url);
                              return next;
                            });
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{team.teamName}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {team.leagueName ?? 'Liga unbekannt'}
                            {team.championship ? ` · ${team.championship}` : ''}
                          </span>
                        </span>
                        {team.alreadyImported && (
                          <Badge variant="secondary" className="shrink-0 gap-1 text-2xs">
                            <CheckCircle2 className="h-3 w-3" /> vorhanden
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDiscoverOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button
                    size="sm"
                    onClick={importPicked}
                    disabled={picked.size === 0 || importing}
                  >
                    {importing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {picked.size} Mannschaft(en) übernehmen
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="nuliga-search" className="text-xs font-medium">
                    Verein bei nuLiga suchen
                  </label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id="nuliga-search"
                      value={clubSearch}
                      onChange={(e) => setClubSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchClub()}
                      placeholder="z.B. TC Rheinland"
                    />
                    <Button size="sm" variant="outline" onClick={searchClub} className="shrink-0">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {clubHits.length > 0 && (
                  <div className="rounded-xl border border-border divide-y divide-border/60">
                    {clubHits.map((hit) => (
                      <button
                        key={hit.clubNumber}
                        onClick={() => discover(hit.teamsUrl)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                      >
                        <span className="min-w-0 flex-1 truncate">{hit.name}</span>
                        {hit.city && (
                          <span className="shrink-0 text-xs text-muted-foreground">{hit.city}</span>
                        )}
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <label htmlFor="nuliga-club-url" className="text-xs font-medium">
                    …oder Vereinsseite direkt verlinken
                  </label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id="nuliga-club-url"
                      value={clubUrl}
                      onChange={(e) => setClubUrl(e.target.value)}
                      placeholder="https://xyz.liga.nu/…/clubTeams?club=12345"
                      className="tabular-nums text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => discover(clubUrl.trim() || undefined)}
                      disabled={!clubUrl.trim()}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1 text-2xs text-muted-foreground">
                    Die Vereinsseite wird gespeichert — beim nächsten Mal genügt ein Klick auf „Aus
                    nuLiga holen". Meldelisten mit Spielernamen werden ausschließlich für die
                    Mannschaften dieses Vereins übernommen.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setDiscoverOpen(false)}>
                    Schließen
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

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
              className="hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer group"
              onClick={() => router.push(`/admin/leagues/${league.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base group-hover:text-primary transition-colors">
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
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        league.status === 'active'
                          ? 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-300'
                          : 'bg-muted text-muted-foreground'
                      }
                    >
                      {league.status === 'active' ? 'Aktiv' : 'Abgeschlossen'}
                    </Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Liga ${league.name} löschen`}
                          onClick={(e) => {
                            e.stopPropagation(); // Karte ist klickbar — nicht zur Detailseite springen
                            handleDelete(league);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-error-400" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{`Liga ${league.name} löschen`}</TooltipContent>
                    </Tooltip>
                  </div>
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
                    <span className="flex items-center gap-1 group-hover:text-primary transition-colors">
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
                placeholder="https://xyz.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/teamPortrait?...&team=..."
                className="mt-1 tabular-nums text-xs"
              />
              <p className="text-2xs text-muted-foreground mt-1">
                Am besten die <strong>Mannschaftsseite</strong> („Mannschaftsportrait") eintragen —
                daraus kommen Spieltermine, Kader mit LK und die Tabelle auf einmal. Eine
                Gruppenseite funktioniert auch, dann braucht es zusätzlich den eigenen
                Mannschaftsnamen.
              </p>
            </div>
            <div>
              <label htmlFor="lg-own-team" className="text-xs font-medium">
                Eigene Mannschaft{' '}
                <span className="text-muted-foreground">(nur bei Gruppenseiten-URL)</span>
              </label>
              <Input
                id="lg-own-team"
                value={newLeague.own_team_name}
                onChange={(e) => setNewLeague({ ...newLeague, own_team_name: e.target.value })}
                placeholder="z.B. TC Rheinland II"
                className="mt-1"
              />
              <p className="text-2xs text-muted-foreground mt-1">
                Name exakt wie in der nuLiga-Tabelle. Bei einer Mannschaftsseite überflüssig — die
                Seite nennt die eigene Mannschaft selbst.
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
