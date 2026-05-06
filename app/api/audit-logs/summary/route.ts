import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { AuditLogService } from '@/src/application/services/audit-log.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Verify admin role
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    // Apply strict rate limiting
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const searchParams = _request.nextUrl.searchParams;
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      const auditLogService = new AuditLogService();
      const summary = await auditLogService.getAuditLogSummary(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      return NextResponse.json(summary);
    } catch (error) {
      console.error('Error fetching audit log summary:', error);
      return NextResponse.json({ error: 'Failed to fetch audit log summary' }, { status: 500 });
    }
  });
}
