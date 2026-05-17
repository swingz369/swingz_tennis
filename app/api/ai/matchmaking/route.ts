import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * KI Matchmaking API
 * Suggests compatible training partners based on playing level, availability, and location
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: membership } = await supabase
      .from('user_club_memberships')
      .select('club_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) return NextResponse.json({ error: 'No active membership' }, { status: 404 });

    const myLevel = 'intermediate'; // Default level - extend with actual level tracking
    const myCity = null; // TODO: Add city field to users table

    // Find compatible members (same club, similar level)
    const { data: members } = await supabase
      .from('user_club_memberships')
      .select('user_id, users(full_name, email)')
      .eq('club_id', membership.club_id!)
      .eq('is_active', true)
      .neq('user_id', user.id);

    if (!members || members.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // Level compatibility mapping
    const levelOrder = ['beginner', 'advanced_beginner', 'intermediate', 'advanced', 'tournament'];
    const myLevelIdx = levelOrder.indexOf(myLevel);

    const matches = members!
      .map((m: any) => {
        const memberLevel = 'intermediate'; // TODO: Extend users table with playing_level
        const memberLevelIdx = levelOrder.indexOf(memberLevel);
        const levelDiff = Math.abs(myLevelIdx - memberLevelIdx);

        // Score: lower level diff = better match
        let score = 100 - levelDiff * 20;

        // Bonus for same city
        if (myCity && m.users?.city === myCity) score += 10;

        return {
          userId: m.user_id,
          name: m.users?.full_name || 'Unbekannt',
          email: m.users?.email || '',
          playingLevel: memberLevel,
          city: null, // TODO: Add city field to users table
          compatibilityScore: Math.min(100, Math.max(0, score)),
          levelDiff,
        };
      })
      .filter((m: any) => m.compatibilityScore >= 60)
      .sort((a: any, b: any) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 10);

    return NextResponse.json({ matches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
