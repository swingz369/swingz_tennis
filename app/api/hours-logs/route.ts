import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { HoursLogService } from '@/src/application/services/hours-log.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

// Schema for validation - kept for future use
// const createHoursLogSchema = z.object({...})

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Verify trainer, admin, or superadmin role
    const isTrainer = await verifyRole(auth, 'trainer');
    const isAdmin = await verifyRole(auth, 'admin');
    const isSuperadmin = await verifyRole(auth, 'superadmin');

    if (!isTrainer && !isAdmin && !isSuperadmin) {
      return forbiddenResponse('Trainer, Admin oder Superadmin Zugriff erforderlich');
    }

    // Apply rate limiting
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);
      const trainerId = searchParams.get('trainerId');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const status = searchParams.get('status');
      const summary = searchParams.get('summary');

      if (summary) {
        if (trainerId) {
          const summary = await HoursLogService.getHoursSummaryForTrainer(trainerId);
          return NextResponse.json({ summary });
        }
        const summaries = await HoursLogService.getAllHoursSummaries();
        return NextResponse.json({ summaries });
      }

      if (trainerId) {
        // Trainer can only see their own logs, Admin/Superadmin can see all
        if (isTrainer && !isAdmin && !isSuperadmin && trainerId !== auth.user.id) {
          return forbiddenResponse('Trainer können nur ihre eigenen Stundennachweise sehen');
        }
        const hoursLogs = await HoursLogService.getHoursLogsByTrainerId(trainerId);
        return NextResponse.json({ hoursLogs });
      }

      if (status) {
        const hoursLogs = await HoursLogService.getHoursLogsByStatus(
          status as 'pending' | 'approved' | 'rejected'
        );
        return NextResponse.json({ hoursLogs });
      }

      if (startDate && endDate) {
        const hoursLogs = await HoursLogService.getHoursLogsByDateRange(startDate, endDate);
        return NextResponse.json({ hoursLogs });
      }

      // Get all hours logs (Admin/Superadmin) or only own logs (Trainer)
      if (isAdmin || isSuperadmin) {
        const hoursLogs = await HoursLogService.getAllHoursLogs();
        return NextResponse.json({ hoursLogs });
      } else {
        // Trainer sees only their own logs
        const hoursLogs = await HoursLogService.getHoursLogsByTrainerId(auth.user.id);
        return NextResponse.json({ hoursLogs });
      }
    } catch (error) {
      console.error('Hours log fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Only trainer can create hours logs
    const isTrainer = await verifyRole(auth, 'trainer');
    if (!isTrainer) {
      return forbiddenResponse('Nur Trainer können Stundennachweise erstellen');
    }

    // Apply rate limiting
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();
      const hoursLog = await HoursLogService.createHoursLog(body);
      return NextResponse.json({ hoursLog }, { status: 201 });
    } catch (error) {
      console.error('Hours log creation error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
