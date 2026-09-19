'use client';

import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, UserPlus, Users, X, ExternalLink } from 'lucide-react';
import { extractErrorMessage } from '@/lib/typed-helpers';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import type { Team, Member } from './types';

export function TeamsTab({
  leagueId,
  teams,
  members,
  nuligaLinked = false,
  onChanged,
}: {
  leagueId: string;
  teams: Team[];
  members: Member[];
  nuligaLinked?: boolean;
  onChanged: () => void;
}) {
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', notes: '' });
  const [assigningTeamId, setAssigningTeamId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  const filteredMembers = memberSearch.trim()
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
          m.email.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : [];

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
      onChanged();
    } catch {
      toast.error('Fehler beim Erstellen');
    }
  };

  const [confirm, confirmDialog] = useConfirmDialog();

  const handleDeleteTeam = async (teamId: string) => {
    const ok = await confirm({
      title: 'Team löschen',
      description: 'Team wirklich löschen? Alle Zuordnungen gehen verloren.',
      confirmLabel: 'Löschen',
    });
    if (!ok) return;
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/teams/${teamId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Löschen fehlgeschlagen');
      toast.success('Team gelöscht');
      onChanged();
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
      onChanged();
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
      onChanged();
    } catch {
      toast.error('Fehler beim Entfernen');
    }
  };

  return (
    <>
      {confirmDialog}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Mannschaften</h2>
        {!nuligaLinked && (
          <Button size="sm" onClick={() => setShowNewTeam(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Neues Team
          </Button>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Noch keine Teams angelegt</p>
          <p className="text-sm text-muted-foreground mt-1">
            {nuligaLinked
              ? 'Die Teams kommen aus der nuLiga-Tabelle — oben „Synchronisieren" wählen.'
              : 'Erstelle dein erstes Team für diese Liga.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => (
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
                            const alreadyInTeam = team.members.some((tm) => tm.member_id === m.id);
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
    </>
  );
}
