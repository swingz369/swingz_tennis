import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const { supabase, user } = auth;

    // Get user points
    const { data: pointsData } = await (supabase as any)
      .from('gamification_points')
      .select('points')
      .eq('user_id', user.id)
      .maybeSingle();

    // Get user badges
    const { data: badges } = await (supabase as any)
      .from('gamification_badges')
      .select('id, name, description, icon, earned_at')
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false });

    // Get streak
    const { data: streakData } = await (supabase as any)
      .from('attendance_records')
      .select('created_at')
      .eq('participant_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    let streak = 0;
    if (streakData) {
      const dateStrings = streakData.map((r: any) => new Date(r.created_at).toDateString());
      const uniqueDates = ([...new Set(dateStrings)] as string[]).sort().reverse();
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
        streak = 1;
        for (let i = 1; i < uniqueDates.length; i++) {
          const prev = new Date(uniqueDates[i - 1]);
          const curr = new Date(uniqueDates[i]);
          if ((prev.getTime() - curr.getTime()) / 86400000 <= 1.5) streak++;
          else break;
        }
      }
    }

    // Get leaderboard (top 10)
    const { data: leaderboard } = await (supabase as any)
      .from('gamification_points')
      .select('user_id, points, users(full_name)')
      .order('points', { ascending: false })
      .limit(10);

    const leaderboardEntries = ((leaderboard || []) as any[]).map((e: any, i: number) => ({
      rank: i + 1,
      name: (e.users as any)?.full_name || 'Unbekannt',
      points: e.points || 0,
      badgeCount: 0,
      streak: 0,
    }));

    return NextResponse.json({
      points: pointsData?.points || 0,
      badges: (badges || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        icon: b.icon,
        earnedAt: b.earned_at,
      })),
      streak,
      leaderboard: leaderboardEntries,
    });
  });
}
