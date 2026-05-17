import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/messages
 * Returns messages for the authenticated user (inbox or sent)
 * Query params: ?folder=inbox|sent
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const folder = searchParams.get('folder') || 'inbox';

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const column = folder === 'sent' ? 'sender_id' : 'receiver_id';

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq(column, user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch sender/receiver user details for all messages
  const allUserIds = new Set<string>();
  (messages || []).forEach((m: any) => {
    allUserIds.add(m.sender_id);
    allUserIds.add(m.receiver_id);
  });

  const userMap = new Map<string, { full_name: string; email: string }>();
  if (allUserIds.size > 0) {
    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', Array.from(allUserIds));

    (usersData || []).forEach((u: any) => {
      userMap.set(u.id, { full_name: u.full_name || u.email, email: u.email });
    });
  }

  const enriched = (messages || []).map((m: any) => ({
    ...m,
    sender: userMap.get(m.sender_id) || { full_name: m.sender_id, email: '' },
    receiver: userMap.get(m.receiver_id) || { full_name: m.receiver_id, email: '' },
  }));

  const unreadCount =
    folder === 'inbox' ? (messages || []).filter((m: any) => !m.is_read).length : 0;

  return NextResponse.json({ messages: enriched, unreadCount });
}

/**
 * POST /api/messages
 * Sends a new message
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { receiverId, subject, content, clubId, repliedToId } = body;

  if (!receiverId || !subject || !content) {
    return NextResponse.json(
      { error: 'receiverId, subject, and content are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: user.id,
      receiver_id: receiverId,
      club_id: clubId || null,
      subject,
      content,
      replied_to_id: repliedToId || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create notification for receiver
  try {
    await supabase.from('notifications').insert({
      user_id: receiverId,
      club_id: clubId || null,
      type: 'message_received',
      title: 'Neue Nachricht',
      message: subject,
      link: '/member/messages',
    });
  } catch {
    // Non-critical — notification failure should not block message sending
  }

  return NextResponse.json({ message: data }, { status: 201 });
}

// PATCH is handled by [id]/read/route.ts — uses proper Next.js route params
