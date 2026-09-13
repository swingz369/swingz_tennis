import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { HoursLogService } from '@/application/services/hours-log.service';
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
      const service = new HoursLogService(auth);
      const hoursLog = await service.getHoursLogById(id);

      const isAdmin = await verifyRole(auth, 'admin');
      if (isAdmin && !(await verifyTrainerInClub(auth, hoursLog.trainer_id))) {
        return NextResponse.json({ error: 'Stundennachweis nicht gefunden' }, { status: 404 });
      }

      return NextResponse.json({ hoursLog });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Hours log fetch error:', error);
      return internalErrorResponse();
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
      const service = new HoursLogService(auth);

      const isAdmin = await verifyRole(auth, 'admin');
      if (body.status && !isAdmin) {
        return forbiddenResponse('Nur Admins können den Status ändern');
      }

      if (isAdmin) {
        const existing = await service.getHoursLogById(id);
        if (!(await verifyTrainerInClub(auth, existing.trainer_id))) {
          return NextResponse.json({ error: 'Stundennachweis nicht gefunden' }, { status: 404 });
        }
      }

      const { startTime, endTime, type, status, notes } = body;

      const updated = await service.updateHoursLog(id, { startTime, endTime, type, status, notes });

      return NextResponse.json({ success: true, hoursLog: updated });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Hours log update error:', error);
      return internalErrorResponse();
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
      const service = new HoursLogService(auth);
      const existing = await service.getHoursLogById(id);
      if (!(await verifyTrainerInClub(auth, existing.trainer_id))) {
        return NextResponse.json({ error: 'Stundennachweis nicht gefunden' }, { status: 404 });
      }

      await service.deleteHoursLog(id);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Hours log delete error:', error);
      return internalErrorResponse();
    }
  });
}
