'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  UtensilsCrossed,
  Lock,
  LockOpen,
} from 'lucide-react';
import { CateringTab } from '@/components/league/catering-tab';
import { NuligaImport } from '@/components/admin/nuliga-import';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
  nuliga_report_url: string | null;
  /** Anzahl der für diesen Spieltag gesperrten Plätze (0 = nicht gesperrt). */
  blocked_courts: number;
}

interface LeaguePlayer {
  id: string;
  name: string;
  lk: string | null;
  position_number: number | null;
  member_id: string | null;
  synced_at: string;
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
  own_team_name: string | null;
  nuliga_roster_url: string | null;
  last_synced_at: string | null;
  teams: Team[];
  match_days: MatchDay[];
  players: LeaguePlayer[];
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

  // Kader (Meldeliste) + Platzsperre
  const [rosterUrl, setRosterUrl] = useState('');
  const [rosterSyncing, setRosterSyncing] = useState(false);
  const [blockingMatchday, setBlockingMatchday] = useState<string | null>(null);

  // Result recording
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState({ result: 'win', score_home: 0, score_away: 0 });

  // League editing
  const [editingLeague, setEditingLeague] = useState(false);
  const [leagueForm, setLeagueForm] = useState({
    name: '',
    season_year: new Date().getFullYear(),
    division: '',
    age_group: '',
    notes: '',
    nuliga_url: '',
    own_team_name: '',
  });

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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Löschen fehlgeschlagen');
      toast.success('Team gelöscht');
      fetchLeague();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Löschen');
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
        throw new Error(extractErrorMessage(err) || 'Failed');
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Löschen fehlgeschlagen');
      toast.success('Spieltag gelöscht');
      fetchLeague();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Löschen');
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
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Sync fehlgeschlagen');

