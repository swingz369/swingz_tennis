import { NextRequest, NextResponse } from 'next/server';
import { getClubMembersUseCase } from '@/application/members/get-club-members.use-case';
import { DrizzleClubRepository } from '@/infrastructure/persistence/repositories/club.repository';
import { DrizzleMemberRepository } from '@/infrastructure/persistence/repositories/member.repository';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

function isDemoMode(req: NextRequest): boolean {
  const cookies = req.cookies.get('demo-mode');
  return !!cookies?.value;
}

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    const { searchParams } = new URL(_request.url);
    const clubId = searchParams.get('clubId');

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    if (isDemoMode(_request)) {
      const DEMO_MEMBERS = [
        {
          id: '1',
          name: 'Max Mustermann',
          email: 'max@example.com',
          joinDate: '2024-01-15',
          status: 'Aktiv',
        },
        {
          id: '2',
          name: 'Anna Schmidt',
          email: 'anna@example.com',
          joinDate: '2024-02-20',
          status: 'Aktiv',
        },
        {
          id: '3',
          name: 'Tom Müller',
          email: 'tom@example.com',
          joinDate: '2024-03-10',
          status: 'Aktiv',
        },
        {
          id: '4',
          name: 'Lisa Weber',
          email: 'lisa@example.com',
          joinDate: '2024-04-05',
          status: 'Inaktiv',
        },
        {
          id: '5',
          name: 'Mike Berger',
          email: 'mike@example.com',
          joinDate: '2025-05-12',
          status: 'Aktiv',
        },
      ];
      const csv = convertToCSV(DEMO_MEMBERS);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="members-export.csv"',
        },
      });
    }

    try {
      const memberRepository = new DrizzleMemberRepository();
      const clubRepository = new DrizzleClubRepository();
      const useCase = getClubMembersUseCase(memberRepository, clubRepository);
      const members = await useCase.execute(clubId);

      const csv = convertToCSV(members);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="members-${clubId}.csv"`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

function convertToCSV(data: object[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [];
  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map((header) => {
      const value = (row as Record<string, unknown>)[header];
      const formatted =
        value instanceof Date
          ? value.toISOString().split('T')[0]
          : String(value ?? '').replace(/"/g, '""');
      return `"${formatted}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}
