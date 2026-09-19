'use client';

import { PageHeader } from '@/components/ui/page-header';
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, ExternalLink, MapPin, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { extractErrorMessage } from '@/lib/typed-helpers';

interface Match {
  id: string;
  scheduled_date: string | null;
  opponent: string;
  is_home: boolean;
  venue: string | null;
  status: string;
  result: string | null;
  score_home: number | null;
  score_away: number | null;
  nuliga_report_url: string | null;
}

interface Standing {
  id: string;
  name: string;
  position: number | null;
  points: number | null;
  matches_played: number | null;
  matches_won: number | null;
  matches_drawn: number | null;
  matches_lost: number | null;
}

interface RosterEntry {
  name: string;
  lk: string | null;
  position_number: number | null;
  is_me: boolean;
}

interface Suggestion {
  player_id: string;
  name: string;
  lk: string | null;
  league_name: string;
}

interface MyTeam {
  league_id: string;
  league_name: string;
  season_year: number;
  division: string | null;
  age_group: string | null;
  position_number: number | null;
  lk: string | null;
  own_team_name: string | null;
  matches: Match[];
  standings: Standing[];
  roster: RosterEntry[];
}

const RESULT_STYLE: Record<string, string> = {
  win: 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-300',
  loss: 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-300',
  draw: 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-300',
};
const RESULT_LABEL: Record<string, string> = {
  win: '✓ Sieg',
  loss: '✗ Niederlage',
  draw: '= Unentschieden',
};

function formatDate(iso: string | null): string {
  if (!iso) return 'Termin offen';
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
}

export function MyLeaguesClient() {
  const [teams, setTeams] = useState<MyTeam[] | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const load = useCallback(() => {
    apiFetch('/api/member/leagues')
      .then((res) => (res.ok ? res.json() : { teams: [], suggestions: [] }))
      .then((data) => {
        setTeams(data.teams ?? []);
        setSuggestions(data.suggestions ?? []);
      })
      .catch(() => setTeams([]));
  }, []);

  useEffect(load, [load]);

  const claim = async (playerId: string) => {
    try {
      const res = await apiFetch('/api/member/leagues/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Zuordnung fehlgeschlagen');
      toast.success('Deine Mannschaft ist verknüpft');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Zuordnung fehlgeschlagen');
    }
  };

  if (teams === null) {
    return <div className="py-20 text-center text-muted-foreground">Laden</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meine Mannschaften"
        description="Deine Medenspiele, gemeldet über den Verband."
        back={{ href: '/member', label: 'Zurück zum Dashboard' }}
      />

      {suggestions.map((sg) => (
        <Card key={sg.player_id} className="border-info-200 dark:border-info-800/40">
          <CardContent className="flex items-center justify-between gap-3 flex-wrap py-4">
            <div className="flex items-center gap-3 min-w-0">
              <UserCheck className="h-5 w-5 text-info-600 dark:text-info-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Bist du {sg.name}
                  {sg.lk ? ` (${sg.lk})` : ''}?
                </p>
                <p className="text-xs text-muted-foreground">
                  Du stehst in der Meldeliste {sg.league_name}. Bestätige es, dann siehst du hier
                  deine Spiele.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => claim(sg.player_id)}>
              Ja, das bin ich
            </Button>
          </CardContent>
        </Card>
      ))}

      {teams.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <Trophy className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Du stehst aktuell in keiner Mannschaftsmeldung.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Sobald deine DTB-ID im Profil steht oder der Sportwart dich zuordnet, erscheinen deine
            Spieltage hier.
          </p>
        </div>
      ) : (
        teams.map((team) => (
          <Card key={team.league_id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Trophy className="h-4 w-4 text-brand-light" />
                {team.league_name}
                <span className="text-sm font-normal text-muted-foreground">
                  {team.season_year}
                </span>
                {team.lk && (
                  <Badge variant="outline" className="text-xs">
                    {team.lk}
                  </Badge>
                )}
                {team.position_number !== null && (
                  <Badge variant="secondary" className="text-2xs">
                    Meldeposition {team.position_number}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {team.matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Spieltage hinterlegt.</p>
              ) : (
                team.matches.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-border/60 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{m.opponent}</span>
                        <Badge variant={m.is_home ? 'default' : 'outline'} className="text-2xs">
                          {m.is_home ? '🏠 Heim' : '✈️ Auswärts'}
                        </Badge>
                        {m.result && (
                          <Badge className={`text-2xs ${RESULT_STYLE[m.result] ?? ''}`}>
                            {RESULT_LABEL[m.result]}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        {formatDate(m.scheduled_date)}
                        {m.venue && (
                          <>
                            <MapPin className="h-3 w-3" />
                            {m.venue}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {m.score_home !== null && (
                        <span className="text-lg font-bold tabular-nums">
                          {m.score_home}:{m.score_away}
                        </span>
                      )}
                      {m.nuliga_report_url && (
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                          <a href={m.nuliga_report_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Bericht
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {team.standings.length > 0 && (
                <div className="pt-4">
                  <h3 className="text-sm font-semibold mb-2">Tabelle</h3>
                  <div className="overflow-x-auto rounded-xl border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr className="border-b border-border/60">
                          <th className="p-2 text-left w-8">#</th>
                          <th className="p-2 text-left">Mannschaft</th>
                          <th className="p-2 text-right">Sp.</th>
                          <th className="p-2 text-right">S</th>
                          <th className="p-2 text-right">U</th>
                          <th className="p-2 text-right">N</th>
                          <th className="p-2 text-right">Pkt.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {team.standings.map((row) => {
                          const own =
                            !!team.own_team_name &&
                            row.name.trim().toLowerCase() ===
                              team.own_team_name.trim().toLowerCase();
                          return (
                            <tr
                              key={row.id}
                              className={`border-b border-border/40 last:border-0 ${own ? 'bg-brand-light/10 font-medium' : ''}`}
                            >
                              <td className="p-2 tabular-nums">{row.position ?? '–'}</td>
                              <td className="p-2">{row.name}</td>
                              <td className="p-2 text-right tabular-nums">{row.matches_played}</td>
                              <td className="p-2 text-right tabular-nums">{row.matches_won}</td>
                              <td className="p-2 text-right tabular-nums">{row.matches_drawn}</td>
                              <td className="p-2 text-right tabular-nums">{row.matches_lost}</td>
                              <td className="p-2 text-right tabular-nums">{row.points}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {team.roster.length > 0 && (
                <div className="pt-4">
                  <h3 className="text-sm font-semibold mb-2">Meldeliste</h3>
                  <ul className="space-y-1">
                    {team.roster.map((r) => (
                      <li
                        key={`${r.position_number}-${r.name}`}
                        className="flex items-center gap-3 text-sm"
                      >
                        <span className="w-6 tabular-nums text-muted-foreground">
                          {r.position_number ?? '–'}
                        </span>
                        <span className={r.is_me ? 'font-medium' : ''}>{r.name}</span>
                        {r.lk && (
                          <Badge variant="outline" className="text-xs">
                            {r.lk}
                          </Badge>
                        )}
                        {r.is_me && (
                          <Badge variant="secondary" className="text-2xs">
                            Du
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
