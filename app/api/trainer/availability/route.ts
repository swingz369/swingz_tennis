/**
 * GET  /api/trainer/availability?trainerId=xxx&from=date&to=date
 * POST /api/trainer/availability — trainer sets available slot
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const { supabase } = auth;
    const sp = request.nextUrl.searchParams;
    const trainerId = sp.get('trainerId');
    const from = sp.get('from');
    const to = sp.get('to');

    let query = supabase
      .from('trainer_availabilities')
      .select(
        `id, trainer_id, date, start_time, end_time, status, notes,
         trainers(id, users(full_name, email))`
      )
      .in('status', ['available', 'booked']);

    if (trainerId) query = query.eq('trainer_id', trainerId);
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);

    query = query.order('date', { ascending: true }).order('start_time', { ascending: true });

    const { data, error } = await query;
    if (error) {
      console.error('trainer availability GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
    return NextResponse.json({ slots: data ?? [] });
  });
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) return forbiddenResponse('Only trainers can set availability');

    const { supabase, user } = auth;

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const { date, start_time, end_time, notes } = body;
    if (!date || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'date, start_time and end_time required' },
        { status: 400 }
      );
    }

    // Find trainer record for this user
    const { data: trainerRecord } = await supabase
      .from('trainers')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!trainerRecord) {
      return NextResponse.json({ error: 'No trainer profile found' }, { status: 404 });
    }

    // Check for overlap
    const { data: overlaps } = await supabase
      .from('trainer_availabilities')
      .select('id')
      .eq('trainer_id', user.id)
      .eq('date', date)
      .or(`and(start_time.lt.${end_time},end_time.gt.${start_time})`);

    if (overlaps && overlaps.length > 0) {
      return NextResponse.json({ error: 'Zeitkonflikt mit vorhandenem Slot' }, { status: 409 });
    }

    const { data: slot, error } = await supabase
      .from('trainer_availabilities')
      .insert({
        trainer_id: user.id,
        date,
        start_time,
        end_time,
        status: 'available',
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('trainer availability POST error:', error);
      return NextResponse.json({ error: 'Failed to create slot' }, { status: 500 });
    }

    return NextResponse.json({ slot }, { status: 201 });
  });
}
