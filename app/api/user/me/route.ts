import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    return NextResponse.json({
      userId: auth.user.id,
      email: auth.user.email,
      roles: auth.roles,
    });
  });
}
