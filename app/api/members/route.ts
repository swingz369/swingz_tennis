import { NextRequest, NextResponse } from 'next/server';
import { MemberService } from '@/src/application/services/member.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      userId,
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

    if (!userId || !firstName || !lastName || !email || !phone || !dateOfBirth) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create member
    const member = await MemberService.createMember({
      userId,
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

    return NextResponse.json({ success: true, member });
  } catch (error) {
    console.error('Member creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const trainingGroup = searchParams.get('trainingGroup');
    const search = searchParams.get('search');
    const active = searchParams.get('active');
    const statistics = searchParams.get('statistics');

    if (statistics) {
      const statistics = await MemberService.getMemberStatistics();
      return NextResponse.json({ statistics });
    }

    if (active) {
      const members = await MemberService.getActiveMembers();
      return NextResponse.json({ members });
    }

    if (search) {
      const members = await MemberService.searchMembers(search);
      return NextResponse.json({ members });
    }

    if (trainingGroup) {
      const members = await MemberService.getMembersByTrainingGroup(trainingGroup);
      return NextResponse.json({ members });
    }

    // Query with filters
    const query: any = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (search) query.search = search;

    const members = await MemberService.queryMembers(query);
    return NextResponse.json({ members });
  } catch (error) {
    console.error('Member fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
