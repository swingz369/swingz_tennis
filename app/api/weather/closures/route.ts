import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * GET /api/weather/closures — List court closures for the club
 * POST /api/weather/closures — Create a new court closure
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Authentication required');

    const clubId = auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'No club' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    let query = (auth.supabase as any)
      .from('court_closures')
      .select('*, courts(name, surface)')
      .eq('club_id', clubId)
      .order('start_date', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Closures GET] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch closures' }, { status: 500 });
    }

    return NextResponse.json({ closures: data ?? [] });
  });
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin access required');

    const clubId = auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'No club' }, { status: 400 });

    const body = await request.json();
    const {
      court_id,
      reason,
      description,
      start_date,
      end_date,
      weather_condition,
      auto_generated,
    } = body;

    if (!court_id || !reason || !start_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await (auth.supabase as any)
      .from('court_closures')
      .insert({
        club_id: clubId,
        court_id,
        reason,
        description: description ?? null,
        start_date,
        end_date: end_date ?? null,
        weather_condition: weather_condition ?? null,
        auto_generated: auto_generated ?? false,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[Closures POST] Error:', error);
      return NextResponse.json({ error: 'Failed to create closure' }, { status: 500 });
    }

    return NextResponse.json({ closure: data }, { status: 201 });
  });
}
