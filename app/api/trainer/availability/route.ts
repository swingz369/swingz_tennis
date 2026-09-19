/**
 * GET  /api/trainer/availability?trainerId=xxx&from=date&to=date
 * POST /api/trainer/availability — trainer sets available slot
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import {
  resolveTrainerRecordId,
  resolveTrainerClubId,
  resolveClubTrainerRecordIds,
} from '@/lib/trainers/trainer-record';

const log = createLogger('api:trainer:availability');

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const sp = request.nextUrl.searchParams;
    const trainerId = sp.get('trainerId');
    const from = sp.get('from');
    const to = sp.get('to');

    // RLS lässt Mitglieder fremde Trainer-Slots nicht lesen (nur der Trainer
    // selbst oder ein Superadmin des Vereins). Der Service-Client umgeht das —
    // die Vereinsgrenze wird hier explizit geprüft statt auf RLS zu vertrauen.
    const supabase = createServiceClient();

    if (trainerId) {
      if (auth.clubId) {
        const trainerClubId = await resolveTrainerClubId(trainerId);
        if (!trainerClubId || trainerClubId !== auth.clubId) {
          return NextResponse.json({ slots: [], maxHoursPerWeek: null });
        }
      }
    } else {
      // Ohne trainerId früher ungefiltert über alle Trainer *aller* Vereine —
      // ein Mitglied, das den Kalender ohne Trainerauswahl öffnet, hätte fremde
      // Vereine mitgeladen. Ohne club scoping gibt es hier nichts zu lesen.
      if (!auth.clubId) {
        return NextResponse.json({ slots: [], maxHoursPerWeek: null });
      }
    }

    const clubTrainerIds = trainerId
      ? null
      : await resolveClubTrainerRecordIds(auth.clubId as string);
    if (clubTrainerIds !== null && clubTrainerIds.length === 0) {
      return NextResponse.json({ slots: [], maxHoursPerWeek: null });
    }

    let query = supabase
      .from('trainer_availabilities')
      .select(
        `id, trainer_id, date, start_time, end_time, status, notes,
         trainers(id, name, email)`
      )
      .in('status', ['available', 'booked']);

    if (trainerId) query = query.eq('trainer_id', trainerId);
    else if (clubTrainerIds) query = query.in('trainer_id', clubTrainerIds);
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);

    query = query.order('date', { ascending: true }).order('start_time', { ascending: true });

    const { data, error } = await query;
    if (error) {
      log.error('trainer availability GET error:', error.message);
      return NextResponse.json({ slots: [], maxHoursPerWeek: null });
    }

    // maxHoursPerWeek bezieht sich auf den Aufrufer (ein Trainer sieht sein
    // eigenes Limit). Für Mitglieder irrelevant — bleibt dort null.
    const recordId = await resolveTrainerRecordId(auth.user.id);
    const { data: trainerRecord } = recordId
      ? await supabase
          .from('trainers')
          .select('max_hours_per_week')
          .eq('id', recordId)
          .maybeSingle()
      : { data: null };

    // Trainer-E-Mails nur für Trainer/Admins.
    const showEmail = await verifyRole(auth, 'trainer');
    const slots = (data ?? []).map((s: any) =>
      showEmail || !s.trainers ? s : { ...s, trainers: { ...s.trainers, email: null } }
    );

    return NextResponse.json({
      slots,
      maxHoursPerWeek: trainerRecord?.max_hours_per_week ?? null,
    });
  });
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) return forbiddenResponse('Nur Trainer können Verfügbarkeiten festlegen');

    const { supabase, user } = auth;

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });

    const { date, start_time, end_time, notes } = body;
    if (!date || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'date, start_time und end_time erforderlich' },
        { status: 400 }
      );
    }

    const recordId = await resolveTrainerRecordId(user.id);
    if (!recordId) {
      return NextResponse.json({ error: 'Kein Trainerprofil gefunden' }, { status: 404 });
    }

    // Check for overlap using the correct trainer record id
    const { data: overlaps } = await supabase
      .from('trainer_availabilities')
      .select('id')
      .eq('trainer_id', recordId)
      .eq('date', date)
      .or(`and(start_time.lt.${end_time},end_time.gt.${start_time})`);

    if (overlaps && overlaps.length > 0) {
      return NextResponse.json({ error: 'Zeitkonflikt mit vorhandenem Slot' }, { status: 409 });
    }

    const { data: slot, error } = await supabase
      .from('trainer_availabilities')
      .insert({
        trainer_id: recordId,
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
      return NextResponse.json({ error: 'Slot konnte nicht erstellt werden' }, { status: 500 });
    }

    return NextResponse.json({ slot }, { status: 201 });
  });
}
