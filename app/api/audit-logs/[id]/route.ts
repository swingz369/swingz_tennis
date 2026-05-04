import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { AuditLogService } from '@/src/application/services/audit-log.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    // Verify admin role
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    // Apply strict rate limiting
    const rateLimitError = await checkRateLimitOrFail(_request, rateLimitStrict);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const auditLogService = new AuditLogService();
      const auditLog = await auditLogService.getAuditLogById(id);

      if (!auditLog) {
        return NextResponse.json({ error: 'Audit log not found' }, { status: 404 });
      }

      return NextResponse.json({ auditLog });
    } catch (error) {
      console.error('Audit log fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
