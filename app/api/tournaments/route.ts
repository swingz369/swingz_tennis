/**
 * GET  /api/tournaments — list tournaments for club
 * POST /api/tournaments — create tournament (admin only)
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const { supabase, clubId } = auth;
    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');

    let query = supabase.from('tournaments').select(
      `id, name, description, format, category, surface, max_participants,
         registration_deadline, start_date, end_date, status, prize_info, entry_fee,
         club_id, created_at,
         tournament_registrations(id)`
    );

    if (clubId) query = query.eq('club_id', clubId);
    if (status) query = query.eq('status', status);

    query = query.order('start_date', { ascending: true });

    const { data, error } = await query;
    if (error) {
      console.error('tournaments GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 });
    }

    const tournaments = (data ?? []).map((t: any) => ({
      ...t,
      participantCount: Array.isArray(t.tournament_registrations)
        ? t.tournament_registrations.length
        : 0,
      tournament_registrations: undefined,
    }));

    return NextResponse.json({ tournaments });
  });
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin access required');

    const { supabase, user, clubId } = auth;

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const {
      name,
      description,
      format,
      category,
      surface,
      max_participants,
      registration_deadline,
      start_date,
      end_date,
      status,
      prize_info,
      entry_fee,
    } = body;

    if (!name || !start_date) {
      return NextResponse.json({ error: 'name and start_date required' }, { status: 400 });
    }

    if (!clubId) {
      return NextResponse.json({ error: 'No club context' }, { status: 400 });
    }

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({
        club_id: clubId,
        name,
        description: description ?? null,
        format: format ?? 'single_elimination',
        category: category ?? 'open',
        surface: surface ?? null,
        max_participants: max_participants ?? 16,
        registration_deadline: registration_deadline ?? null,
        start_date,
        end_date: end_date ?? null,
        status: status ?? 'registration',
        prize_info: prize_info ?? null,
        entry_fee: entry_fee ?? 0,
        organizer_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('tournaments POST error:', error);
      return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 });
    }

    return NextResponse.json({ tournament }, { status: 201 });
  });
}
