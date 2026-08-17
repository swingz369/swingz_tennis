import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:leagues:[id]:caterings');

/**
 * GET /api/leagues/[id]/caterings — Bewirtungs-Einträge für alle Heimspieltage
 * POST /api/leagues/[id]/caterings — Catering-Eintrag anlegen/upserten
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Anmeldung erforderlich');

    const { id: leagueId } = await params;
    const sb = createServiceClient();

    // Fetch match_day IDs for this league (only home games)
    const { data: matchDays } = await (auth.supabase as ReturnType<typeof createServiceClient>)
      .from('match_days')
      .select('id')
      .eq('league_id', leagueId)
      .eq('is_home', true);

    const matchDayIds = (matchDays ?? []).map((m) => m.id);
    if (matchDayIds.length === 0) return NextResponse.json({ caterings: [] });

    const { data, error } = await sb
      .from('match_caterings')
      .select('*')
      .in('match_day_id', matchDayIds);

    if (error) {
      log.error('Failed to fetch caterings', error);
      return NextResponse.json({ error: 'Fehler beim Laden der Bewirtungsdaten' }, { status: 500 });
    }

    return NextResponse.json({ caterings: data ?? [] });
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin-Zugriff erforderlich');

    const { id: leagueId } = await params;
    const body = await request.json();
    const { match_day_id } = body as { match_day_id: string };

    if (!match_day_id) {
      return NextResponse.json({ error: 'match_day_id fehlt' }, { status: 400 });
    }

    // Verify match_day belongs to this league and club
    const { data: matchDay } = await (auth.supabase as ReturnType<typeof createServiceClient>)
      .from('match_days')
      .select('id, is_home')
      .eq('id', match_day_id)
      .eq('league_id', leagueId)
      .single();

    if (!matchDay) {
      return NextResponse.json({ error: 'Spieltag nicht gefunden' }, { status: 404 });
    }
    if (!matchDay.is_home) {
      return NextResponse.json({ error: 'Bewirtung nur für Heimspiele möglich' }, { status: 400 });
    }

    const sb = createServiceClient();
    const { data, error } = await sb
      .from('match_caterings')
      .upsert(
        { match_day_id, club_id: auth.clubId!, status: 'not_planned' },
        { onConflict: 'match_day_id', ignoreDuplicates: true }
      )
      .select()
      .single();

    if (error) {
      log.error('Failed to upsert catering', error);
      return NextResponse.json(
        { error: 'Fehler beim Erstellen des Bewirtungseintrags' },
        { status: 500 }
      );
    }

    return NextResponse.json({ catering: data }, { status: 201 });
  });
}
