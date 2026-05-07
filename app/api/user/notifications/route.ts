import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withApiAuth } from '@/lib/api-auth';

// GET /api/user/notifications — returns notifications for current user
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('demo-mode')) {
    return NextResponse.json({ notifications: [] });
  }

  return withApiAuth(req, async (auth) => {
    const { data, error } = await auth.supabase
      .from('notifications')
      .select('id, type, title, message, read, action_url, created_at')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      // Table may not exist yet — return empty gracefully
      return NextResponse.json({ notifications: [] });
    }

    return NextResponse.json({ notifications: data ?? [] });
  });
}
