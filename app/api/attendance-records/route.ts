import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { hoursLogService } from '@/src/application/services/hours-log-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:attendance-records');

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Only trainers and admins can create attendance records
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();

      const {
        sessionId,
        trainerId,
        trainerName,
        participantId,
        participantName,
        date,
        status,
        checkInTime,
        checkOutTime,
        notes,
      } = body;

      if (
        !sessionId ||
        !trainerId ||
        !trainerName ||
        !participantId ||
        !participantName ||
        !date ||
        !status
      ) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Create attendance record
      const attendanceRecord = await hoursLogService.createAttendanceRecord({
        sessionId,
        trainerId,
        trainerName,
        participantId,
        participantName,
        date,
        status,
        checkInTime,
        checkOutTime,
        notes,
      });

      // Gamification: 5 Punkte für Anwesenheit (fire-and-forget)
      void (async () => {
        try {
          const svc = createServiceClient();
          const { data: existing } = await (svc as any)
            .from('gamification_points')
            .select('points')
            .eq('user_id', participantId)
            .maybeSingle();
          const current = existing?.points ?? 0;
          await (svc as any)
            .from('gamification_points')
            .upsert({ user_id: participantId, points: current + 5 }, { onConflict: 'user_id' });
        } catch {
          // Gamification-Fehler blockieren niemals die Anwesenheitserfassung
        }
      })();

      return NextResponse.json({ success: true, attendanceRecord });
    } catch (error) {
      log.error('Attendance record creation error:', error);
      return internalErrorResponse();
    }
  });
}

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Anmeldung erforderlich');

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const { searchParams } = new URL(_request.url);
      const sessionId = searchParams.get('sessionId');
      const trainerId = searchParams.get('trainerId');

      // Legacy trainer/admin per-session or per-trainer queries (Drizzle service)
      if (sessionId) {
        const attendanceRecords = await hoursLogService.getAttendanceRecordsBySessionId(sessionId);
        return NextResponse.json({ attendanceRecords });
      }
      if (trainerId) {
        const attendanceRecords = await hoursLogService.getAttendanceRecordsByTrainerId(trainerId);
        return NextResponse.json({ attendanceRecords });
      }

      // Member's own history — paginated + filtered via Supabase REST
      const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
      const pageSize = Math.min(
        50,
        Math.max(1, parseInt(searchParams.get('pageSize') ?? '15', 10))
      );
      const filter = searchParams.get('filter') ?? 'all';
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const supabase = createServiceClient();
      let query = supabase
        .from('attendance_records')
        .select(
          'id, session_id, participant_name, date, status, check_in_time, check_out_time, notes',
          { count: 'exact' }
        )
        .eq('participant_id', auth.user.id)
        .order('date', { ascending: false })
        .range(from, to);

      if (filter === 'attended') query = query.eq('status', 'present');
      else if (filter === 'missed') query = query.neq('status', 'present');

      const { data, count, error } = await query;
      if (error) {
        log.error('Attendance record fetch error', error instanceof Error ? error : undefined);
        return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });
      }

      const records = (data ?? []).map((row: any) => ({
        id: row.id,
        session_id: row.session_id,
        member_name: row.participant_name ?? '',
        session_date: typeof row.date === 'string' ? row.date.split('T')[0] : '',
        start_time: row.check_in_time ?? '',
        end_time: row.check_out_time ?? '',
        attended: row.status === 'present',
        notes: row.notes ?? undefined,
      }));

      return NextResponse.json({ records, total: count ?? 0 });
    } catch (error) {
      log.error('Attendance record fetch error', error instanceof Error ? error : undefined);
      return internalErrorResponse();
    }
  });
}
