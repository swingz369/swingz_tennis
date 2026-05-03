import { NextRequest, NextResponse } from 'next/server';
import { AbsenceService } from '@/src/application/services/absence.service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await _request.json();
    const { approvedBy } = body;

    if (!approvedBy) {
      return NextResponse.json(
        { error: 'Approved by is required' },
        { status: 400 }
      );
    }

    const updated = await AbsenceService.approveAbsence(id, approvedBy);

    if (!updated) {
      return NextResponse.json(
        { error: 'Absence not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, absence: updated });
  } catch (error) {
    console.error('Absence approval error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
