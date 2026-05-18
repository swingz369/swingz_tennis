import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * Returns notifications for the authenticated user
 *
 * Note: the typed schema uses column 'read' (boolean). The original code
 * used 'is_read' which the type system rejects. We keep 'read' to match
 * the generated Database type.
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const showRead = searchParams.get('show_read') === 'true';
    const supabase = auth.supabase;
    const user = auth.user;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!showRead) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const unreadCount = showRead
      ? (data || []).filter((n: any) => !n.read).length
      : (data || []).length;

    return NextResponse.json({ notifications: data, unreadCount });
  });
}

/**
 * PATCH /api/notifications/mark-read
 * Marks notifications as read. Body: { ids?: string[] } — if no ids, marks all as read
 */
export async function PATCH(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = auth.supabase;
    const user = auth.user;

    const body = await request.json().catch(() => ({}));
    const { ids } = body;

    let query = supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id);

    if (ids && ids.length > 0) {
      query = query.in('id', ids);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
