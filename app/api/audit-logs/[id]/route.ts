import { NextRequest, NextResponse } from 'next/server';
import { AuditLogService } from '@/src/application/services/audit-log.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
   try {
     const { id } = await params;
     const auditLogService = new AuditLogService();
     const auditLog = await auditLogService.getAuditLogById(id);

    if (!auditLog) {
      return NextResponse.json(
        { error: 'Audit log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ auditLog });
  } catch (error) {
    console.error('Audit log fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
