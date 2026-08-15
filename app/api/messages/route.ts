import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { pushNotificationService } from '@/lib/push-notification.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:messages');

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
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || 'inbox';
    const countOnly = searchParams.get('countOnly') === 'true';
    const sb = auth.supabase as any;
    const user = auth.user;

    const column = folder === 'sent' ? 'sender_id' : 'receiver_id';

    /**
     * Ordner-Sichten (Migration 20260815160000):
     *   inbox   — an mich, nicht gelöscht, nicht archiviert
     *   archive — an mich, nicht gelöscht, archiviert
     *   sent    — von mir, nicht aus „Gesendet" entfernt
     * Ohne diese Filter tauchte jede archivierte oder gelöschte Nachricht
     * weiter im Posteingang auf.
     */
    const applyFolderFilter = (q: any) => {
      if (folder === 'sent') return q.is('sender_deleted_at', null);
      q = q.is('deleted_at', null);
      return folder === 'archive' ? q.not('archived_at', 'is', null) : q.is('archived_at', null);
    };

    // Lightweight count-only mode for notification bell polling
    if (countOnly && folder === 'inbox') {
      const { count, error } = await applyFolderFilter(
        sb
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .eq('is_read', false)
      );

      if (error) {
        return internalErrorResponse();
      }
      return NextResponse.json({ unreadCount: count ?? 0 });
    }

    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10) || 10));

    const { data: messages, error } = await applyFolderFilter(
      sb.from('messages').select('*').eq(column, user.id)
    )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return internalErrorResponse();
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
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const user = auth.user;
    const body = await request.json();
    const { receiverId, receiverIds, subject, content, clubId, repliedToId, broadcastType } =
      body as {
        receiverId?: string;
        receiverIds?: string[];
        subject?: string;
        content?: string;
        clubId?: string;
        repliedToId?: string;
        broadcastType?: 'all' | 'trainers' | 'members';
      };

    if (!subject?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'subject und content sind erforderlich' }, { status: 400 });
    }

    if (!broadcastType && !receiverId && (!receiverIds || receiverIds.length === 0)) {
      return NextResponse.json(
        { error: 'receiverId, receiverIds oder broadcastType erforderlich' },
        { status: 400 }
      );
    }

    // Use service client for broadcast/multi (bypasses RLS for cross-user inserts)
    // but user-scoped client for direct messages (RLS checks sender_id)
    const sb =
      broadcastType || (receiverIds && receiverIds.length > 1)
        ? createServiceClient()
        : (auth.supabase as any);

    // ── Multi-recipient message ──
    if (receiverIds && receiverIds.length > 0 && !broadcastType) {
      const targetIds = receiverIds.filter((id) => id !== user.id);
      if (targetIds.length === 0) {
        return NextResponse.json(
          { message: null, count: 0, note: 'Keine Empfänger angegeben' },
          { status: 201 }
        );
      }

      const messageRows = targetIds.map((rid) => ({
        sender_id: user.id,
        receiver_id: rid,
        club_id: clubId || null,
        subject: subject.trim(),
        content: content.trim(),
        replied_to_id: repliedToId || null,
      }));

      const { data: insertedMessages, error: insertError } = await sb
        .from('messages')
        .insert(messageRows)
        .select('id, receiver_id');

      if (insertError) {
        return internalErrorResponse();
      }

      // Create notifications + push for all recipients (fire-and-forget)
      try {
        const notificationRows = targetIds.map((rid) => ({
          user_id: rid,
          club_id: clubId || null,
          type: 'message_received',
          title: 'Neue Nachricht',
          message: subject.trim(),
          action_url: '/messages',
        }));
        await sb.from('notifications').insert(notificationRows);
        // Push notifications
        for (const rid of targetIds) {
          pushNotificationService
            .sendToUser(rid, {
              title: 'Neue Nachricht',
              body: `${subject.trim()} — ${content.trim().substring(0, 80)}`,
              url: '/messages',
              tag: `msg-${insertedMessages?.[0]?.id ?? 'new'}`,
            })
            .catch(() => {
              /* non-blocking */
            });
        }
      } catch {
        /* non-critical */
      }

      return NextResponse.json(
        { message: insertedMessages?.[0], count: targetIds.length },
        { status: 201 }
      );
    }

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
        return internalErrorResponse();
      }

      // Create notification + push for receiver (non-blocking)
      try {
        await sb.from('notifications').insert({
          user_id: receiverId,
          club_id: clubId || null,
          type: 'message_received',
          title: 'Neue Nachricht',
          message: subject.trim(),
          action_url: '/messages',
        });
        pushNotificationService
          .sendToUser(receiverId, {
            title: 'Neue Nachricht',
            body: `${subject.trim()} — ${content.trim().substring(0, 80)}`,
            url: '/messages',
            tag: `msg-${data?.id ?? 'new'}`,
          })
          .catch(() => {
            /* non-blocking */
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
      // Note: plain `user_id` select — `user_club_memberships.user_id` has no FK
      // constraint to `users.id` (only `deactivated_by` does), so a `users!inner(id)`
      // embed silently resolves via that unrelated FK and drops every active member.
      const serviceSb = createServiceClient();
      let recipientQuery = serviceSb
        .from('user_club_memberships')
        .select('user_id')
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
        log.error('[Messages] Broadcast recipient fetch error:', recipientsError);
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
        log.error('[Messages] Broadcast insert error:', insertError);
        return internalErrorResponse();
      }

      // Create notifications for all recipients (fire-and-forget)
      try {
        const notificationRows = recipientIds.map((rid) => ({
          user_id: rid,
          club_id: resolvedClubId,
          type: 'message_received',
          title: broadcastType === 'all' ? 'Neue Rundnachricht' : 'Neue Nachricht an Trainer',
          message: subject.trim(),
          action_url: '/messages',
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
