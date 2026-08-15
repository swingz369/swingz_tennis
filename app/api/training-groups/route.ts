import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

async function findOrCreateSchedule(
  supabase: any,
  season: {
    id: string;
    club_id: string;
    season_type: string;
    year: number;
    start_date: string;
    end_date: string;
  }
): Promise<{ scheduleId: string; error: Error | null }> {
  const { data: existing } = await supabase
    .from('schedules')
    .select('id')
    .eq('club_id', season.club_id)
    .eq('season_type', season.season_type)
    .eq('season_year', season.year)
    .limit(1);
  if (existing?.[0]?.id) return { scheduleId: existing[0].id, error: null };
  const { data: created, error: createErr } = await supabase
    .from('schedules')
    .insert({
      club_id: season.club_id,
      season_type: season.season_type,
      season_year: season.year,
      season_start_date: season.start_date,
      season_end_date: season.end_date,
      is_active: true,
    })
    .select('id')
    .single();
  if (createErr)
    return { scheduleId: '', error: new Error(`Failed to create schedule: ${createErr.message}`) };
  return { scheduleId: created.id, error: null };
}

export async function GET(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Zugriff nur für Admins');
    const { data, error } = await (auth.supabase.from('training_groups') as any)
      .select('*')
      .eq('club_id', auth.clubId)
      .order('created_at', { ascending: true });
    if (error) return internalErrorResponse();
    return NextResponse.json(data);
  });
}

export async function POST(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Zugriff nur für Admins');
    const body = await request.json();
    const { name, level, age_group, season_id } = body;
    if (!name || !level)
      return NextResponse.json({ error: 'name and level required' }, { status: 400 });
    if (!season_id) return NextResponse.json({ error: 'season_id required' }, { status: 400 });

    const { data: season, error: seasonErr } = await (auth.supabase.from('seasons') as any)
      .select('id, club_id, season_type, year, start_date, end_date')
      .eq('id', season_id)
      .single();
    if (seasonErr || !season)
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });

    if (season.club_id !== auth.clubId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { scheduleId, error: scheduleErr } = await findOrCreateSchedule(auth.supabase, season);
    if (scheduleErr) return internalErrorResponse();

    const { data, error } = await (auth.supabase.from('training_groups') as any)
      .insert({
        club_id: auth.clubId,
        schedule_id: scheduleId,
        name,
        level,
        age_group: age_group || 'senior',
        is_active: true,
      })
      .select()
      .single();
    if (error) return internalErrorResponse();
    return NextResponse.json(data, { status: 201 });
  });
}
