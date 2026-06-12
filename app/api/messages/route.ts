import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/messages
 * Returns messages for the authenticated user (inbox or sent)
 * Query params: ?folder=inbox|sent
 *
 * Note: 'messages' table is not in the generated Database type, so we
 * cast via (supabase as any) only for that table. RLS is enforced because
 * auth.supabase is the user-scoped anon-key client.
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || 'inbox';
    const countOnly = searchParams.get('countOnly') === 'true';
    const sb = auth.supabase as any;
    const user = auth.user;

    const column = folder === 'sent' ? 'sender_id' : 'receiver_id';

    // Lightweight count-only mode for notification bell polling
    if (countOnly && folder === 'inbox') {
      const { count, error } = await sb
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ unreadCount: count ?? 0 });
    }

    const { data: messages, error } = await sb
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
      const { data: usersData } = await auth.supabase
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
  });
}

/**
 * POST /api/messages
 * Sends a new message.
 * Supports:
 *  - Direct message: { receiverId, subject, content }
 *  - Broadcast: { broadcastType: 'all'|'trainers'|'members', subject, content, clubId }
 *
 * For broadcasts, individual message rows are created per recipient so that
 * the existing inbox query (receiver_id = user.id) continues to work.
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = auth.user;
    const body = await request.json();
    const { receiverId, subject, content, clubId, repliedToId, broadcastType } = body as {
      receiverId?: string;
      subject?: string;
      content?: string;
      clubId?: string;
      repliedToId?: string;
      broadcastType?: 'all' | 'trainers' | 'members';
    };

    if (!subject?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'subject und content sind erforderlich' }, { status: 400 });
    }

    if (!broadcastType && !receiverId) {
      return NextResponse.json(
        { error: 'receiverId oder broadcastType erforderlich' },
        { status: 400 }
      );
    }

    // Use service client for broadcast (bypasses RLS for cross-user inserts)
    // but user-scoped client for direct messages (RLS checks sender_id)
    const sb = broadcastType ? createServiceClient() : (auth.supabase as any);

    // ── Direct message (1:1) ──
    if (!broadcastType && receiverId) {
      const { data, error } = await sb
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          club_id: clubId || null,
          subject: subject.trim(),
          content: content.trim(),
          replied_to_id: repliedToId || null,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Create notification for receiver (non-blocking)
      try {
        await sb.from('notifications').insert({
          user_id: receiverId,
          club_id: clubId || null,
          type: 'message_received',
          title: 'Neue Nachricht',
          message: subject.trim(),
          link: '/messages',
        });
      } catch {
        /* non-critical */
      }

      return NextResponse.json({ message: data, count: 1 }, { status: 201 });
    }

    // ── Broadcast message ──
    // Only admins can send broadcasts
    if (broadcastType) {
      const isAdmin = await verifyRole(auth, 'admin');
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Nur Admins können Broadcast-Nachrichten senden' },
          { status: 403 }
        );
      }

      // Resolve target recipients based on broadcast type
      const resolvedClubId = clubId || auth.clubId;
      if (!resolvedClubId) {
        return NextResponse.json({ error: 'clubId erforderlich für Broadcast' }, { status: 400 });
      }

      // Get club members (service client bypasses RLS)
      const serviceSb = createServiceClient();
      let recipientQuery = serviceSb
        .from('user_club_memberships')
        .select('user_id, users!inner(id)')
        .eq('club_id', resolvedClubId)
        .eq('is_active', true);

      if (broadcastType === 'trainers') {
        // Get trainer user_ids from trainer_club table
        const { data: trainers } = await serviceSb
          .from('trainer_clubs')
          .select('trainer_id, trainers!inner(user_id)')
          .eq('club_id', resolvedClubId);

        const trainerUserIds = (trainers || [])
          .map((t: any) => t.trainers?.user_id)
          .filter(Boolean);

        if (trainerUserIds.length === 0) {
          return NextResponse.json(
            { message: null, count: 0, note: 'Keine Trainer gefunden' },
            { status: 201 }
          );
        }

        recipientQuery = recipientQuery.in('user_id', trainerUserIds);
      }
      // 'all' and 'members' → no additional filter, all active club members

      const { data: recipients, error: recipientsError } = await recipientQuery;

      if (recipientsError) {
        console.error('[Messages] Broadcast recipient fetch error:', recipientsError);
        return NextResponse.json({ error: 'Fehler beim Laden der Empfänger' }, { status: 500 });
      }

      const recipientIds = [...new Set((recipients || []).map((r: any) => r.user_id))].filter(
        (id) => id !== user.id
      ); // Exclude sender

      if (recipientIds.length === 0) {
        return NextResponse.json(
          { message: null, count: 0, note: 'Keine Empfänger gefunden' },
          { status: 201 }
        );
      }

      // Create individual message rows for each recipient
      const messageRows = recipientIds.map((rid) => ({
        sender_id: user.id,
        receiver_id: rid,
        club_id: resolvedClubId,
        subject: subject.trim(),
        content: content.trim(),
        broadcast_type: broadcastType,
      }));

      const { data: insertedMessages, error: insertError } = await serviceSb
        .from('messages')
        .insert(messageRows)
        .select('id, receiver_id');

      if (insertError) {
        console.error('[Messages] Broadcast insert error:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      // Create notifications for all recipients (fire-and-forget)
      try {
        const notificationRows = recipientIds.map((rid) => ({
          user_id: rid,
          club_id: resolvedClubId,
          type: 'message_received',
          title: broadcastType === 'all' ? 'Neue Rundnachricht' : 'Neue Nachricht an Trainer',
          message: subject.trim(),
          link: '/messages',
        }));
        await serviceSb.from('notifications').insert(notificationRows);
      } catch {
        /* non-critical */
      }

      return NextResponse.json(
        { message: insertedMessages?.[0], count: recipientIds.length },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  });
}

// PATCH is handled by [id]/read/route.ts — uses proper Next.js route params
