import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { hoursLogService } from '@/src/application/services/hours-log-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:attendance-records');

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Only trainers and admins can create attendance records
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
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

      return NextResponse.json({ success: true, attendanceRecord });
    } catch (error) {
      log.error('Attendance record creation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Members can view attendance records
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);
      const sessionId = searchParams.get('sessionId');
      const trainerId = searchParams.get('trainerId');
      const participantId = searchParams.get('participantId');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      if (sessionId) {
        const attendanceRecords = await hoursLogService.getAttendanceRecordsBySessionId(sessionId);
        return NextResponse.json({ attendanceRecords });
      }

      if (trainerId) {
        const attendanceRecords = await hoursLogService.getAttendanceRecordsByTrainerId(trainerId);
        return NextResponse.json({ attendanceRecords });
      }

      if (participantId) {
        const attendanceRecords =
          await hoursLogService.getAttendanceRecordsByParticipantId(participantId);
        return NextResponse.json({ attendanceRecords });
      }

      if (startDate && endDate) {
        const attendanceRecords = await hoursLogService.getAttendanceRecordsByDateRange(
          startDate,
          endDate
        );
        return NextResponse.json({ attendanceRecords });
      }

      // Get all attendance records
      const attendanceRecords = await hoursLogService.getAllAttendanceRecords();
      return NextResponse.json({ attendanceRecords });
    } catch (error) {
      log.error('Attendance record fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
