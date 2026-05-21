import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { hoursLogService } from '@/src/application/services/hours-log-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const attendanceRecord = await hoursLogService.getAttendanceRecordById(id);

      if (!attendanceRecord) {
        return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
      }

      return NextResponse.json({ attendanceRecord });
    } catch (error) {
      console.error('Attendance record fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    // Only trainers and admins can update attendance records
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const body = await _request.json();

      const { status, checkInTime, checkOutTime, notes } = body;

      const updated = await hoursLogService.updateAttendanceRecord(id, {
        status,
        checkInTime,
        checkOutTime,
        notes,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, attendanceRecord: updated });
    } catch (error) {
      console.error('Attendance record update error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    // Only admins can delete attendance records
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const success = await hoursLogService.deleteAttendanceRecord(id);

      if (!success) {
        return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Attendance record delete error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
