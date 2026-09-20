/**
 * Chat (ADR-005): einziger DB-Zugriff für Unterhaltungen. RLS: supabase/migrations/
 * 20260920150000_chat_conversations.sql — Anlegen nur über die RPCs, Teilnahme
 * per `is_conversation_participant`.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import type { Tables } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:chat.repository');

export type ChatMessage = Tables<'conversation_messages'>;
export type ChatMessageWithSender = ChatMessage & { sender_name: string };

/** Zeile aus `list_my_conversations`; `participants` ist auf 50 Einträge begrenzt. */
export interface ChatConversation {
  id: string;
  club_id: string;
  kind: 'direct' | 'group';
  title: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  muted: boolean;
  last_read_at: string;
  participant_count: number;
  participants: { user_id: string; name: string }[];
}

/** Postgres-Fehlercodes der RPCs/RLS → fachliche Fehler, nie die rohe DB-Meldung. */
function fail(error: { code?: string; message: string } | null, action: string): void {
  if (!error) return;
  if (error.code === '42501') throw new ApiException('FORBIDDEN', 'Dafür fehlt die Berechtigung');
  if (error.code === '22023') throw new ApiException('VALIDATION_ERROR', error.message);
  log.error(action, new Error(error.message));
  throw new Error(action);
}

export class ChatRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async listConversations(clubId: string | null): Promise<ChatConversation[]> {
    const { data, error } = await this.db.rpc('list_my_conversations', {
      p_club_id: clubId ?? undefined,
    });
    fail(error, 'Laden der Unterhaltungen fehlgeschlagen');
    return (data ?? []) as unknown as ChatConversation[];
  }

  async startDirect(clubId: string, otherUserId: string): Promise<string> {
    const { data, error } = await this.db.rpc('start_direct_conversation', {
      p_club_id: clubId,
      p_other: otherUserId,
    });
    fail(error, 'Anlegen der Unterhaltung fehlgeschlagen');
    return data as string;
  }

  async createGroup(
    clubId: string,
    title: string,
    audience: 'custom' | 'all' | 'trainers',
    userIds: string[]
  ): Promise<string> {
    const { data, error } = await this.db.rpc('create_group_conversation', {
      p_club_id: clubId,
      p_title: title,
      p_audience: audience,
      p_user_ids: userIds,
    });
    fail(error, 'Anlegen der Gruppe fehlgeschlagen');
    return data as string;
  }

  async unreadTotal(): Promise<number> {
    const { data, error } = await this.db.rpc('chat_unread_total');
    fail(error, 'Laden der ungelesenen Nachrichten fehlgeschlagen');
    return (data as number) ?? 0;
  }

  /** Neueste zuerst gelesen, aufsteigend zurückgegeben. `before` = created_at-Cursor. */
  async listMessages(
    conversationId: string,
    before: string | null,
    limit: number
  ): Promise<ChatMessageWithSender[]> {
    let q = this.db
      .from('conversation_messages')
      .select()
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit);
    if (before) q = q.lt('created_at', before);
    const { data, error } = await q;
    fail(error, 'Laden der Nachrichten fehlgeschlagen');
    const rows = (data ?? []).reverse();
    const names = await this.userNames([...new Set(rows.map((m) => m.sender_id))]);
    return rows.map((m) => ({ ...m, sender_name: names.get(m.sender_id) ?? 'Mitglied' }));
  }

  async insertMessage(
    conversationId: string,
    senderId: string,
    body: string,
    replyToId: string | null
  ): Promise<ChatMessage> {
    const { data, error } = await this.db
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        body,
        reply_to_id: replyToId,
      })
      .select()
      .single();
    fail(error, 'Senden der Nachricht fehlgeschlagen');
    return data!;
  }

  async updateMessage(
    id: string,
    patch: { body: string; edited_at: string } | { deleted_at: string; body: string }
  ): Promise<ChatMessage | null> {
    const { data, error } = await this.db
      .from('conversation_messages')
      .update(patch)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .maybeSingle();
    fail(error, 'Ändern der Nachricht fehlgeschlagen');
    return data;
  }

  async updateParticipant(
    conversationId: string,
    userId: string,
    patch: { last_read_at?: string; muted?: boolean }
  ): Promise<boolean> {
    const { data, error } = await this.db
      .from('conversation_participants')
      .update(patch)
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .select('user_id');
    fail(error, 'Ändern der Unterhaltung fehlgeschlagen');
    return (data?.length ?? 0) > 0;
  }

  async leave(conversationId: string, userId: string): Promise<void> {
    const { error } = await this.db
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
    fail(error, 'Verlassen der Unterhaltung fehlgeschlagen');
  }

  async findConversation(id: string): Promise<Tables<'conversations'> | null> {
    const { data, error } = await this.db.from('conversations').select().eq('id', id).maybeSingle();
    fail(error, 'Laden der Unterhaltung fehlgeschlagen');
    return data;
  }

  async listRecipients(conversationId: string, exceptUserId: string) {
    const { data, error } = await this.db
      .from('conversation_participants')
      .select('user_id, muted')
      .eq('conversation_id', conversationId)
      .neq('user_id', exceptUserId)
      .limit(500);
    fail(error, 'Laden der Teilnehmer fehlgeschlagen');
    return data ?? [];
  }

  async userNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const { data, error } = await this.db
      .from('users')
      .select('id, full_name, email')
      .in('id', ids);
    fail(error, 'Laden der Namen fehlgeschlagen');
    return new Map((data ?? []).map((u) => [u.id, u.full_name || u.email]));
  }
}
