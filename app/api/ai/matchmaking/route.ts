import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface MatchCandidate {
  userId: string;
  name: string;
  email: string;
  playingLevel: string;
  compatibilityScore: number;
  groupOverlap: string[];
  commonSessions: number;
  levelDiff: number;
  reasons: string[];
}

/**
 * KI Matchmaking API v2
 * Multi-dimensional matching: Level + Gruppen + gemeinsame Sessions
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('user_club_memberships')
      .select('club_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'No active membership' }, { status: 404 });
    }

    const clubId = membership.club_id!;

    // ── 1. Current user profile ──
    const { data: myProfile } = await supabase
      .from('users')
      .select('skill_level')
      .eq('id', user.id)
      .single() as { data: { skill_level?: string | null } | null };

    const myLevel = myProfile?.skill_level || 'beginner';

    // ── 2. My group memberships ──
    const { data: myGroups } = await supabase
      .from('groups')
      .select('id, name, level')
      .contains('member_ids', [user.id])
      .eq('club_id', clubId)
      .eq('is_active', true) as { data: { id: string; name: string; level: string | null }[] | null };

    const myGroupIds = new Set(myGroups?.map((g) => g.id) ?? []);
    const myGroupLevels = new Set(
      (myGroups ?? []).map((g) => g.level).filter((l): l is string => l !== null)
    );

    // ── 3. My recent session bookings (for common session overlap) ──
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: myBookings } = await supabase
      .from('bookings')
      .select('session_id')
      .eq('member_id', user.id)
      .gte('booked_at', thirtyDaysAgo) as { data: { session_id?: string | null }[] | null };

    const mySessionIds = new Set(
      (myBookings ?? []).map((b) => b.session_id).filter((s): s is string => s !== null && s !== undefined)
    );

    // ── 4. Find candidates: active club members (excluding self) ──
    const { data: members } = await supabase
      .from('user_club_memberships')
      .select('user_id, users!inner(full_name, email, skill_level)')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .neq('user_id', user.id) as { data: Array<{
        user_id: string;
        users: { full_name?: string | null; email?: string | null; skill_level?: string | null };
      }> | null };

    if (!members || members.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const allMemberIds = members.map((m) => m.user_id);

    // ── 5. Batch: Load ALL groups for this club ──
    const { data: allGroups } = await supabase
      .from('groups')
      .select('id, name, level, member_ids')
      .eq('club_id', clubId)
      .eq('is_active', true) as { data: { id: string; name: string; level: string | null; member_ids: string[] }[] | null };

    // ── 6. Batch: Load common session attendance ──
    const { data: candidateBookings } = await supabase
      .from('bookings')
      .select('member_id, session_id')
      .in('member_id', allMemberIds)
      .gte('booked_at', thirtyDaysAgo) as { data: { member_id?: string | null; session_id?: string | null }[] | null };

    // Build member -> session_ids map
    const memberSessionMap = new Map<string, Set<string>>();
    for (const b of candidateBookings ?? []) {
      if (!b.member_id || !b.session_id) continue;
      if (!memberSessionMap.has(b.member_id)) {
        memberSessionMap.set(b.member_id, new Set());
      }
      memberSessionMap.get(b.member_id)!.add(b.session_id);
    }

    // ── 7. Scoring ──
    const levelOrder = ['beginner', 'advanced_beginner', 'intermediate', 'advanced', 'tournament'];
    const myLevelIdx = levelOrder.indexOf(myLevel);

    const matches: MatchCandidate[] = [];

    for (const m of members) {
      const memberId = m.user_id;
      const memberLevel = m.users?.skill_level || 'beginner';
      const memberLevelIdx = levelOrder.indexOf(memberLevel);
      const levelDiff = Math.abs(myLevelIdx - memberLevelIdx);

      // ═══ Score Dimension 1: Level (0-40 points) ═══
      let levelScore = Math.max(0, 40 - levelDiff * 10);

      // ═══ Score Dimension 2: Group overlap (0-30 points) ═══
      let groupOverlap: string[] = [];
      let groupScore = 0;

      if (allGroups) {
        for (const group of allGroups) {
          const memberIds = Array.isArray(group.member_ids) ? group.member_ids : [];
          const isMyGroup = myGroupIds.has(group.id);
          const isTheirGroup = memberIds.includes(memberId);

          if (isMyGroup && isTheirGroup) {
            groupOverlap.push(group.name);
          }
        }
      }
      groupScore = Math.min(30, groupOverlap.length * 15);

      // ═══ Score Dimension 3: Common sessions (0-20 points) ═══
      const theirSessions = memberSessionMap.get(memberId) ?? new Set();
      let commonSessions = 0;
      for (const sid of mySessionIds) {
        if (theirSessions.has(sid)) commonSessions++;
      }
      const sessionScore = Math.min(20, commonSessions * 10);

      // ═══ Score Dimension 4: Same level group (0-10 points bonus) ═══
      let sameLevelGroupBonus = 0;
      if (myGroupLevels.has(memberLevel) && memberLevel !== 'beginner') {
        sameLevelGroupBonus = 10;
      }

      const totalScore = levelScore + groupScore + sessionScore + sameLevelGroupBonus;

      // Build reasons
      const reasons: string[] = [];
      if (levelDiff === 0) reasons.push('Gleiches Spielniveau');
      else if (levelDiff <= 1) reasons.push('Ähnliches Spielniveau');
      if (groupOverlap.length > 0) reasons.push(`${groupOverlap.length} gemeinsame Gruppe(n)`);
      if (commonSessions > 0) reasons.push(`${commonSessions} gemeinsame Trainingseinheit(en)`);
      if (reasons.length === 0) reasons.push('Im gleichen Verein');

      if (totalScore >= 40) {
        matches.push({
          userId: memberId,
          name: m.users?.full_name || 'Unbekannt',
          email: m.users?.email || '',
          playingLevel: memberLevel,
          compatibilityScore: Math.min(100, totalScore),
          groupOverlap,
          commonSessions,
          levelDiff,
          reasons,
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    return NextResponse.json({
      matches: matches.slice(0, 10),
      totalMembers: members.length,
      myLevel,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Matchmaking error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
