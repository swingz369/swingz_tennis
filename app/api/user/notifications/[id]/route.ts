import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';

// PATCH /api/user/notifications/[id] — marks a single notification as read
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withApiAuth(req, async (auth) => {
    const { error } = await auth.supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', auth.user.id); // ensure user owns this notification

    if (error) {
      return internalErrorResponse();
    }

    return NextResponse.json({ success: true });
  });
}

// DELETE /api/user/notifications/[id] — deletes a single notification
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withApiAuth(req, async (auth) => {
    const { error } = await auth.supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id);

    if (error) {
      return internalErrorResponse();
    }

    return NextResponse.json({ success: true });
  });
}
