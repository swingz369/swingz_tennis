import { NextRequest, NextResponse } from 'next/server';
import { AbsenceService } from '@/src/application/services/absence.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const absence = await AbsenceService.getAbsenceById(params.id);

    if (!absence) {
      return NextResponse.json(
        { error: 'Absence not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ absence });
  } catch (error) {
    console.error('Absence fetch error:', error);
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
      type,
      startDate,
      endDate,
      status,
      reason,
      notes,
    } = body;

    const updated = await AbsenceService.updateAbsence(params.id, {
      type,
      startDate,
      endDate,
      status,
      reason,
      notes,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Absence not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, absence: updated });
  } catch (error) {
    console.error('Absence update error:', error);
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
    const success = await AbsenceService.deleteAbsence(params.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Absence not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Absence delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
