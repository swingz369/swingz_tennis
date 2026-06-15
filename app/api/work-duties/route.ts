import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * GET /api/work-duties — List work duties for the club
 * POST /api/work-duties — Create a new work duty
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Authentication required');

    const clubId = auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'No club' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = (auth.supabase as any)
      .from('work_duties')
      .select('*, work_duty_assignments(id, member_id, status, completed_at)')
      .eq('club_id', clubId)
      .order('scheduled_date', { ascending: true, nullsFirst: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[WorkDuties GET] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch duties' }, { status: 500 });
    }

    return NextResponse.json({ duties: data ?? [] });
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
      title,
      description,
      duty_type,
      scheduled_date,
      start_time,
      end_time,
      max_participants,
      priority,
      notes,
    } = body;

    if (!title || !duty_type) {
      return NextResponse.json({ error: 'Title and duty type required' }, { status: 400 });
    }

    const { data, error } = await (auth.supabase as any)
      .from('work_duties')
      .insert({
        club_id: clubId,
        title,
        description: description ?? null,
        duty_type,
        scheduled_date: scheduled_date ?? null,
        start_time: start_time ?? null,
        end_time: end_time ?? null,
        max_participants: max_participants ?? 1,
        priority: priority ?? 'medium',
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('[WorkDuties POST] Error:', error);
      return NextResponse.json({ error: 'Failed to create duty' }, { status: 500 });
    }

    return NextResponse.json({ duty: data }, { status: 201 });
  });
}
