import { NextRequest, NextResponse } from 'next/server';
import { HoursLogService } from '@/src/application/services/hours-log.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const hoursLog = await HoursLogService.getHoursLogById(params.id);

    if (!hoursLog) {
      return NextResponse.json(
        { error: 'Hours log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ hoursLog });
  } catch (error) {
    console.error('Hours log fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const {
      startTime,
      endTime,
      type,
      status,
      notes,
    } = body;

    const updated = await HoursLogService.updateHoursLog(params.id, {
      startTime,
      endTime,
      type,
      status,
      notes,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Hours log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, hoursLog: updated });
  } catch (error) {
    console.error('Hours log update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const success = await HoursLogService.deleteHoursLog(params.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Hours log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Hours log delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