      setSyncResult(data);
      const parts: string[] = [];
      if (data.teamsCreated > 0) parts.push(`${data.teamsCreated} Teams erstellt`);
      if (data.teamsUpdated > 0) parts.push(`${data.teamsUpdated} Teams aktualisiert`);
      if (data.matchesCreated > 0) parts.push(`${data.matchesCreated} Spieltage erstellt`);
      if (data.matchesUpdated > 0) parts.push(`${data.matchesUpdated} Spieltage aktualisiert`);
      if (data.playersImported > 0) {
        parts.push(`${data.playersImported} Spieler im Kader (${data.playersLinked} verknüpft)`);
      }
      if (data.skippedForeign > 0) {
        parts.push(`${data.skippedForeign} fremde Begegnungen übersprungen`);
      }
      toast.success(`Sync erfolgreich: ${parts.join(', ') || 'Alles aktuell'}`);
      if (data.warning) toast.warning(data.warning, { duration: 10000 });
      fetchLeague();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Sync');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (league?.nuliga_roster_url) setRosterUrl(league.nuliga_roster_url);
  }, [league?.nuliga_roster_url]);

  const handleRosterSync = async () => {
    if (!rosterUrl.trim()) {
      toast.error('Bitte URL der Mannschaftsmeldung eingeben');
      return;
    }
    setRosterSyncing(true);
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuliga_roster_url: rosterUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Abruf fehlgeschlagen');
      toast.success(
        `${data.imported} Spieler übernommen, ${data.linked} davon einem Mitglied zugeordnet`
      );
      fetchLeague();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Abruf der Meldeliste');
    } finally {
      setRosterSyncing(false);
    }
  };

  const handleAssignPlayer = async (playerId: string, memberId: string | null) => {
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/roster`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, member_id: memberId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Zuordnung fehlgeschlagen');
      toast.success(memberId ? 'Mitglied zugeordnet' : 'Zuordnung entfernt');
      fetchLeague();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Zuordnung fehlgeschlagen');
    }
  };

  const handleToggleCourtBlock = async (matchDay: MatchDay) => {
    setBlockingMatchday(matchDay.id);
    const blocked = matchDay.blocked_courts > 0;
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/matchdays/${matchDay.id}/courts`, {
        method: blocked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: blocked ? undefined : JSON.stringify({ notify_members: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Fehlgeschlagen');
      toast.success(blocked ? 'Platzsperre aufgehoben' : `${data.created} Plätze gesperrt`);
      fetchLeague();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler bei der Platzsperre');
    } finally {
      setBlockingMatchday(null);
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
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Import fehlgeschlagen');

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

  const handleUpdateLeague = async () => {
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leagueForm.name,
          season_year: leagueForm.season_year,
          division: leagueForm.division || null,
          age_group: leagueForm.age_group || null,
          notes: leagueForm.notes || null,
          nuliga_url: leagueForm.nuliga_url || null,
          own_team_name: leagueForm.own_team_name || null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Liga aktualisiert');
      setEditingLeague(false);
      fetchLeague();
    } catch {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">Laden</div>
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
      <Breadcrumb
        items={[{ label: 'Liga & Mannschaft', href: '/admin/leagues' }, { label: league.name }]}
      />
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="mt-1" asChild>
                <Link href="/admin/leagues" aria-label="Zurück zur Ligaübersicht">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zurück zur Ligaübersicht</TooltipContent>
          </Tooltip>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">{league.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[
                sportLabels[league.sport] ?? league.sport,
                league.season_year,
                league.division,
                league.age_group,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {league.nuliga_url && (
                <Badge
                  variant="outline"
                  className="gap-1 text-info-600 dark:text-info-400 border-info-200 dark:border-info-800/40"
                >
                  <Link2 className="h-3 w-3" /> nuLiga verbunden
                </Badge>
              )}
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
          </div>
        </div>
        <div className="flex gap-2">
          <NuligaImport leagueId={leagueId} teamName={league.name} />
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
            onClick={() => {
              setLeagueForm({
                name: league.name,
                season_year: league.season_year,
                division: league.division ?? '',
                age_group: league.age_group ?? '',
                notes: league.notes ?? '',
                nuliga_url: league.nuliga_url ?? '',
                own_team_name: league.own_team_name ?? '',
              });
              setEditingLeague(true);
            }}
            className="gap-1.5"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Bearbeiten
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

      {/* Inline Liga Edit Form */}
      {editingLeague && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Liga bearbeiten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ld-edit-name" className="text-xs font-medium">
                  Name *
                </label>
                <Input
                  id="ld-edit-name"
                  value={leagueForm.name}
                  onChange={(e) => setLeagueForm({ ...leagueForm, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="ld-edit-year" className="text-xs font-medium">
                  Saison-Jahr
                </label>
                <Input
                  id="ld-edit-year"
                  type="number"
                  value={leagueForm.season_year}
                  onChange={(e) =>
                    setLeagueForm({
                      ...leagueForm,
                      season_year: parseInt(e.target.value) || new Date().getFullYear(),
                    })
                  }
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ld-edit-division" className="text-xs font-medium">
                  Liga/Klasse
                </label>
                <Input
                  id="ld-edit-division"
                  value={leagueForm.division}
                  onChange={(e) => setLeagueForm({ ...leagueForm, division: e.target.value })}
                  placeholder="z.B. Hessenliga, Verbandsliga"
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="ld-edit-agegroup" className="text-xs font-medium">
                  Altersklasse
                </label>
                <Input
                  id="ld-edit-agegroup"
                  value={leagueForm.age_group}
                  onChange={(e) => setLeagueForm({ ...leagueForm, age_group: e.target.value })}
                  placeholder="z.B. Herren, Damen, U18"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label htmlFor="ld-edit-notes" className="text-xs font-medium">
                Notizen
              </label>
              <Input
                id="ld-edit-notes"
                value={leagueForm.notes}
                onChange={(e) => setLeagueForm({ ...leagueForm, notes: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="ld-edit-nuliga" className="text-xs font-medium">
                nuLiga URL
              </label>
              <Input
                id="ld-edit-nuliga"
                value={leagueForm.nuliga_url}
                onChange={(e) => setLeagueForm({ ...leagueForm, nuliga_url: e.target.value })}
                placeholder="https://htv.liga.nu/cgi-bin/WebObjects/..."
                className="mt-1 tabular-nums text-xs"
              />
            </div>
            <div>
              <label htmlFor="ld-edit-own-team" className="text-xs font-medium">
                Eigene Mannschaft
              </label>
              <Input
                id="ld-edit-own-team"
                value={leagueForm.own_team_name}
                onChange={(e) => setLeagueForm({ ...leagueForm, own_team_name: e.target.value })}
                placeholder="z.B. TC Rheinland II"
                className="mt-1"
              />
              <p className="text-2xs text-muted-foreground mt-1">
                Nur nötig, wenn oben eine <em>Gruppenseite</em> steht — dann exakt wie in der
                nuLiga-Tabelle, sonst übernimmt der Sync nur die Tabelle und nicht den Spielplan.
                Bei einer Mannschaftsseite bleibt das Feld leer.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditingLeague(false)}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={handleUpdateLeague} disabled={!leagueForm.name}>
                Speichern
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="teams" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Teams ({league.teams.length})
          </TabsTrigger>
          <TabsTrigger value="matchdays" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Spieltage ({league.match_days.length})
          </TabsTrigger>
          <TabsTrigger value="roster" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Kader ({league.players?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="standings" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Tabelle
          </TabsTrigger>
          <TabsTrigger value="catering" className="gap-1.5">
            <UtensilsCrossed className="h-3.5 w-3.5" /> Bewirtung
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setAssigningTeamId(assigningTeamId === team.id ? null : team.id)
                              }
                              aria-label="Spieler hinzufügen"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Spieler hinzufügen</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTeam(team.id)}
                              aria-label="Team löschen"
                            >
                              <Trash2 className="h-4 w-4 text-error-400" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Team löschen</TooltipContent>
                        </Tooltip>
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
                              <Badge variant="secondary" className="text-2xs px-1.5 py-0">
                                Kapitän
                              </Badge>
                            )}
                            {m.dtb_id && (
                              <a
                                href={`https://www.tennis.de/vereinsspielbetrieb/spieler/${m.dtb_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 transition-colors"
                                title={`DTB: ${m.dtb_id} auf tennis.de anzeigen`}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <button
                              onClick={() => handleRemoveMember(team.id, m.member_id)}
                              className="text-muted-foreground hover:text-error-500 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Member Assignment */}
                    {assigningTeamId === team.id && (
                      <div className="mt-3 p-3 border rounded-xl bg-muted/50 space-y-2">
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
                                      <Badge variant="secondary" className="text-2xs">
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
            <Card className="border-2 border-primary/20">
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
                        ? 'border-l-4 border-l-success-500'
                        : md.result === 'loss'
                          ? 'border-l-4 border-l-error-500'
                          : 'border-l-4 border-l-warning-500'
                      : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[3rem]">
                          <div className="text-2xs text-muted-foreground">Spieltag</div>
                          <div className="text-xl font-bold text-primary">{md.matchday_number}</div>
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
                                    ? 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-300'
                                    : md.result === 'loss'
                                      ? 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-300'
                                      : 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-300'
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
                                className="text-xs text-info-600 border-info-200"
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
                        {md.nuliga_report_url && (
                          <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <a
                              href={md.nuliga_report_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Spielbericht
                            </a>
                          </Button>
                        )}
                        {md.is_home && (
                          <Button
                            variant={md.blocked_courts > 0 ? 'secondary' : 'outline'}
                            size="sm"
                            disabled={blockingMatchday === md.id}
                            onClick={() => handleToggleCourtBlock(md)}
                            className="gap-1.5"
                            title={
                              md.blocked_courts > 0
                                ? `${md.blocked_courts} Plätze gesperrt — klicken zum Aufheben`
                                : 'Alle aktiven Plätze für dieses Heimspiel sperren'
                            }
                          >
                            {md.blocked_courts > 0 ? (
                              <Lock className="h-3.5 w-3.5" />
                            ) : (
                              <LockOpen className="h-3.5 w-3.5" />
                            )}
                            {md.blocked_courts > 0 ? `${md.blocked_courts} Plätze` : 'Plätze'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingResultId(md.id);
                            setResultForm({
                              result: md.result ?? 'win',
                              score_home: md.score_home ?? 0,
                              score_away: md.score_away ?? 0,
                            });
                          }}
                          className="gap-1.5"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          {md.status === 'completed' ? 'Bearbeiten' : 'Ergebnis'}
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteMatchDay(md.id)}
                              aria-label="Spieltag löschen"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-error-400" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Spieltag löschen</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Result Recording */}
                    {editingResultId === md.id && (
                      <div className="mt-3 p-3 border rounded-xl bg-muted/50 space-y-3">
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
            <Card className="border-2 border-info-200 bg-info-50/50 dark:bg-info-900/20 dark:border-info-800">
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
                    className="mt-1 tabular-nums text-xs"
                  />
                  <p className="text-2xs text-muted-foreground mt-1">
                    URL muss von *.liga.nu stammen (z.B. htv.liga.nu, btv.liga.nu)
                  </p>
                </div>
                {league.last_synced_at && (
                  <p className="text-xs text-muted-foreground">
                    Letzter Sync: {new Date(league.last_synced_at).toLocaleString('de-DE')}
                  </p>
                )}
                {syncResult && (
                  <div className="text-xs bg-success-50 dark:bg-success-900/30 border border-success-200 dark:border-success-800 rounded p-2 space-y-1">
                    <p className="font-medium text-success-700 dark:text-success-400">
                      Sync-Ergebnis:
                    </p>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowSyncHistory(false)}
                        aria-label="Schließen"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Schließen</TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Laden</p>
                ) : syncHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Noch keine Sync-Einträge vorhanden
                  </p>
                ) : (
                  <div className="space-y-2">
                    {syncHistory.map((entry) => (
                      <div
                        key={entry.id as string}
                        className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 text-sm"
                      >
                        <div className="mt-0.5">
                          {(entry.status as string) === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-success-500" />
                          ) : (entry.status as string) === 'partial' ? (
                            <AlertTriangle className="h-4 w-4 text-warning-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-error-500" />
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
                            <p className="text-xs text-error-500 mt-1">
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
            <Card className="border-2 border-info-200 bg-info-50/50 dark:bg-info-900/20 dark:border-info-800">
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
                    className="w-full mt-1 p-2 rounded border bg-background text-sm tabular-nums resize-none"
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
            <Card className="border-2 border-primary/20">
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

        {/* Kader Tab — Meldeliste aus nuLiga */}
        <TabsContent value="roster" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Kader (Meldeliste)</h2>
            {league.players?.[0]?.synced_at && (
              <span className="text-xs text-muted-foreground">
                Stand: {new Date(league.players[0].synced_at).toLocaleDateString('de-DE')}
              </span>
            )}
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <label htmlFor="ld-roster-url" className="text-xs font-medium">
                URL der Mannschaftsseite
              </label>
              <div className="flex gap-2">
                <Input
                  id="ld-roster-url"
                  value={rosterUrl}
                  onChange={(e) => setRosterUrl(e.target.value)}
                  placeholder="https://htv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/teamPortrait?teamtable=..."
                  className="tabular-nums text-xs"
                />
                <Button size="sm" onClick={handleRosterSync} disabled={rosterSyncing}>
                  {rosterSyncing ? 'Lade…' : 'Abrufen'}
                </Button>
              </div>
              <p className="text-2xs text-muted-foreground">
                Übernimmt Meldeposition, LK und Namen der eigenen Mannschaft und verknüpft sie über
                die DTB-ID mit den Mitgliedern. Leer lassen nutzt die oben hinterlegte Liga-URL.
                Spieler anderer Vereine werden nicht gespeichert — deren Aufstellungen stehen im
                verlinkten Spielbericht.
              </p>
            </CardContent>
          </Card>

          {(league.players?.length ?? 0) === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              Noch kein Kader übernommen.
            </div>
          ) : (
            <div className="space-y-1.5">
              {league.players.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular-nums text-muted-foreground w-6">
                        {p.position_number ?? '–'}
                      </span>
                      <span className="text-sm font-medium">{p.name}</span>
                      {p.lk && (
                        <Badge variant="outline" className="text-xs">
                          {p.lk}
                        </Badge>
                      )}
                    </div>
                    {/* Verknüpfte Zeilen zeigen nur ein Abzeichen. Das Auswahlfeld
                        steht nur dort, wo wirklich etwas zuzuordnen ist — sonst
                        rendert ein 300er-Verein pro Kaderzeile 300 Optionen. */}
                    {p.member_id ? (
                      <button
                        type="button"
                        aria-label={`Zuordnung von ${p.name} lösen`}
                        onClick={() => handleAssignPlayer(p.id, null)}
                        className="text-2xs"
                      >
                        <Badge variant="secondary" className="text-2xs cursor-pointer">
                          Mitglied verknüpft ✕
                        </Badge>
                      </button>
                    ) : (
                      <select
                        aria-label={`Mitglied für ${p.name} zuordnen`}
                        value=""
                        onChange={(e) => handleAssignPlayer(p.id, e.target.value || null)}
                        className="text-xs p-1.5 rounded border bg-background max-w-[14rem]"
                      >
                        <option value="">— Mitglied zuordnen —</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">Sp</TableHead>
                    <TableHead className="text-center">S</TableHead>
                    <TableHead className="text-center">U</TableHead>
                    <TableHead className="text-center">N</TableHead>
                    <TableHead className="text-right">Punkte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...league.teams]
                    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
                    .map((team, idx) => (
                      <TableRow key={team.id}>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {team.position ?? idx + 1}
                        </TableCell>
                        <TableCell className="font-medium">{team.name}</TableCell>
                        <TableCell className="text-center tabular-nums">
                          {team.matches_played}
                        </TableCell>
                        <TableCell className="text-center tabular-nums text-success-600 dark:text-success-400">
                          {team.matches_won}
                        </TableCell>
                        <TableCell className="text-center tabular-nums text-warning-600 dark:text-warning-400">
                          {team.matches_drawn}
                        </TableCell>
                        <TableCell className="text-center tabular-nums text-error-600 dark:text-error-400">
                          {team.matches_lost}
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums">
                          {team.points}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Bewirtung Tab */}
        <TabsContent value="catering" className="space-y-4">
          <h2 className="text-lg font-semibold">Bewirtung Heimspiele</h2>
          <CateringTab leagueId={leagueId} matchDays={league.match_days} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
