import { NextRequest, NextResponse } from 'next/server';
import { MemberService } from '@/src/application/services/member.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const member = await MemberService.getMemberById(params.id);

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
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

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

    const updated = await MemberService.updateMember(params.id, {
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
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const success = await MemberService.deleteMember(params.id);

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
