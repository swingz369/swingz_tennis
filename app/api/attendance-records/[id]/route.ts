import { NextRequest, NextResponse } from 'next/server';
import { HoursLogService } from '@/src/application/services/hours-log.service';

export async function GET(
  _____request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const attendanceRecord = await HoursLogService.getAttendanceRecordById(id);

    if (!attendanceRecord) {
      return NextResponse.json(
        { error: 'Attendance record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ attendanceRecord });
  } catch (error) {
    console.error('Attendance record fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  _____request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await __request.json();

    const {
      status,
      checkInTime,
      checkOutTime,
      notes,
    } = body;

    const updated = await HoursLogService.updateAttendanceRecord(id, {
      status,
      checkInTime,
      checkOutTime,
      notes,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Attendance record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, attendanceRecord: updated });
  } catch (error) {
    console.error('Attendance record update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _____request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await HoursLogService.deleteAttendanceRecord(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Attendance record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Attendance record delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
