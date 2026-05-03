import { NextRequest, NextResponse } from 'next/server';
import { AuditLogService } from '@/src/application/services/audit-log.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auditLog = await AuditLogService.getAuditLogById(params.id);

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
