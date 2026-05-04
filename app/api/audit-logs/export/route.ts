import { NextRequest, NextResponse } from 'next/server';
import { AuditLogService } from '@/src/application/services/audit-log.service';
import { AuditLogFilter, AuditAction, EntityType } from '@/src/domain/entities/audit-log.entity';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Verify admin role for export
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    // Apply very strict rate limiting for export (resource intensive)
    const rateLimitError = await checkRateLimitOrFail(_request, rateLimitStrict);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const searchParams = _request.nextUrl.searchParams;
      const format = (searchParams.get('format') || 'json') as 'json' | 'csv';

      const filter: AuditLogFilter = {};

      const startDateParam = searchParams.get('startDate');
      if (startDateParam) {
        filter.startDate = new Date(startDateParam);
      }

      const endDateParam = searchParams.get('endDate');
      if (endDateParam) {
        filter.endDate = new Date(endDateParam);
      }

      const actionParam = searchParams.get('action');
      if (actionParam) {
        filter.action = actionParam.split(',') as AuditAction[];
      }

      const entityTypeParam = searchParams.get('entityType');
      if (entityTypeParam) {
        filter.entityType = entityTypeParam.split(',') as EntityType[];
      }

      const userIdParam = searchParams.get('userId');
      if (userIdParam) {
        filter.userId = userIdParam.split(',');
      }

      const userRoleParam = searchParams.get('userRole');
      if (userRoleParam) {
        filter.userRole = userRoleParam.split(',');
      }

      const statusParam = searchParams.get('status');
      if (statusParam) {
        filter.status = statusParam.split(',') as ('success' | 'failed' | 'partial')[];
      }

      const entityIdParam = searchParams.get('entityId');
      if (entityIdParam) {
        filter.entityId = entityIdParam;
      }

      const searchTermParam = searchParams.get('search');
      if (searchTermParam) {
        filter.searchTerm = searchTermParam;
      }

      const auditLogService = new AuditLogService();
      const content = await auditLogService.exportAuditLogs(filter, format);

      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;

      return new NextResponse(content, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      return NextResponse.json({ error: 'Failed to export audit logs' }, { status: 500 });
    }
  });
}
