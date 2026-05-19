import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin access required');
    const seasonId = new URL(request.url).searchParams.get('seasonId');
    let query = (auth.supabase.from('training_groups') as any)
      .select('*')
      .eq('club_id', auth.clubId);
    if (seasonId) query = query.eq('season_id', seasonId);
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  });
}

export async function POST(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin access required');
    const body = await request.json();
    const { name, level, age_group, schedule_id, max_participants } = body;
    if (!name || !level)
      return NextResponse.json({ error: 'name and level required' }, { status: 400 });
    const { data, error } = await (auth.supabase.from('training_groups') as any)
      .insert({
        name,
        level,
        age_group,
        schedule_id,
        max_participants,
        club_id: auth.clubId,
        is_active: true,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  });
}
