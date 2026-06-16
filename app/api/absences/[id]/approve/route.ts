import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { absenceService } from '@/src/application/services/absence-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:absences:[id]:approve');

const approveSchema = z.object({
  approvedBy: z.string().min(1, 'Approved by is required'),
});

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    // Only admins can approve absences
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const body = await _request.json();

      const validation = approveSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.issues },
          { status: 400 }
        );
      }

      const updated = await absenceService.approveAbsence(id, validation.data.approvedBy);

      if (!updated) {
        return NextResponse.json({ error: 'Absence not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, absence: updated });
    } catch (error) {
      log.error('Absence approval error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
