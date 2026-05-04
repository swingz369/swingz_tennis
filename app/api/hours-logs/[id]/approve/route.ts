import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { HoursLogService } from '@/src/application/services/hours-log.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';
import { z } from 'zod';

const approveSchema = z.object({
  approvedBy: z.string().min(1, 'Approved by is required'),
});

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    // Only admins can approve hours logs
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimitStrict);
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

      const updated = await HoursLogService.approveHoursLog(id, validation.data.approvedBy);

      if (!updated) {
        return NextResponse.json({ error: 'Hours log not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, hoursLog: updated });
    } catch (error) {
      console.error('Hours log approval error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
