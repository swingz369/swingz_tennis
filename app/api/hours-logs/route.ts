/**
 * GET /api/hours-logs — Fetch trainer hours logs via Supabase
 * POST /api/hours-logs — Create a new hours log entry
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import {
  CreateHoursLogSchema,
  validateRequestBody,
  formatValidationErrors,
} from '@/lib/validation-schemas';

const log = createLogger('api:hours-logs');

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const isTrainer = await verifyRole(auth, 'trainer');
    const isAdmin = await verifyRole(auth, 'admin');
    const isSuperadmin = await verifyRole(auth, 'superadmin');

    if (!isTrainer && !isAdmin && !isSuperadmin) {
      return forbiddenResponse('Trainer, Admin oder Superadmin Zugriff erforderlich');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const { searchParams } = new URL(_request.url);
      const trainerId = searchParams.get('trainerId');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const status = searchParams.get('status');

      const supabase = auth.supabase;

      let query = supabase
        .from('hours_logs')
        .select(
          'id, trainer_id, trainer_name, date, start_time, end_time, duration, session_id, type, status, notes, rejection_reason, approved_by, approved_at, created_at'
        )
        .order('date', { ascending: false });

      // hours_logs.trainer_id references trainers.id, not the Supabase auth
      // user id — resolve it once for the "own logs" cases below.
      let ownTrainerId: string | null = null;
      if (!isAdmin && !isSuperadmin) {
        const { data: trainerRow } = await supabase
          .from('trainers')
          .select('id')
          .eq('user_id', auth.user.id)
          .maybeSingle();
        ownTrainerId = trainerRow?.id ?? null;
      }

      if (trainerId) {
        // Trainer can only view their own logs
        if (!isAdmin && !isSuperadmin && trainerId !== ownTrainerId) {
          return forbiddenResponse('Trainer können nur ihre eigenen Stundennachweise sehen');
        }
        query = query.eq('trainer_id', trainerId);
      } else if (!isAdmin && !isSuperadmin) {
        // Non-admin trainer sees only own logs
        query = query.eq('trainer_id', ownTrainerId ?? '');
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (startDate) {
        query = query.gte('date', startDate);
      }

      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data: rawLogs, error } = await query;

      if (error) {
        // Table may not exist yet
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return NextResponse.json({ hoursLogs: [] });
        }
        log.error('Hours logs fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Resolve trainer names from users table where trainer_name is missing
      const trainerIds = [
        ...new Set((rawLogs ?? []).map((l: any) => l.trainer_id).filter(Boolean)),
      ];
      const trainerNamesMap = new Map<string, string>();

      if (trainerIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', trainerIds);
        (users ?? []).forEach((u: any) => {
          if (u.full_name) trainerNamesMap.set(u.id, u.full_name);
        });
      }

      // Transform: convert duration (minutes) to hours (decimal), resolve trainer names
      const hoursLogs = (rawLogs ?? []).map((log: any) => ({
        id: log.id,
        trainer_id: log.trainer_id,
        trainer_name:
          trainerNamesMap.get(log.trainer_id) || log.trainer_name || 'Unbekannter Trainer',
        date: typeof log.date === 'string' ? log.date.substring(0, 10) : log.date,
        hours: log.duration != null ? Math.round((log.duration / 60) * 100) / 100 : 0,
        session_id: log.session_id,
        description: log.notes,
        status: log.status,
        rejection_reason: log.rejection_reason ?? null,
        created_at: log.created_at,
        approved_by: log.approved_by,
        approved_at: log.approved_at,
      }));

      return NextResponse.json({ hoursLogs });
    } catch (error) {
      log.error('Hours log fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const isTrainer = await verifyRole(auth, 'trainer');
    if (!isTrainer) {
      return forbiddenResponse('Nur Trainer können Stundennachweise erstellen');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const body = await _request.json();
      const validation = validateRequestBody(CreateHoursLogSchema, body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Ungültige Eingabe', details: formatValidationErrors(validation.errors) },
          { status: 400 }
        );
      }
      const { date, startTime, endTime, type, sessionId, notes } = validation.data;

      // Calculate duration in minutes
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const duration = eh * 60 + em - (sh * 60 + sm);

      if (duration <= 0) {
        return NextResponse.json({ error: 'endTime must be after startTime' }, { status: 400 });
      }

      const supabase = auth.supabase;

      // For trainers, always use their own trainers.id — the body's trainerId
      // is ignored. hours_logs.trainer_id references trainers.id, not the
      // Supabase auth user id, so it must be resolved via trainers.user_id.
      const { data: trainerRow } = await supabase
        .from('trainers')
        .select('id')
        .eq('user_id', auth.user.id)
        .maybeSingle();

      if (!trainerRow) {
        return NextResponse.json(
          { error: 'Kein Trainer-Profil für diesen Account gefunden' },
          { status: 404 }
        );
      }

      const trainerId = trainerRow.id;

      // Fetch trainer name for display
      const { data: user } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', auth.user.id)
        .maybeSingle();

      const { data: hoursLog, error } = await supabase
        .from('hours_logs')
        .insert({
          trainer_id: trainerId,
          trainer_name: user?.full_name || 'Trainer',
          date,
          start_time: startTime,
          end_time: endTime,
          duration,
          type,
          session_id: sessionId || null,
          notes: notes || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        log.error('Hours log creation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ hoursLog }, { status: 201 });
    } catch (error) {
      log.error('Hours log creation error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
