import { NextRequest, NextResponse } from 'next/server';
import { AbsenceService } from '@/src/application/services/absence.service';

export async function GET(
  __request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const absence = await AbsenceService.getAbsenceById(id);

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
  __request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await __request.json();

    const {
      type,
      startDate,
      endDate,
      status,
      reason,
      notes,
    } = body;

    const updated = await AbsenceService.updateAbsence(id, {
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
  _____request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await AbsenceService.deleteAbsence(id);

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
