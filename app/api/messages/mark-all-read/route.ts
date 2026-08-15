import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/messages/mark-all-read
 * Marks all unread inbox messages for the authenticated user as read.
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const sb = auth.supabase as any;
    const user = auth.user;

    const { error } = await sb
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false);

    if (error) {
      return internalErrorResponse();
    }

    return NextResponse.json({ success: true });
  });
}
