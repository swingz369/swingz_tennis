import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Minus } from 'lucide-react';

interface Props {
  userId: string;
  clubId: string;
}

export async function SeasonStatsCard({ userId, clubId }: Props) {
  const sb = createServiceClient();
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const { data: results } = await sb
    .from('match_results')
    .select('outcome, home_player_ids, away_player_ids')
    .eq('club_id', clubId)
    .gte('recorded_at', yearStart)
    .or(`home_player_ids.cs.{${userId}},away_player_ids.cs.{${userId}}`);

  let wins = 0;
  let losses = 0;

  for (const r of results ?? []) {
    if (r.outcome === 'not_played' || r.outcome === 'walkover') continue;
    const inHome = (r.home_player_ids as string[]).includes(userId);
    const won = (r.outcome === 'home_won' && inHome) || (r.outcome === 'away_won' && !inHome);
    if (won) wins++;
    else losses++;
  }

  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-warning-500" />
          Saison {new Date().getFullYear()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Mannschaftsspiele in dieser Saison.
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-success-600">{wins}</p>
              <p className="text-xs text-muted-foreground">Siege</p>
            </div>
            <Minus className="h-4 w-4 text-muted-foreground" />
            <div className="text-center">
              <p className="text-2xl font-bold text-error-500">{losses}</p>
              <p className="text-xs text-muted-foreground">Niederlagen</p>
            </div>
            <div className="ml-auto">
              {winRate !== null && (
                <Badge
                  variant="secondary"
                  className={`gap-1 ${winRate >= 50 ? 'text-success-700 bg-success-100' : 'text-muted-foreground'}`}
                >
                  <TrendingUp className="h-3 w-3" />
                  {winRate} % Siege
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
