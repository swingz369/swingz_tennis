import { NextRequest, NextResponse } from 'next/server';
import { AuditLogService } from '@/src/application/services/audit-log.service';
import { AuditLogFilter } from '@/src/domain/entities/audit-log.entity';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const filter: AuditLogFilter = {
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      action: searchParams.get('action')?.split(',') as any,
      entityType: searchParams.get('entityType')?.split(',') as any,
      userId: searchParams.get('userId')?.split(','),
      userRole: searchParams.get('userRole')?.split(','),
      status: searchParams.get('status')?.split(',') as any,
      entityId: searchParams.get('entityId') || undefined,
      searchTerm: searchParams.get('search') || undefined
    };

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
