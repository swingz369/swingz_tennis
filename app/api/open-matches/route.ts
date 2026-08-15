/**
 * Open Matches API
 *
 * GET    /api/open-matches          — List open matches for club
 * POST   /api/open-matches          — Create a new open match
 * PATCH  /api/open-matches          — Join or leave a match
 * DELETE /api/open-matches?id=xxx   — Cancel own match
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:open-matches');

// ─── GET /api/open-matches?clubId=xxx ─────────────────────────────────

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Anmeldung erforderlich');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    const clubId = url.searchParams.get('clubId');
    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    const status = url.searchParams.get('status') || 'open';
    const limit = Math.min(
      50,
      Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20)
    );

    const supabase = auth.supabase;

    // Fetch matches with creator info
    const { data: matches, error } = await (supabase as any)
      .from('open_matches')
      .select(
        `
        id, club_id, creator_id, court_id, title, description,
        match_date, start_time, end_time, skill_level, match_type,
        max_players, current_players, status, is_public, created_at,
        courts(name)
      `
      )
      .eq('club_id', clubId)
      .eq('status', status)
      .gte('match_date', new Date().toISOString().substring(0, 10))
      .order('match_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(limit);

    if (error) {
      log.error('[OpenMatches GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch creator names and current user's participation
    const creatorIds = [
      ...new Set((matches ?? []).map((m: { creator_id: string }) => m.creator_id)),
    ];
    const matchIds = (matches ?? []).map((m: { id: string }) => m.id);

    const [usersResult, participantsResult, myParticipationResult] = await Promise.all([
      creatorIds.length > 0
        ? (supabase as any).from('users').select('id, full_name').in('id', creatorIds)
        : { data: [] },
      matchIds.length > 0
        ? (supabase as any)
            .from('open_match_participants')
            .select('match_id, user_id, role, status')
            .in('match_id', matchIds)
            .eq('status', 'joined')
        : { data: [] },
      matchIds.length > 0
        ? (supabase as any)
            .from('open_match_participants')
            .select('match_id, status')
            .in('match_id', matchIds)
            .eq('user_id', auth.user.id)
            .eq('status', 'joined')
        : { data: [] },
    ]);

    const userMap = new Map<string, string>();
    ((usersResult.data ?? []) as Array<{ id: string; full_name: string | null }>).forEach((u) => {
      userMap.set(u.id, u.full_name || 'Mitglied');
    });

    const participantMap = new Map<string, string[]>();
    ((participantsResult.data ?? []) as Array<{ match_id: string; user_id: string }>).forEach(
      (p) => {
        const names = participantMap.get(p.match_id) ?? [];
        names.push(userMap.get(p.user_id) ?? 'Mitglied');
        participantMap.set(p.match_id, names);
      }
    );

    const myJoinedMatches = new Set(
      ((myParticipationResult.data ?? []) as Array<{ match_id: string }>).map((p) => p.match_id)
    );

    const enriched = (matches ?? []).map(
      (
        m: Record<string, unknown> & {
          id: string;
          creator_id: string;
          courts?: { name: string } | { name: string }[] | null;
        }
      ) => {
        const court = Array.isArray(m.courts) ? m.courts[0] : m.courts;
        return {
          ...m,
          courtName: court?.name ?? null,
          creatorName: userMap.get(m.creator_id) ?? 'Mitglied',
          participantNames: participantMap.get(m.id) ?? [],
          joinedByUser: myJoinedMatches.has(m.id),
        };
      }
    );

    return NextResponse.json({ matches: enriched });
  });
}

// ─── POST /api/open-matches ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Anmeldung erforderlich');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const {
      clubId,
      title,
      description,
      matchDate,
      startTime,
      endTime,
      skillLevel,
      matchType,
      maxPlayers,
      courtId,
    } = body;

    if (!clubId || !title || !matchDate || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'clubId, title, matchDate, startTime, endTime are required' },
        { status: 400 }
      );
    }

    // Validate date is in the future
    const matchDateTime = new Date(`${matchDate}T${startTime}:00`);
    if (matchDateTime <= new Date()) {
      return NextResponse.json({ error: 'Match must be in the future' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Create the match
    const { data: match, error } = await serviceClient
      .from('open_matches')
      .insert({
        club_id: clubId,
        creator_id: auth.user.id,
        court_id: courtId || null,
        title: title.trim(),
        description: description?.trim() || null,
        match_date: matchDate,
        start_time: startTime,
        end_time: endTime,
        skill_level: skillLevel || 'all',
        match_type: matchType || 'singles',
        max_players: maxPlayers || 2,
        current_players: 1,
        status: 'open',
        is_public: true,
      })
      .select('id')
      .single();

    if (error) {
      log.error('[OpenMatches POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-add creator as participant
    await serviceClient.from('open_match_participants').insert({
      match_id: match.id,
      user_id: auth.user.id,
      role: 'creator',
      status: 'joined',
    });

    return NextResponse.json({ success: true, matchId: match.id }, { status: 201 });
  });
}

// ─── PATCH /api/open-matches ──────────────────────────────────────────
// Actions: join, leave

export async function PATCH(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Anmeldung erforderlich');

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const { matchId, action } = body;
    if (!matchId || !action) {
      return NextResponse.json({ error: 'matchId and action required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    if (action === 'join') {
      // Check match exists and is open
      const { data: match } = await serviceClient
        .from('open_matches')
        .select('id, status, current_players, max_players')
        .eq('id', matchId)
        .single();

      if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
      if (match.status !== 'open')
        return NextResponse.json({ error: 'Match is not open' }, { status: 409 });
      if (match.current_players >= match.max_players) {
        return NextResponse.json({ error: 'Match is full' }, { status: 409 });
      }

      // Check not already joined
      const { data: existing } = await serviceClient
        .from('open_match_participants')
        .select('id, status')
        .eq('match_id', matchId)
        .eq('user_id', auth.user.id)
        .maybeSingle();

      if (existing && existing.status === 'joined') {
        return NextResponse.json({ error: 'Already joined' }, { status: 409 });
      }

      // Join (or re-join after leaving)
      if (existing) {
        await serviceClient
          .from('open_match_participants')
          .update({ status: 'joined' })
          .eq('id', existing.id);
      } else {
        await serviceClient.from('open_match_participants').insert({
          match_id: matchId,
          user_id: auth.user.id,
          role: 'player',
          status: 'joined',
        });
      }

      // Update current_players count
      const newCount = match.current_players + 1;
      const newStatus = newCount >= match.max_players ? 'full' : 'open';
      await serviceClient
        .from('open_matches')
        .update({ current_players: newCount, status: newStatus })
        .eq('id', matchId);

      return NextResponse.json({ success: true, currentPlayers: newCount, status: newStatus });
    }

    if (action === 'leave') {
      // Can't leave if you're the creator
      const { data: match } = await serviceClient
        .from('open_matches')
        .select('id, creator_id, current_players, status')
        .eq('id', matchId)
        .single();

      if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
      if (match.creator_id === auth.user.id) {
        return NextResponse.json(
          { error: 'Creator cannot leave — cancel the match instead' },
          { status: 409 }
        );
      }

      // Mark as left
      await serviceClient
        .from('open_match_participants')
        .update({ status: 'left' })
        .eq('match_id', matchId)
        .eq('user_id', auth.user.id)
        .eq('status', 'joined');

      // Update count
      const newCount = Math.max(0, match.current_players - 1);
      await serviceClient
        .from('open_matches')
        .update({ current_players: newCount, status: 'open' })
        .eq('id', matchId);

      return NextResponse.json({ success: true, currentPlayers: newCount });
    }

    return NextResponse.json({ error: 'Unknown action. Use "join" or "leave"' }, { status: 400 });
  });
}

// ─── DELETE /api/open-matches?id=xxx ──────────────────────────────────

export async function DELETE(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Anmeldung erforderlich');

    const matchId = new URL(req.url).searchParams.get('id');
    if (!matchId) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const serviceClient = createServiceClient();

    // Only creator can cancel
    const { data: match } = await serviceClient
      .from('open_matches')
      .select('id, creator_id')
      .eq('id', matchId)
      .single();

    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (match.creator_id !== auth.user.id) {
      return NextResponse.json({ error: 'Only the creator can cancel' }, { status: 403 });
    }

    await serviceClient.from('open_matches').update({ status: 'cancelled' }).eq('id', matchId);

    return NextResponse.json({ success: true });
  });
}
