import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { hoursLogService } from '@/src/application/services/hours-log-service.adapter';
import { withApiAuth, verifyRole, verifyTrainerInClub, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:hours-logs:[id]');

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasRole = await verifyRole(auth, 'trainer');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const hoursLog = await hoursLogService.getHoursLogById(id);

      if (!hoursLog) {
        return NextResponse.json({ error: 'Hours log not found' }, { status: 404 });
      }

      const isAdmin = await verifyRole(auth, 'admin');
      if (isAdmin && !(await verifyTrainerInClub(auth, hoursLog.trainerId))) {
        return NextResponse.json({ error: 'Hours log not found' }, { status: 404 });
      }

      return NextResponse.json({ hoursLog });
    } catch (error) {
      log.error('Hours log fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const hasRole = await verifyRole(auth, 'trainer');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const body = await _request.json();

      const isAdmin = await verifyRole(auth, 'admin');
      if (body.status && !isAdmin) {
        return forbiddenResponse('Nur Admins können den Status ändern');
      }

      if (isAdmin) {
        const existing = await hoursLogService.getHoursLogById(id);
        if (!existing) {
          return NextResponse.json({ error: 'Hours log not found' }, { status: 404 });
        }
        if (!(await verifyTrainerInClub(auth, existing.trainerId))) {
          return NextResponse.json({ error: 'Hours log not found' }, { status: 404 });
        }
      }

      const { startTime, endTime, type, status, notes } = body;

      const updated = await hoursLogService.updateHoursLog(id, {
        startTime,
        endTime,
        type,
        status,
        notes,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Hours log not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, hoursLog: updated });
    } catch (error) {
      log.error('Hours log update error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const existing = await hoursLogService.getHoursLogById(id);
      if (!existing) {
        return NextResponse.json({ error: 'Hours log not found' }, { status: 404 });
      }
      if (!(await verifyTrainerInClub(auth, existing.trainerId))) {
        return NextResponse.json({ error: 'Hours log not found' }, { status: 404 });
      }

      const success = await hoursLogService.deleteHoursLog(id);

      if (!success) {
        return NextResponse.json({ error: 'Hours log not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error('Hours log delete error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
