import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getClubMembersUseCase } from '@/application/members/get-club-members.use-case';
import { DrizzleClubRepository } from '@/infrastructure/persistence/repositories/club.repository';
import { DrizzleMemberRepository } from '@/infrastructure/persistence/repositories/member.repository';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    const { searchParams } = new URL(_request.url);
    const clubId = searchParams.get('clubId');

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
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
