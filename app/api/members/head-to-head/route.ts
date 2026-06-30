import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('members:head-to-head');

type MatchOutcome = 'home_won' | 'away_won' | 'not_played' | 'walkover';
type PositionType = 'singles' | 'doubles';

interface MatchResult {
  id: string;
  recorded_at: string;
  outcome: MatchOutcome;
  position_type: PositionType;
  home_player_ids: string[];
  away_player_ids: string[];
  home_sets_won: number;
  away_sets_won: number;
}

interface RecentMatch {
  id: string;
  date: string;
  outcome: 'win' | 'loss' | 'draw';
  myScore: number;
  opponentScore: number;
  type: PositionType;
}

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const myId = searchParams.get('myId');
    const opponentId = searchParams.get('opponentId');
    const clubId = searchParams.get('clubId');

    if (!myId || !opponentId || !clubId) {
      return NextResponse.json(
        { error: 'myId, opponentId und clubId sind erforderlich' },
        { status: 400 }
      );
    }

    if (myId === opponentId) {
      return NextResponse.json(
        { error: 'myId und opponentId müssen unterschiedlich sein' },
        { status: 400 }
      );
    }

    try {
      const sb = auth.supabase;

      const { data, error } = await sb
        .from('match_results')
        .select(
          'id, recorded_at, outcome, position_type, home_player_ids, away_player_ids, home_sets_won, away_sets_won'
        )
        .eq('club_id', clubId)
        .or(`home_player_ids.cs.{${myId}},away_player_ids.cs.{${myId}}`)
        .order('recorded_at', { ascending: false });

      if (error) {
        log.error('Datenbankfehler beim Laden der Spiele', error);
        return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 });
      }

      const matches = (data ?? []) as MatchResult[];

      const bothPlayers = matches.filter((m) => {
        const myOnHome = m.home_player_ids.includes(myId);
        const myOnAway = m.away_player_ids.includes(myId);
        const oppOnHome = m.home_player_ids.includes(opponentId);
        const oppOnAway = m.away_player_ids.includes(opponentId);
        return (myOnHome || myOnAway) && (oppOnHome || oppOnAway);
      });

      let myWins = 0;
      let opponentWins = 0;
      let notPlayed = 0;

      const recentMatches: RecentMatch[] = bothPlayers.map((m) => {
        const myOnHome = m.home_player_ids.includes(myId);

        if (m.outcome === 'not_played' || m.outcome === 'walkover') {
          notPlayed++;
          return {
            id: m.id,
            date: m.recorded_at,
            outcome: 'draw' as const,
            myScore: 0,
            opponentScore: 0,
            type: m.position_type,
          };
        }

        const iWon =
          (m.outcome === 'home_won' && myOnHome) || (m.outcome === 'away_won' && !myOnHome);

        if (iWon) {
          myWins++;
        } else {
          opponentWins++;
        }

        const myScore = myOnHome ? m.home_sets_won : m.away_sets_won;
        const opponentScore = myOnHome ? m.away_sets_won : m.home_sets_won;

        return {
          id: m.id,
          date: m.recorded_at,
          outcome: iWon ? ('win' as const) : ('loss' as const),
          myScore,
          opponentScore,
          type: m.position_type,
        };
      });

      return NextResponse.json({
        myWins,
        opponentWins,
        notPlayed,
        total: bothPlayers.length,
        recentMatches,
      });
    } catch (error) {
      log.error('Unerwarteter Fehler im Head-to-Head', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
    }
  });
}
