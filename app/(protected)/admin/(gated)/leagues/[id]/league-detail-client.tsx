'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Users,
  Calendar,
  Trophy,
  Edit2,
  Download,
  Upload,
  RefreshCw,
  Link2,
  History,
  UtensilsCrossed,
} from 'lucide-react';
import { CateringTab } from '@/components/league/catering-tab';
import { NuligaImport } from '@/components/admin/nuliga-import';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { League, Member } from './tabs/types';
import { TeamsTab } from './tabs/teams-tab';
import { MatchdaysTab } from './tabs/matchdays-tab';
import { useMatchdays } from './tabs/use-matchdays';
import { RosterTab } from './tabs/roster-tab';
import { StandingsTab } from './tabs/standings-tab';

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
  members: Member[];
}) {
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setActiveTab] = useState<string | null>(null);

  const nuligaLinked = !!(league?.nuliga_url || league?.nuliga_roster_url);
  // nuLiga-Ligen öffnen auf der Tabelle: Teams sind dort die Tabellenzeilen, nichts zum Anlegen.
  const activeTab = selectedTab ?? (nuligaLinked ? 'standings' : 'teams');

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

  const matchdays = useMatchdays(leagueId, league, fetchLeague);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">Laden</div>
    );
  }

  if (!league) {
    return <div className="p-6 text-muted-foreground">Liga nicht gefunden</div>;
  }

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
              matchdays.setShowNuligaConfig(!matchdays.showNuligaConfig);
              if (!matchdays.showNuligaConfig) matchdays.loadSyncHistory();
            }}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${matchdays.syncing ? 'animate-spin' : ''}`} />
            nuLiga Sync
          </Button>
          {league.last_synced_at && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                matchdays.setShowSyncHistory(!matchdays.showSyncHistory);
                if (!matchdays.showSyncHistory) matchdays.loadSyncHistory();
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
            onClick={() => matchdays.setShowImport(!matchdays.showImport)}
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

        <TabsContent value="teams" className="space-y-4">
          <TeamsTab
            leagueId={leagueId}
            teams={league.teams}
            members={members}
            nuligaLinked={nuligaLinked}
            onChanged={fetchLeague}
          />
        </TabsContent>

        <TabsContent value="matchdays" className="space-y-4">
          <MatchdaysTab
            matchDays={league.match_days}
            lastSyncedAt={league.last_synced_at}
            actions={matchdays}
          />
        </TabsContent>

        {/* Kader Tab — Meldeliste aus nuLiga */}
        <TabsContent value="roster" className="space-y-4">
          <RosterTab
            leagueId={leagueId}
            players={league.players}
            nuligaRosterUrl={league.nuliga_roster_url}
            members={members}
            onChanged={fetchLeague}
          />
        </TabsContent>

        <TabsContent value="standings" className="space-y-4">
          <StandingsTab teams={league.teams} />
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
