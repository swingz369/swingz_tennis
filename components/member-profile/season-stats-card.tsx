import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiBand } from '@/components/ui/kpi-band';
import { Trophy } from 'lucide-react';

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
        <CardTitle className="font-semibold flex items-center gap-2">
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
          <KpiBand
            items={[
              { label: 'Siege', value: wins },
              { label: 'Niederlagen', value: losses },
              { label: 'Siegquote', value: `${winRate} %` },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
