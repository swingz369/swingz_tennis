'use client';

/**
 * components/league/my-teams-card.tsx
 *
 * "Meine Mannschaften" auf dem Mitglieder-Dashboard: zeigt jedem Spieler die
 * Ligen, in deren Meldeliste er steht, samt LK, Meldeposition und nächstem
 * Spieltag. Rendert nichts, wenn jemand in keinem Kader steht — das ist die
 * Mehrheit der Mitglieder, und für die soll kein leerer Kasten stehen.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

interface Match {
  id: string;
  scheduled_date: string | null;
  opponent: string;
  is_home: boolean;
  venue: string | null;
  result?: string | null;
  score_home?: number | null;
  score_away?: number | null;
}

const RESULT_LABEL: Record<string, string> = {
  win: '✓ Sieg',
  loss: '✗ Niederlage',
  draw: '= Unentschieden',
};

interface MyTeam {
  league_id: string;
  league_name: string;
  season_year: number;
  division: string | null;
  age_group: string | null;
  position_number: number | null;
  lk: string | null;
  next_match: Match | null;
  upcoming_count: number;
  last_match: Match | null;
}

/** "Sa, 27.06. 10:00" in Berliner Zeit. */
function formatMatchDate(iso: string | null): string {
  if (!iso) return 'Termin offen';
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
}

export function MyTeamsCard() {
  const [teams, setTeams] = useState<MyTeam[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/member/leagues')
      .then((res) => (res.ok ? res.json() : { teams: [] }))
      .then((data) => {
        if (!cancelled) setTeams(data.teams ?? []);
      })
      .catch(() => {
        // Stiller Fehlschlag: die Karte ist Zusatzinfo, kein Kernweg.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (teams.length === 0) return null;

  return (
    <Card className="border border-border dark:border-white/10">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-brand-light" />
            Meine Mannschaften
          </span>
          {/* Mitglieder haben keine Sidebar — ohne diesen Link wäre die Seite
              für sie nicht erreichbar. */}
          <Link
            href="/member/leagues"
            className="text-xs font-normal text-brand-light hover:underline"
          >
            Alle Spieltage →
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-3">
        {teams.map((team) => (
          <div key={team.league_id} className="rounded-xl border border-border/60 p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium">{team.league_name}</span>
              <div className="flex items-center gap-1.5">
                {team.lk && (
                  <Badge variant="outline" className="text-xs">
                    {team.lk}
                  </Badge>
                )}
                {team.position_number !== null && (
                  <Badge variant="secondary" className="text-2xs">
                    Position {team.position_number}
                  </Badge>
                )}
              </div>
            </div>

            {team.next_match ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {formatMatchDate(team.next_match.scheduled_date)} ·{' '}
                  {team.next_match.is_home ? 'Heim' : 'Auswärts'} gegen {team.next_match.opponent}
                  {team.upcoming_count > 1 && ` · ${team.upcoming_count - 1} weitere`}
                </span>
              </div>
            ) : team.last_match ? (
              /* Außerhalb der Saison: das letzte Ergebnis statt eines leeren Kastens. */
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Zuletzt: {formatMatchDate(team.last_match.scheduled_date)} ·{' '}
                  {team.last_match.is_home ? 'Heim' : 'Auswärts'} gegen {team.last_match.opponent}
                  {team.last_match.score_home !== null &&
                    team.last_match.score_home !== undefined &&
                    ` · ${team.last_match.score_home}:${team.last_match.score_away}`}
                  {team.last_match.result && ` ${RESULT_LABEL[team.last_match.result] ?? ''}`}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Keine Spieltage hinterlegt.</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
