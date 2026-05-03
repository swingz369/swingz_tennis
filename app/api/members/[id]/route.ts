import { NextRequest, NextResponse } from 'next/server';
import { MemberService } from '@/src/application/services/member.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const member = await MemberService.getMemberById(id);

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ member });
  } catch (error) {
    console.error('Member fetch error:', error);
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
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      address,
      memberType,
      membershipStatus,
      membershipStart,
      membershipEnd,
      trainingGroup,
      emergencyContact,
      notes,
    } = body;

    const updated = await MemberService.updateMember(id, {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      address,
      memberType,
      membershipStatus,
      membershipStart,
      membershipEnd,
      trainingGroup,
      emergencyContact,
      notes,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, member: updated });
  } catch (error) {
    console.error('Member update error:', error);
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
    const success = await MemberService.deleteMember(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Member delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}