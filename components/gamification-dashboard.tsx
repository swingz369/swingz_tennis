'use client';

import { KpiBand } from '@/components/ui/kpi-band';
import { PageHeader } from '@/components/ui/page-header';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Trophy, Star, Medal, Flame } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { createLogger } from '@/lib/logger';

const log = createLogger('gamification-dashboard');

interface Badge_ {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  badgeCount: number;
  streak: number;
}

export default function GamificationDashboard() {
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(0);
  const [badges, setBadges] = useState<Badge_[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    apiFetch('/api/gamification')
      .then((r) => {
        // 403 = Feature-Flag deaktiviert (`featureDisabledResponse`). Nicht
        // als „0 Punkte / 0 Badges“ verschleiern (Fail-open-Darstellung),
        // sondern ehrlich anzeigen, dass das Modul nicht gebucht ist.
        if (!r.ok) {
          setDisabled(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setPoints(data.points || 0);
        setBadges(data.badges || []);
        setLeaderboard(data.leaderboard || []);
        setStreak(data.streak || 0);
      })
      .catch((error) =>
        log.error(
          'Gamification-Daten konnten nicht geladen werden',
          error instanceof Error ? error : undefined
        )
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="space-y-5">
        <PageHeader title="Dein Fortschritt" description="Punkte, Badges & Rangliste" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Das Gamification-Modul ist für deinen Verein nicht aktiviert.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Dein Fortschritt" description="Punkte, Badges & Rangliste" />

      {/* Stats */}
      <KpiBand
        items={[
          {
            label: 'Punkte',
            value: points,
          },
          {
            label: 'Badges',
            value: badges.length,
          },
          {
            label: 'Streak',
            value: `${streak} Tage`,
          },
          {
            label: 'Rang',
            value: `#${leaderboard.find((e) => e.name === 'Du')?.rank || '-'}`,
          },
        ]}
      />

      {/* Badges */}
      {badges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Medal className="h-4 w-4 text-info-500" />
              Deine Badges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {badges.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col items-center text-center gap-1.5 p-3 rounded-xl bg-info-50"
                >
                  <span className="text-2xl">{b.icon}</span>
                  <span className="text-xs font-semibold line-clamp-1">{b.name}</span>
                  <span className="text-2xs text-muted-foreground line-clamp-2">
                    {b.description}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning-500" />
              Rangliste
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {leaderboard.slice(0, 10).map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  entry.name === 'Du'
                    ? 'bg-brand-light/10 border border-brand-light/20'
                    : 'hover:bg-muted dark:hover:bg-gray-900/50'
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    entry.rank === 1
                      ? 'bg-warning-100 text-warning-700'
                      : entry.rank === 2
                        ? 'bg-muted text-foreground'
                        : entry.rank === 3
                          ? 'bg-brand-accent-100 text-brand-accent-700'
                          : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {entry.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{entry.name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3" /> {entry.points}
                    </span>
                    <span className="flex items-center gap-1">
                      <Medal className="h-3 w-3" /> {entry.badgeCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame className="h-3 w-3" /> {entry.streak}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && badges.length === 0 && leaderboard.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Noch keine Daten – besuche regelmäßig Trainings um Punkte zu sammeln!
          </CardContent>
        </Card>
      )}
    </div>
  );
}
