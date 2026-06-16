import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trainer-absences');

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) return forbiddenResponse('Insufficient permissions');

    const { supabase, user } = auth;

    const body = await request.json();
    const { trainer_id, club_id, start_date, end_date, reason, substitute_trainer_id } = body;

    // Validate required fields
    if (!trainer_id || !club_id || !start_date || !end_date || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // If trainer role, can only manage own absences
    if (auth.role === 'trainer' && trainer_id !== user.id) {
      return NextResponse.json({ error: 'Can only manage own absences' }, { status: 403 });
    }

    // Validate dates
    if (start_date > end_date) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 });
    }

    // Check for overlapping absences
    const { data: overlaps } = await (supabase as any)
      .from('trainer_absences')
      .select('id')
      .eq('trainer_id', trainer_id)
      .or(`and(start_date.lte.${end_date},end_date.gte.${start_date})`);

    if (overlaps && overlaps.length > 0) {
      return NextResponse.json({ error: 'Overlapping absence period detected' }, { status: 409 });
    }

    // Create absence
    const { data: absence, error } = await (supabase as any)
      .from('trainer_absences')
      .insert({
        trainer_id,
        club_id,
        start_date,
        end_date,
        reason,
        substitute_trainer_id: substitute_trainer_id || null,
      })
      .select()
      .single();

    if (error) {
      log.error('Error creating absence:', error);
      return NextResponse.json({ error: 'Failed to create absence' }, { status: 500 });
    }

    return NextResponse.json({ absence }, { status: 201 });
  });
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth) => {
    const { supabase } = auth;

    const searchParams = request.nextUrl.searchParams;
    const trainerId = searchParams.get('trainer_id');
    const clubId = searchParams.get('club_id');

    // Build query
    let query = (supabase as any).from('trainer_absences').select('*');

    if (trainerId) {
      query = query.eq('trainer_id', trainerId);
    }

    if (clubId) {
      query = query.eq('club_id', clubId);
    }

    // Only future/current absences
    query = query.gte('end_date', new Date().toISOString().split('T')[0]);

    const { data: absences, error } = await query.order('start_date', { ascending: true });

    if (error) {
      log.error('Error fetching absences:', error);
      return NextResponse.json({ error: 'Failed to fetch absences' }, { status: 500 });
    }

    return NextResponse.json({ absences: absences || [] });
  });
}
