'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Users,
  Plus,
  Trash2,
  Calendar,
  Trophy,
  CheckCircle2,
  Edit2,
  UserPlus,
  X,
  ExternalLink,
  Download,
  Upload,
  RefreshCw,
  Link2,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

interface TeamMember {
  id: string;
  team_id: string;
  member_id: string;
  role: string;
  position_number: number | null;
  is_active: boolean;
  name: string;
  dtb_id: string | null;
}

interface Team {
  id: string;
  name: string;
  captain_id: string | null;
  position: number | null;
  points: number;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  matches_drawn: number;
  notes: string | null;
  members: TeamMember[];
}

interface MatchDay {
  id: string;
  matchday_number: number;
  scheduled_date: string | null;
  opponent: string;
  is_home: boolean;
  venue: string | null;
  result: string | null;
  score_home: number | null;
  score_away: number | null;
  status: string;
  notes: string | null;
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
  notes: string | null;
  nuliga_url: string | null;
  last_synced_at: string | null;
  teams: Team[];
  match_days: MatchDay[];
}

const sportLabels: Record<string, string> = {
  tennis: 'Tennis',
  squash: 'Squash',
  badminton: 'Badminton',
};

export default function LeagueDetailClient({
  leagueId,
  members,
}: {
  leagueId: string;
  members: { id: string; name: string; email: string }[];
}) {
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('teams');

  // Team creation
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', notes: '' });

  // Team member assignment
  const [assigningTeamId, setAssigningTeamId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  // Match day creation
  const [showNewMatchDay, setShowNewMatchDay] = useState(false);
  const [newMatchDay, setNewMatchDay] = useState({
    matchday_number: 1,
    scheduled_date: '',
    opponent: '',
    is_home: true,
    venue: '',
    notes: '',
  });

  // nuLiga sync
  const [nuligaUrl, setNuligaUrl] = useState('');
  const [showNuligaConfig, setShowNuligaConfig] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<Record<string, unknown> | null>(null);
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const [syncHistory, setSyncHistory] = useState<Record<string, unknown>[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // CSV Import
  const [showImport, setShowImport] = useState(false);
  const [importCsv, setImportCsv] = useState('');
  const [importing, setImporting] = useState(false);

  // Result recording
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState({ result: 'win', score_home: 0, score_away: 0 });

  const fetchLeague = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}`);
      if (res.ok) {
        const data = await res.json();
        setLeague(data.league);
      }
    } catch {
      toast.error('Fehler beim Laden der Liga');
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchLeague();
  }, [fetchLeague]);

  const handleCreateTeam = async () => {
    if (!newTeam.name) {
      toast.error('Teamname erforderlich');
      return;
    }
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTeam),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Team erstellt');
      setShowNewTeam(false);
      setNewTeam({ name: '', notes: '' });
      fetchLeague();
    } catch {
      toast.error('Fehler beim Erstellen');
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Team wirklich löschen? Alle Zuordnungen gehen verloren.')) return;
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/teams/${teamId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Team gelöscht');
      fetchLeague();
    } catch {
      toast.error('Fehler beim Löschen');
    }
  };

  const handleAddMember = async (teamId: string, memberId: string) => {
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: [memberId] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409) {
          toast.error('Mitglied ist bereits im Team');
          return;
        }
        throw new Error(err.error || 'Failed');
      }
      toast.success('Mitglied hinzugefügt');
      setMemberSearch('');
      fetchLeague();
    } catch {
      toast.error('Fehler beim Hinzufügen');
    }
  };

  const handleRemoveMember = async (teamId: string, memberId: string) => {
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/teams/${teamId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Mitglied entfernt');
      fetchLeague();
    } catch {
      toast.error('Fehler beim Entfernen');
    }
  };

  const handleCreateMatchDay = async () => {
    if (!newMatchDay.opponent) {
      toast.error('Gegner erforderlich');
      return;
    }
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/matchdays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMatchDay),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Spieltag erstellt');
      setShowNewMatchDay(false);
      setNewMatchDay({
        matchday_number: (newMatchDay.matchday_number ?? 0) + 1,
        scheduled_date: '',
        opponent: '',
        is_home: true,
        venue: '',
        notes: '',
      });
      fetchLeague();
    } catch {
      toast.error('Fehler beim Erstellen');
    }
  };

  const handleRecordResult = async (matchdayId: string) => {
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/matchdays/${matchdayId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: resultForm.result,
          score_home: resultForm.score_home,
          score_away: resultForm.score_away,
          status: 'completed',
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Ergebnis eingetragen');
      setEditingResultId(null);
      fetchLeague();
    } catch {
      toast.error('Fehler beim Eintragen');
    }
  };

  const handleDeleteMatchDay = async (matchdayId: string) => {
    if (!confirm('Spieltag wirklich löschen?')) return;
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/matchdays/${matchdayId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Spieltag gelöscht');
      fetchLeague();
    } catch {
      toast.error('Fehler beim Löschen');
    }
  };

  // nuLiga sync
  useEffect(() => {
    if (league?.nuliga_url) setNuligaUrl(league.nuliga_url);
  }, [league?.nuliga_url]);

  const handleNuligaSync = async () => {
    if (!nuligaUrl.trim()) {
      toast.error('Bitte nuLiga-URL eingeben');
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuliga_url: nuligaUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync fehlgeschlagen');

      setSyncResult(data);
      const parts: string[] = [];
      if (data.teamsCreated > 0) parts.push(`${data.teamsCreated} Teams erstellt`);
      if (data.teamsUpdated > 0) parts.push(`${data.teamsUpdated} Teams aktualisiert`);
      if (data.matchesCreated > 0) parts.push(`${data.matchesCreated} Spieltage erstellt`);
      if (data.matchesUpdated > 0) parts.push(`${data.matchesUpdated} Spieltage aktualisiert`);
      toast.success(`Sync erfolgreich: ${parts.join(', ') || 'Alles aktuell'}`);
      fetchLeague();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Sync');
    } finally {
      setSyncing(false);
    }
  };

  const loadSyncHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/sync-history?limit=15`);
      const data = await res.json();
      setSyncHistory(data.logs ?? []);
    } catch {
      toast.error('Fehler beim Laden der Sync-Historie');
    } finally {
      setLoadingHistory(false);
    }
  }, [leagueId]);

  const handleExportCsv = async () => {
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/export`);
      if (!res.ok) throw new Error('Export fehlgeschlagen');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liga-${league?.name?.replace(/[^a-zA-Z0-9]/g, '_') ?? 'export'}-${league?.season_year ?? ''}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('CSV exportiert');
    } catch {
      toast.error('Fehler beim CSV-Export');
    }
  };

  const handleImportCsv = async () => {
    if (!importCsv.trim()) {
      toast.error('CSV-Daten fehlen');
      return;
    }
    setImporting(true);
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: importCsv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import fehlgeschlagen');

      const parts = [] as string[];
      if (data.created > 0) parts.push(`${data.created} neue Spieltage`);
      if (data.updated > 0) parts.push(`${data.updated} aktualisiert`);
      toast.success(`Import erfolgreich: ${parts.join(', ') || 'Keine Änderungen'}`);
      if (data.errors?.length) {
        toast.warning(`${data.errors.length} Zeile(n) mit Fehlern`);
      }
      setShowImport(false);
      setImportCsv('');
      fetchLeague();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Import');
    } finally {
      setImporting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(newStatus === 'active' ? 'Liga aktiviert' : 'Liga abgeschlossen');
      fetchLeague();
    } catch {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">Laden…</div>
    );
  }

  if (!league) {
    return <div className="p-6 text-muted-foreground">Liga nicht gefunden</div>;
  }

  const filteredMembers = memberSearch.trim()
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
          m.email.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Link href="/admin/leagues" className="mt-1">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-primary">{league.name}</h1>
            <div className="flex gap-2 mt-2 flex-wrap">
              {league.nuliga_url && (
                <Badge variant="outline" className="gap-1 text-blue-600 border-blue-200">
                  <Link2 className="h-3 w-3" /> nuLiga verbunden
                </Badge>
              )}
              <Badge variant="secondary">{sportLabels[league.sport] ?? league.sport}</Badge>
              <Badge variant="outline">{league.season_year}</Badge>
              {league.division && <Badge variant="outline">{league.division}</Badge>}
              {league.age_group && <Badge variant="outline">{league.age_group}</Badge>}
              <Badge
                className={
                  league.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }
              >
                {league.status === 'active' ? 'Aktiv' : 'Abgeschlossen'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowNuligaConfig(!showNuligaConfig);
              if (!showNuligaConfig) loadSyncHistory();
            }}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            nuLiga Sync
          </Button>
          {league.last_synced_at && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowSyncHistory(!showSyncHistory);
                if (!showSyncHistory) loadSyncHistory();
              }}
              className="gap-1.5 text-muted-foreground"
            >
              <History className="h-3.5 w-3.5" />
              Historie
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            CSV Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImport(!showImport)}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            CSV Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange(league.status === 'active' ? 'completed' : 'active')}
          >
            {league.status === 'active' ? 'Abschließen' : 'Reaktivieren'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="teams" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Teams ({league.teams.length})
          </TabsTrigger>
          <TabsTrigger value="matchdays" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Spieltage ({league.match_days.length})
          </TabsTrigger>
          <TabsTrigger value="standings" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Tabelle
          </TabsTrigger>
        </TabsList>

        {/* Teams Tab */}
        <TabsContent value="teams" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Mannschaften</h2>
            <Button size="sm" onClick={() => setShowNewTeam(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Neues Team
            </Button>
          </div>

          {league.teams.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-xl">
              <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">Noch keine Teams angelegt</p>
              <p className="text-sm text-muted-foreground mt-1">
                Erstelle dein erstes Team für diese Liga.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {league.teams.map((team) => (
                <Card key={team.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-8">
                          {team.position ?? '–'}
                        </span>
                        <div>
                          <CardTitle className="text-base">{team.name}</CardTitle>
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                            <span>
                              {team.matches_won}S {team.matches_drawn}U {team.matches_lost}N
                            </span>
                            <span className="font-semibold text-foreground">{team.points} Pkt</span>
                            <span>{team.members.length} Spieler</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setAssigningTeamId(assigningTeamId === team.id ? null : team.id)
                          }
                          title="Spieler hinzufügen"
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTeam(team.id)}
                          title="Team löschen"
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Team Members */}
                    {team.members.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">Keine Spieler zugewiesen</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {team.members.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm"
                          >
                            <span className="font-medium">{m.name}</span>
                            {m.role === 'captain' && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                Kapitän
                              </Badge>
                            )}
                            {m.dtb_id && (
                              <a
                                href={`https://www.tennis.de/vereinsspielbetrieb/spieler/${m.dtb_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-brand-primary hover:text-brand-primary/80 transition-colors"
                                title={`DTB: ${m.dtb_id} auf tennis.de anzeigen`}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <button
                              onClick={() => handleRemoveMember(team.id, m.member_id)}
                              className="text-muted-foreground hover:text-red-500 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Member Assignment */}
                    {assigningTeamId === team.id && (
                      <div className="mt-3 p-3 border rounded-lg bg-muted/50 space-y-2">
                        <div className="relative">
                          <Input
                            placeholder="Mitglied suchen…"
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            className="pr-8"
                          />
                          {memberSearch && (
                            <button
                              onClick={() => setMemberSearch('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {memberSearch.trim() && (
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {filteredMembers.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2 text-center">
                                Keine Ergebnisse
                              </p>
                            ) : (
                              filteredMembers.slice(0, 10).map((m) => {
                                const alreadyInTeam = team.members.some(
                                  (tm) => tm.member_id === m.id
                                );
                                return (
                                  <button
                                    key={m.id}
                                    onClick={() => !alreadyInTeam && handleAddMember(team.id, m.id)}
                                    disabled={alreadyInTeam}
                                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center justify-between ${
                                      alreadyInTeam
                                        ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                                        : 'hover:bg-background cursor-pointer'
                                    }`}
                                  >
                                    <span>
                                      {m.name}{' '}
                                      <span className="text-muted-foreground">({m.email})</span>
                                    </span>
                                    {alreadyInTeam && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        Bereits im Team
                                      </Badge>
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* New Team Form */}
          {showNewTeam && (
            <Card className="border-2 border-brand-primary/20">
              <CardHeader>
                <CardTitle className="text-base">Neues Team anlegen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label htmlFor="ld-new-team-name" className="text-xs font-medium">
                    Teamname *
                  </label>
                  <Input
                    id="ld-new-team-name"
                    value={newTeam.name}
                    onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                    placeholder="z.B. Herren 1"
                    className="mt-1"
                  />
                </div>
                <Input
                  placeholder="Notizen (optional)"
                  value={newTeam.notes}
                  onChange={(e) => setNewTeam({ ...newTeam, notes: e.target.value })}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowNewTeam(false)}>
                    Abbrechen
                  </Button>
                  <Button size="sm" onClick={handleCreateTeam}>
                    Team erstellen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Match Days Tab */}
        <TabsContent value="matchdays" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Spieltage</h2>
            <Button size="sm" onClick={() => setShowNewMatchDay(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Neuer Spieltag
            </Button>
          </div>

          {league.match_days.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-xl">
              <Calendar className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">Noch keine Spieltage eingetragen</p>
            </div>
          ) : (
            <div className="space-y-2">
              {league.match_days.map((md) => (
                <Card
                  key={md.id}
                  className={`hover:shadow-md transition-all duration-200 ${
                    md.status === 'completed'
                      ? md.result === 'win'
                        ? 'border-l-4 border-l-green-500'
                        : md.result === 'loss'
                          ? 'border-l-4 border-l-red-500'
                          : 'border-l-4 border-l-amber-500'
                      : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[3rem]">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Spieltag
                          </div>
                          <div className="text-xl font-bold text-brand-primary">
                            {md.matchday_number}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{md.opponent}</span>
                            <Badge variant={md.is_home ? 'default' : 'outline'} className="text-xs">
                              {md.is_home ? '🏠 Heim' : '✈️ Auswärts'}
                            </Badge>
                            {md.status === 'completed' && md.result && (
                              <Badge
                                className={`text-xs font-semibold ${
                                  md.result === 'win'
                                    ? 'bg-green-100 text-green-800'
                                    : md.result === 'loss'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {md.result === 'win'
                                  ? '✓ Sieg'
                                  : md.result === 'loss'
                                    ? '✗ Niederlage'
                                    : '= Unentschieden'}
                              </Badge>
                            )}
                            {md.status !== 'completed' && (
                              <Badge
                                variant="outline"
                                className="text-xs text-blue-600 border-blue-200"
                              >
                                Ausstehend
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {md.scheduled_date
                              ? new Date(md.scheduled_date).toLocaleDateString('de-DE', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })
                              : 'Kein Datum'}
                            {md.venue && ` · ${md.venue}`}
                          </div>
                          {md.status === 'completed' && md.score_home !== null && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-2xl font-bold tabular-nums text-foreground">
                                {md.score_home}
                              </span>
                              <span className="text-lg text-muted-foreground font-medium">:</span>
                              <span className="text-2xl font-bold tabular-nums text-foreground">
                                {md.score_away}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {md.status !== 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingResultId(md.id);
                              setResultForm({ result: 'win', score_home: 0, score_away: 0 });
                            }}
                            className="gap-1.5"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Ergebnis
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMatchDay(md.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </Button>
                      </div>
                    </div>

                    {/* Result Recording */}
                    {editingResultId === md.id && (
                      <div className="mt-3 p-3 border rounded-lg bg-muted/50 space-y-3">
                        <div className="flex items-center gap-4">
                          <div>
                            <label htmlFor="ld-result-type" className="text-xs font-medium">
                              Ergebnis
                            </label>
                            <select
                              id="ld-result-type"
                              value={resultForm.result}
                              onChange={(e) =>
                                setResultForm({ ...resultForm, result: e.target.value })
                              }
                              className="w-full mt-1 p-2 rounded border bg-background text-sm"
                            >
                              <option value="win">Sieg</option>
                              <option value="draw">Unentschieden</option>
                              <option value="loss">Niederlage</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="ld-result-home" className="text-xs font-medium">
                              Eigene
                            </label>
                            <Input
                              id="ld-result-home"
                              type="number"
                              min={0}
                              value={resultForm.score_home}
                              onChange={(e) =>
                                setResultForm({
                                  ...resultForm,
                                  score_home: parseInt(e.target.value) || 0,
                                })
                              }
                              className="mt-1 w-20"
                            />
                          </div>
                          <span className="text-lg font-bold mt-5">:</span>
                          <div>
                            <label htmlFor="ld-result-away" className="text-xs font-medium">
                              Gegner
                            </label>
                            <Input
                              id="ld-result-away"
                              type="number"
                              min={0}
                              value={resultForm.score_away}
                              onChange={(e) =>
                                setResultForm({
                                  ...resultForm,
                                  score_away: parseInt(e.target.value) || 0,
                                })
                              }
                              className="mt-1 w-20"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingResultId(null)}
                          >
                            Abbrechen
                          </Button>
                          <Button size="sm" onClick={() => handleRecordResult(md.id)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Eintragen
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* nuLiga Sync Panel */}
          {showNuligaConfig && (
            <Card className="border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  nuLiga Synchronisation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Verbinde diese Liga mit einer nuLiga Seite, um Tabellen und Ergebnisse automatisch
                  zu synchronisieren.
                </p>
                <div>
                  <label htmlFor="nuliga-url" className="text-xs font-medium">
                    nuLiga URL
                  </label>
                  <Input
                    id="nuliga-url"
                    value={nuligaUrl}
                    onChange={(e) => setNuligaUrl(e.target.value)}
                    placeholder="https://htv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/groupPage?championship=...&group=..."
                    className="mt-1 font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    URL muss von *.liga.nu stammen (z.B. htv.liga.nu, btv.liga.nu)
                  </p>
                </div>
                {league.last_synced_at && (
                  <p className="text-xs text-muted-foreground">
                    Letzter Sync: {new Date(league.last_synced_at).toLocaleString('de-DE')}
                  </p>
                )}
                {syncResult && (
                  <div className="text-xs bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded p-2 space-y-1">
                    <p className="font-medium text-green-700 dark:text-green-400">Sync-Ergebnis:</p>
                    <p>
                      {String(syncResult.standings)} Teams, {String(syncResult.matches)} Spieltage
                      geladen
                    </p>
                    <p>
                      {String(
                        (syncResult.teamsCreated as number) + (syncResult.teamsUpdated as number)
                      )}{' '}
                      Teams aktualisiert,{' '}
                      {String(
                        (syncResult.matchesCreated as number) +
                          (syncResult.matchesUpdated as number)
                      )}{' '}
                      Spieltage aktualisiert
                    </p>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowNuligaConfig(false)}>
                    Schließen
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleNuligaSync}
                    disabled={syncing || !nuligaUrl.trim()}
                  >
                    {syncing ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Synchronisiere...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Synchronisieren
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sync History Panel */}
          {showSyncHistory && (
            <Card className="border border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Sync-Historie
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setShowSyncHistory(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>
                ) : syncHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Noch keine Sync-Einträge vorhanden
                  </p>
                ) : (
                  <div className="space-y-2">
                    {syncHistory.map((entry) => (
                      <div
                        key={entry.id as string}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 text-sm"
                      >
                        <div className="mt-0.5">
                          {(entry.status as string) === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (entry.status as string) === 'partial' ? (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {(entry.trigger as string) === 'cron' ? 'Automatisch' : 'Manuell'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(entry.created_at as string).toLocaleString('de-DE')}
                            </span>
                          </div>
                          {(entry.status as string) === 'success' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {String(
                                (entry.teams_created as number) + (entry.teams_updated as number)
                              )}{' '}
                              Teams,{' '}
                              {String(
                                (entry.matches_created as number) +
                                  (entry.matches_updated as number)
                              )}{' '}
                              Spieltage aktualisiert
                              {entry.duration_ms != null && ` · ${String(entry.duration_ms)}ms`}
                            </p>
                          )}
                          {(entry.status as string) === 'failed' && !!entry.error_message && (
                            <p className="text-xs text-red-500 mt-1">
                              {String(entry.error_message)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* CSV Import Panel */}
          {showImport && (
            <Card className="border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  CSV-Import (tennis.de Format)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Importiere Spielergebnisse aus einer CSV-Datei. Bestehende Spieltage werden
                  aktualisiert, neue werden erstellt.
                </p>
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono">
                  Format: Spieltag;Datum;Gegner;Heim/Auswärts;Spielort;Ergebnis;Punkte Heim;Punkte
                  Gast;Status;Notizen
                </div>
                <div>
                  <label htmlFor="csv-upload" className="text-xs font-medium">
                    CSV-Datei hochladen
                  </label>
                  <Input
                    id="csv-upload"
                    type="file"
                    accept=".csv,.txt,.tsv"
                    className="mt-1"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setImportCsv((ev.target?.result as string) || '');
                        };
                        reader.readAsText(file);
                      }
                      // Reset so re-uploading the same file triggers onChange again
                      e.target.value = '';
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="csv-text" className="text-xs font-medium">
                    Oder CSV-Text einfügen
                  </label>
                  <textarea
                    id="csv-text"
                    value={importCsv}
                    onChange={(e) => setImportCsv(e.target.value)}
                    placeholder="Spieltag;Datum;Gegner;Heim/Auswärts;...&#10;1;15.03.2026;TC Musterstadt;Heim;..."
                    rows={5}
                    className="w-full mt-1 p-2 rounded border bg-background text-sm font-mono resize-none"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowImport(false);
                      setImportCsv('');
                    }}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleImportCsv}
                    disabled={importing || !importCsv.trim()}
                  >
                    {importing ? 'Importiere...' : 'Importieren'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* New Match Day Form */}
          {showNewMatchDay && (
            <Card className="border-2 border-brand-primary/20">
              <CardHeader>
                <CardTitle className="text-base">Neuen Spieltag anlegen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ld-md-number" className="text-xs font-medium">
                      Spieltag-Nr. *
                    </label>
                    <Input
                      id="ld-md-number"
                      type="number"
                      min={1}
                      value={newMatchDay.matchday_number}
                      onChange={(e) =>
                        setNewMatchDay({
                          ...newMatchDay,
                          matchday_number: parseInt(e.target.value) || 1,
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="ld-md-opponent" className="text-xs font-medium">
                      Gegner *
                    </label>
                    <Input
                      id="ld-md-opponent"
                      value={newMatchDay.opponent}
                      onChange={(e) => setNewMatchDay({ ...newMatchDay, opponent: e.target.value })}
                      placeholder="z.B. TC Musterstadt"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="ld-md-date" className="text-xs font-medium">
                      Datum
                    </label>
                    <Input
                      id="ld-md-date"
                      type="date"
                      value={newMatchDay.scheduled_date}
                      onChange={(e) =>
                        setNewMatchDay({ ...newMatchDay, scheduled_date: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="ld-md-venue-type" className="text-xs font-medium">
                      Heim/Auswärts
                    </label>
                    <select
                      id="ld-md-venue-type"
                      value={newMatchDay.is_home ? 'home' : 'away'}
                      onChange={(e) =>
                        setNewMatchDay({ ...newMatchDay, is_home: e.target.value === 'home' })
                      }
                      className="w-full mt-1 p-2 rounded border bg-background text-sm"
                    >
                      <option value="home">Heim</option>
                      <option value="away">Auswärts</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ld-md-venue" className="text-xs font-medium">
                      Spielort
                    </label>
                    <Input
                      id="ld-md-venue"
                      value={newMatchDay.venue}
                      onChange={(e) => setNewMatchDay({ ...newMatchDay, venue: e.target.value })}
                      placeholder="Optional"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowNewMatchDay(false)}>
                    Abbrechen
                  </Button>
                  <Button size="sm" onClick={handleCreateMatchDay}>
                    Spieltag erstellen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Standings Tab */}
        <TabsContent value="standings" className="space-y-4">
          <h2 className="text-lg font-semibold">Tabelle</h2>
          {league.teams.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Keine Teams vorhanden</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-10">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      Sp
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      S
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      U
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      N
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                      Punkte
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...league.teams]
                    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
                    .map((team, idx) => (
                      <tr key={team.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                          {team.position ?? idx + 1}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{team.name}</td>
                        <td className="px-4 py-3 text-sm text-center tabular-nums">
                          {team.matches_played}
                        </td>
                        <td className="px-4 py-3 text-sm text-center tabular-nums text-green-600">
                          {team.matches_won}
                        </td>
                        <td className="px-4 py-3 text-sm text-center tabular-nums text-amber-600">
                          {team.matches_drawn}
                        </td>
                        <td className="px-4 py-3 text-sm text-center tabular-nums text-red-600">
                          {team.matches_lost}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold tabular-nums">
                          {team.points}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
