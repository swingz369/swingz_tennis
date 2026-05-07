import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withApiAuth } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  // Demo mode: return 0 unread
  const cookieStore = await cookies();
  if (cookieStore.get('demo-mode')) {
    return NextResponse.json({ count: 0 });
  }

  return withApiAuth(req, async (auth) => {
    const { count, error } = await auth.supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .eq('read', false);

    if (error) {
      // Table may not exist yet — return 0 gracefully
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json({ count: count ?? 0 });
  });
}
