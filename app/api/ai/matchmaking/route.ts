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

    // Load current user's playing level from profile
    const { data: myProfile } = await supabase
      .from('users')
      .select('skill_level')
      .eq('id', user.id)
      .single() as { data: { skill_level?: string } | null; error: unknown };

    const myLevel = myProfile?.skill_level || 'beginner';
    // NOTE: city field not yet available on users table — location matching disabled for now

    // Find compatible members (same club, similar level)
    const { data: members } = await supabase
      .from('user_club_memberships')
      .select('user_id, users(full_name, email, skill_level)')
      .eq('club_id', membership.club_id!)
      .eq('is_active', true)
      .neq('user_id', user.id) as { data: Array<{
        user_id: string;
        users: { full_name?: string; email?: string; skill_level?: string } | null;
      }> | null; error: unknown };

    if (!members || members.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // Level compatibility mapping
    const levelOrder = ['beginner', 'advanced_beginner', 'intermediate', 'advanced', 'tournament'];
    const myLevelIdx = levelOrder.indexOf(myLevel);

    const matches = (members ?? [])
      .filter((m): m is typeof m & { users: NonNullable<typeof m.users> } => !!m.users)
      .map((m) => {
        const memberLevel = m.users.skill_level || 'beginner';
        const memberLevelIdx = levelOrder.indexOf(memberLevel);
        const levelDiff = Math.abs(myLevelIdx - memberLevelIdx);

        // Score: lower level diff = better match
        let score = 100 - levelDiff * 20;

        return {
          userId: m.user_id,
          name: m.users?.full_name || 'Unbekannt',
          email: m.users?.email || '',
          playingLevel: memberLevel,
          city: null, // Requires city field on users table
          compatibilityScore: Math.min(100, Math.max(0, score)),
          levelDiff,
        };
      })
      .filter((m) => m.compatibilityScore >= 60)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 10);

    return NextResponse.json({ matches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
