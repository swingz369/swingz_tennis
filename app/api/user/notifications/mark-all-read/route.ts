import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';

// POST /api/user/notifications/mark-all-read — marks all notifications as read
export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const { error } = await auth.supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', auth.user.id)
      .eq('read', false);

    if (error) {
      return internalErrorResponse();
    }

    return NextResponse.json({ success: true });
  });
}
