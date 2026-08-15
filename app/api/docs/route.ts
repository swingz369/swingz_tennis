import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getApiDocs } from '@/lib/swagger/swagger-config';
import { withApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return withApiAuth(request, async (auth) => {
      if (!['admin', 'superadmin'].includes(auth.role ?? '')) {
        return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
      }
      const spec = getApiDocs();
      return NextResponse.json(spec);
    });
  }
  const spec = getApiDocs();
  return NextResponse.json(spec);
}
