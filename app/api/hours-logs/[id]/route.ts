import { NextRequest, NextResponse } from 'next/server';
import { HoursLogService } from '@/src/application/services/hours-log.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const hoursLog = await HoursLogService.getHoursLogById(id);

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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await _request.json();

    const {
      startTime,
      endTime,
      type,
      status,
      notes,
    } = body;

    const updated = await HoursLogService.updateHoursLog(id, {
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await HoursLogService.deleteHoursLog(id);

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