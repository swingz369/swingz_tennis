import { NextRequest, NextResponse } from 'next/server';
import { AuditLogService } from '@/src/application/services/audit-log.service';
import { AuditLogFilter } from '@/src/domain/entities/audit-log.entity';

export async function GET(_request: NextRequest) {
  try {
    const searchParams = _request.nextUrl.searchParams;
    
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
      filter.action = actionParam.split(',') as any;
    }
    
    const entityTypeParam = searchParams.get('entityType');
    if (entityTypeParam) {
      filter.entityType = entityTypeParam.split(',') as any;
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
      filter.status = statusParam.split(',') as any;
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
    const logs = await auditLogService.getAuditLogs(filter);

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
