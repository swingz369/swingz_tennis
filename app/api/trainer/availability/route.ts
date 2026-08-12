/**
 * GET  /api/trainer/availability?trainerId=xxx&from=date&to=date
 * POST /api/trainer/availability — trainer sets available slot
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trainer:availability');

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
         trainers(id, name, email)`
      )
      .in('status', ['available', 'booked']);

    if (trainerId) query = query.eq('trainer_id', trainerId);
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);

    query = query.order('date', { ascending: true }).order('start_time', { ascending: true });

    const { data, error } = await query;
    if (error) {
      // RLS blocks non-trainer/non-superadmin users — return empty instead of 500
      log.warn('trainer availability GET (likely RLS):', error.message);
      return NextResponse.json({ slots: [], maxHoursPerWeek: null });
    }

    // Auflösung über `trainers.user_id` — wie im POST dieser Datei und wie im
    // Admin-Pfad (`trainerProfileService.getTrainerProfileByUserId`). Vorher
    // suchte ausgerechnet dieses GET über `trainers.email` (ilike): Sobald eine
    // E-Mail-Adresse geändert wird oder zwei Trainerzeilen dieselbe Adresse
    // tragen, zeigten Selbstansicht und Adminansicht verschiedene Daten für
    // denselben Trainer.
    const { data: trainerRecord } = await supabase
      .from('trainers')
      .select('max_hours_per_week')
      .eq('user_id', auth.user.id)
      .maybeSingle();

    return NextResponse.json({
      slots: data ?? [],
      maxHoursPerWeek: trainerRecord?.max_hours_per_week ?? null,
    });
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

    // Find trainer record for this user (trainers.id ≠ users.id — join via user_id)
    const { data: trainerRecord } = await supabase
      .from('trainers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!trainerRecord) {
      return NextResponse.json({ error: 'No trainer profile found' }, { status: 404 });
    }

    // Check for overlap using the correct trainer record id
    const { data: overlaps } = await supabase
      .from('trainer_availabilities')
      .select('id')
      .eq('trainer_id', trainerRecord.id)
      .eq('date', date)
      .or(`and(start_time.lt.${end_time},end_time.gt.${start_time})`);

    if (overlaps && overlaps.length > 0) {
      return NextResponse.json({ error: 'Zeitkonflikt mit vorhandenem Slot' }, { status: 409 });
    }

    const { data: slot, error } = await supabase
      .from('trainer_availabilities')
      .insert({
        trainer_id: trainerRecord.id,
        date,
        start_time,
        end_time,
        status: 'available',
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) {
      log.error('trainer availability POST error:', error);
      return NextResponse.json({ error: 'Failed to create slot' }, { status: 500 });
    }

    return NextResponse.json({ slot }, { status: 201 });
  });
}
