import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:leagues:[id]:matchdays');

/**
 * GET /api/leagues/[id]/matchdays — List match days for a league
 * POST /api/leagues/[id]/matchdays — Create a new match day
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Authentication required');

    const { id } = await params;

    const { data: matchDays, error } = await (auth.supabase as any)
      .from('match_days')
      .select('*')
      .eq('league_id', id)
      .order('matchday_number', { ascending: true });

    if (error) {
      log.error('[MatchDays GET] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch match days' }, { status: 500 });
    }

    return NextResponse.json({ match_days: matchDays ?? [] });
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin access required');

    const { id } = await params;
    const body = await request.json();
    const { matchday_number, scheduled_date, opponent, is_home, venue, notes } = body;

    if (!matchday_number || !opponent) {
      return NextResponse.json({ error: 'Matchday number and opponent required' }, { status: 400 });
    }

    // Verify league belongs to club
    const { data: league } = await (auth.supabase as any)
      .from('leagues')
      .select('id')
      .eq('id', id)
      .eq('club_id', auth.clubId)
      .single();

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    const { data, error } = await (auth.supabase as any)
      .from('match_days')
      .insert({
        league_id: id,
        matchday_number,
        scheduled_date: scheduled_date ?? null,
        opponent,
        is_home: is_home ?? true,
        venue: venue ?? null,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) {
      log.error('[MatchDays POST] Error:', error);
      return NextResponse.json({ error: 'Failed to create match day' }, { status: 500 });
    }

    // F4.3: Heimspiel → Catering-Eintrag automatisch anlegen (non-fatal)
    if ((is_home ?? true) && data?.id && auth.clubId) {
      void (async () => {
        try {
          const sb = createServiceClient();
          await (sb as any)
            .from('match_caterings')
            .upsert(
              { match_day_id: data.id, club_id: auth.clubId, status: 'not_planned' },
              { onConflict: 'match_day_id', ignoreDuplicates: true }
            );
        } catch (hookErr) {
          log.error(
            '[MatchDays POST] Catering-Hook fehlgeschlagen',
            hookErr instanceof Error ? hookErr : undefined
          );
        }
      })();
    }

    return NextResponse.json({ match_day: data }, { status: 201 });
  });
}
