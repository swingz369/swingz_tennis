import { NextRequest, NextResponse } from 'next/server';
import { AuditLogService } from '@/src/application/services/audit-log.service';
import { AuditLogFilter } from '@/src/domain/entities/audit-log.entity';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'json') as 'json' | 'csv';
    
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
    return NextResponse.json(
      { error: 'Failed to export audit logs' },
      { status: 500 }
    );
  }
}
