'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, ExternalLink, MapPin } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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

interface MyTeam {
  league_id: string;
  league_name: string;
  season_year: number;
  division: string | null;
  age_group: string | null;
  position_number: number | null;
  lk: string | null;
  matches: Match[];
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

  useEffect(() => {
    apiFetch('/api/member/leagues')
      .then((res) => (res.ok ? res.json() : { teams: [] }))
      .then((data) => setTeams(data.teams ?? []))
      .catch(() => setTeams([]));
  }, []);

  if (teams === null) {
    return <div className="py-20 text-center text-muted-foreground">Laden</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/member" aria-label="Zurück zum Dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zurück zum Dashboard</TooltipContent>
        </Tooltip>
        <div>
          <h1 className="text-xl font-semibold">Meine Mannschaften</h1>
          <p className="text-sm text-muted-foreground">
            Deine Medenspiele, gemeldet über den Verband.
          </p>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <Trophy className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Du stehst aktuell in keiner Mannschaftsmeldung.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Sobald dich der Sportwart in einer Meldeliste zuordnet, erscheinen deine Spieltage hier.
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
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
