import { NextRequest, NextResponse } from 'next/server';
import { HoursLogService } from '@/src/application/services/hours-log.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      sessionId,
      trainerId,
      trainerName,
      participantId,
      participantName,
      date,
      status,
      checkInTime,
      checkOutTime,
      notes,
    } = body;

    if (!sessionId || !trainerId || !trainerName || !participantId || !participantName || !date || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create attendance record
    const attendanceRecord = await HoursLogService.createAttendanceRecord({
      sessionId,
      trainerId,
      trainerName,
      participantId,
      participantName,
      date,
      status,
      checkInTime,
      checkOutTime,
      notes,
    });

    return NextResponse.json({ success: true, attendanceRecord });
  } catch (error) {
    console.error('Attendance record creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const trainerId = searchParams.get('trainerId');
    const participantId = searchParams.get('participantId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (sessionId) {
      const attendanceRecords = await HoursLogService.getAttendanceRecordsBySessionId(sessionId);
      return NextResponse.json({ attendanceRecords });
    }

    if (trainerId) {
      const attendanceRecords = await HoursLogService.getAttendanceRecordsByTrainerId(trainerId);
      return NextResponse.json({ attendanceRecords });
    }

    if (participantId) {
      const attendanceRecords = await HoursLogService.getAttendanceRecordsByParticipantId(participantId);
      return NextResponse.json({ attendanceRecords });
    }

    if (startDate && endDate) {
      const attendanceRecords = await HoursLogService.getAttendanceRecordsByDateRange(startDate, endDate);
      return NextResponse.json({ attendanceRecords });
    }

    // Get all attendance records
    const attendanceRecords = await HoursLogService.getAllAttendanceRecords();
    return NextResponse.json({ attendanceRecords });
  } catch (error) {
    console.error('Attendance record fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
