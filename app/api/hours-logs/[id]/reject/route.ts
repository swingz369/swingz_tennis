import { NextRequest, NextResponse } from 'next/server';
import { HoursLogService } from '@/src/application/services/hours-log.service';

export async function POST(
  _____request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await __request.json();
    const { approvedBy } = body;

    if (!approvedBy) {
      return NextResponse.json(
        { error: 'Approved by is required' },
        { status: 400 }
      );
    }

    const updated = await HoursLogService.rejectHoursLog(id, approvedBy);

    if (!updated) {
      return NextResponse.json(
        { error: 'Hours log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, hoursLog: updated });
  } catch (error) {
    console.error('Hours log rejection error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}