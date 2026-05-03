import { NextRequest, NextResponse } from 'next/server';
import { HoursLogService } from '@/src/application/services/hours-log.service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { approvedBy } = body;

    if (!approvedBy) {
      return NextResponse.json(
        { error: 'Approved by is required' },
        { status: 400 }
      );
    }

    const updated = await HoursLogService.approveHoursLog(params.id, approvedBy);

    if (!updated) {
      return NextResponse.json(
        { error: 'Hours log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, hoursLog: updated });
  } catch (error) {
    console.error('Hours log approval error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
