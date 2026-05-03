import { NextRequest, NextResponse } from 'next/server';
import { AbsenceService } from '@/src/application/services/absence.service';

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

    const updated = await AbsenceService.rejectAbsence(params.id, approvedBy);

    if (!updated) {
      return NextResponse.json(
        { error: 'Absence not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, absence: updated });
  } catch (error) {
    console.error('Absence rejection error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
