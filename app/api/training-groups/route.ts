import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:training-groups');

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
): Promise<{ scheduleId: string; failure: Error | null }> {
  const { data: existing } = await supabase
    .from('schedules')
    .select('id')
    .eq('club_id', season.club_id)
    .eq('season_type', season.season_type)
    .eq('season_year', season.year)
    .limit(1);
  if (existing?.[0]?.id) return { scheduleId: existing[0].id, failure: null };
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
  if (createErr) return { scheduleId: '', failure: new Error(createErr.message) };
  return { scheduleId: created.id, failure: null };
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
      return NextResponse.json({ error: 'Name und Level erforderlich' }, { status: 400 });
    if (!season_id) return NextResponse.json({ error: 'season_id erforderlich' }, { status: 400 });

    const { data: season, error: seasonErr } = await (auth.supabase.from('seasons') as any)
      .select('id, club_id, season_type, year, start_date, end_date')
      .eq('id', season_id)
      .single();
    if (seasonErr || !season)
      return NextResponse.json({ error: 'Saison nicht gefunden' }, { status: 404 });

    if (season.club_id !== auth.clubId)
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });

    const { scheduleId, failure: scheduleErr } = await findOrCreateSchedule(auth.supabase, season);
    if (scheduleErr) {
      // Der Originalfehler ging bisher ersatzlos verloren — internalErrorResponse()
      // sagt dem Nutzer zu Recht nichts, dem Log aber auch nicht.
      log.error('Trainingsplan konnte nicht angelegt werden', scheduleErr);
      return internalErrorResponse();
    }

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
