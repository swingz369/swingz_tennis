'use client';

import { useState, useEffect, useCallback } from 'react';
import { Swords, TrendingUp, Trophy, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-fetch';
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  full_name: string;
  email: string;
}

interface RecentMatch {
  id: string;
  date: string;
  outcome: 'win' | 'loss' | 'draw';
  myScore: number;
  opponentScore: number;
  type: 'singles' | 'doubles';
}

interface HeadToHeadData {
  myWins: number;
  opponentWins: number;
  notPlayed: number;
  total: number;
  recentMatches: RecentMatch[];
}

interface HeadToHeadProps {
  myUserId: string;
  clubId: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function HeadToHead({ myUserId, clubId }: HeadToHeadProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [opponentId, setOpponentId] = useState<string>('');
  const [data, setData] = useState<HeadToHeadData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMembers() {
      try {
        const res = await apiFetch(`/api/members?clubId=${clubId}&active=true&limit=200`);
        if (!res.ok) throw new Error('Fehler beim Laden der Mitglieder');
        const json = (await res.json()) as { members: Member[] };
        setMembers(json.members.filter((m) => m.id !== myUserId));
      } catch {
        setError('Mitgliederliste konnte nicht geladen werden');
      } finally {
        setLoadingMembers(false);
      }
    }
    void loadMembers();
  }, [clubId, myUserId]);

  const loadH2H = useCallback(
    async (oppId: string) => {
      setLoadingData(true);
      setError(null);
      try {
        const res = await apiFetch(
          `/api/members/head-to-head?myId=${myUserId}&opponentId=${oppId}&clubId=${clubId}`
        );
        if (!res.ok) throw new Error('Fehler beim Laden der Statistik');
        const json = (await res.json()) as HeadToHeadData;
        setData(json);
      } catch {
        setError('Direktvergleich konnte nicht geladen werden');
        setData(null);
      } finally {
        setLoadingData(false);
      }
    },
    [myUserId, clubId]
  );

  function handleOpponentChange(value: string) {
    setOpponentId(value);
    void loadH2H(value);
  }

  const opponent = members.find((m) => m.id === opponentId);

  const totalDecided = data ? data.myWins + data.opponentWins : 0;
  const myWinPct = totalDecided > 0 && data ? Math.round((data.myWins / totalDecided) * 100) : 0;
  const oppWinPct = totalDecided > 0 ? 100 - myWinPct : 0;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Swords className="h-4 w-4" />
          Direktvergleich
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-muted-foreground">Gegner auswählen</p>
          {loadingMembers ? (
            <div className="text-sm text-muted-foreground">Lade Mitglieder…</div>
          ) : (
            <Select value={opponentId} onValueChange={handleOpponentChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Mitglied auswählen…" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loadingData && (
          <div className="text-center text-sm text-muted-foreground">Lade Statistik…</div>
        )}

        {!loadingData && data && opponent && (
          <>
            <div className="grid grid-cols-3 items-center gap-2 rounded-lg border p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">{data.myWins}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Meine Siege</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Trophy className="h-5 w-5 text-warning-500" />
                <div className="text-xs font-medium text-muted-foreground">{data.total} Spiele</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">{data.opponentWins}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {opponent.full_name || opponent.email}
                </div>
              </div>
            </div>

            {totalDecided > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Siegquote (entschiedene Spiele)
                </div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-success-500 transition-all"
                    style={{ width: `${myWinPct}%` }}
                  />
                  <div
                    className="h-full bg-error-400 transition-all"
                    style={{ width: `${oppWinPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="text-success-600 dark:text-success-400">{myWinPct}% Ich</span>
                  <span className="text-error-500 dark:text-error-400">
                    {oppWinPct}% {opponent.full_name || opponent.email}
                  </span>
                </div>
              </div>
            )}

            {data.notPlayed > 0 && (
              <p className="text-xs text-muted-foreground">
                {data.notPlayed} Spiel{data.notPlayed !== 1 ? 'e' : ''} nicht ausgetragen / Walkover
              </p>
            )}

            {data.recentMatches.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  Letzte Begegnungen
                </div>
                <ul className="space-y-1.5">
                  {data.recentMatches.slice(0, 10).map((match) => (
                    <li
                      key={match.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            match.outcome === 'win' &&
                              'border-success-500 bg-success-50 text-success-700 dark:bg-success-900 dark:text-success-300',
                            match.outcome === 'loss' &&
                              'border-error-400 bg-error-50 text-error-700 dark:bg-error-900 dark:text-error-300',
                            match.outcome === 'draw' &&
                              'border-muted-foreground text-muted-foreground'
                          )}
                        >
                          {match.outcome === 'win'
                            ? 'Sieg'
                            : match.outcome === 'loss'
                              ? 'Niederlage'
                              : 'n.a.'}
                        </Badge>
                        <span className="text-muted-foreground">
                          {match.type === 'singles' ? 'Einzel' : 'Doppel'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {match.outcome !== 'draw' && (
                          <span className="tabular-nums font-medium">
                            {match.myScore}:{match.opponentScore}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(match.date)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.total === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Noch keine gemeinsamen Spiele vorhanden
              </p>
            )}
          </>
        )}

        {!loadingData && !data && !opponentId && !error && (
          <p className="text-center text-sm text-muted-foreground">
            Wähle einen Gegner um den Direktvergleich zu sehen
          </p>
        )}
      </CardContent>
    </Card>
  );
}
