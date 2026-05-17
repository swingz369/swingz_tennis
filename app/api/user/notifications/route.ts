import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';

// GET /api/user/notifications — returns notifications for current user
export async function GET(req: NextRequest) {
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
