import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withApiAuth } from '@/lib/api-auth';

// PATCH /api/user/notifications/[id] — marks a single notification as read
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (cookieStore.get('demo-mode')) {
    return NextResponse.json({ success: true });
  }

  const { id } = await params;

  return withApiAuth(req, async (auth) => {
    const { error } = await auth.supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', auth.user.id); // ensure user owns this notification

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
