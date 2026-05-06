import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { HoursLogService } from '@/src/application/services/hours-log.service';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    // Only admin and superadmin can approve
    const isAdmin = await verifyRole(auth, 'admin');
    const isSuperadmin = await verifyRole(auth, 'superadmin');

    if (!isAdmin && !isSuperadmin) {
      return forbiddenResponse('Admin oder Superadmin Zugriff erforderlich');
    }

    // Apply rate limiting
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const hoursLog = await HoursLogService.approveHoursLog(id, auth.user.id);

      return NextResponse.json({
        success: true,
        hoursLog,
        message: 'Stundennachweis genehmigt',
      });
    } catch (error) {
      console.error('Approve hours log error:', error);
      return NextResponse.json(
        { success: false, error: 'Fehler bei der Genehmigung' },
        { status: 500 }
      );
    }
  });
}
