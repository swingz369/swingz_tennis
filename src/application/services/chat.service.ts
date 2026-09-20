import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { getUserDb } from '@/infrastructure/db';
import { pushNotificationService } from '@/lib/push-notification.service';
import { createLogger } from '@/lib/logger';
import { ChatRepository } from '@/infrastructure/persistence/repositories/chat.repository';

const log = createLogger('chat.service');

const PUSH_LIMIT = 50;

/** Chat: Unterhaltungen, Nachrichten, Lesemarken. Echtzeit läuft per DB-Trigger (Broadcast). */
export class ChatService {
  private readonly repo: ChatRepository;
  private readonly userId: string;

  constructor(auth: AuthContext) {
    this.repo = new ChatRepository(getUserDb(auth));
    this.userId = auth.user.id;
  }

  listConversations(clubId: string | null) {
    return this.repo.listConversations(clubId);
  }

  unreadTotal() {
    return this.repo.unreadTotal();
  }

  startDirect(clubId: string, otherUserId: string) {
    return this.repo.startDirect(clubId, otherUserId);
  }

  createGroup(
    clubId: string,
    title: string,
    audience: 'custom' | 'all' | 'trainers',
    userIds: string[]
  ) {
    return this.repo.createGroup(clubId, title, audience, userIds);
  }

  listMessages(conversationId: string, before: string | null, limit: number) {
    return this.repo.listMessages(conversationId, before, limit);
  }

  async sendMessage(conversationId: string, body: string, replyToId: string | null) {
    const message = await this.repo.insertMessage(conversationId, this.userId, body, replyToId);
    // Eigene Nachricht gilt als gelesen; Fehler hier sind nicht kritisch.
    this.repo
      .updateParticipant(conversationId, this.userId, { last_read_at: message.created_at })
      .catch(() => undefined);
    this.push(conversationId, body).catch((e) =>
      log.warn('Push fehlgeschlagen', { error: String(e) })
    );
    return message;
  }

  async editMessage(id: string, body: string) {
    const msg = await this.repo.updateMessage(id, { body, edited_at: new Date().toISOString() });
    if (!msg) throw new ApiException('NOT_FOUND', 'Nachricht nicht gefunden');
    return msg;
  }

  async deleteMessage(id: string) {
    const msg = await this.repo.updateMessage(id, {
      deleted_at: new Date().toISOString(),
      body: '',
    });
    if (!msg) throw new ApiException('NOT_FOUND', 'Nachricht nicht gefunden');
  }

  async updateOwnState(conversationId: string, patch: { read?: true; muted?: boolean }) {
    const ok = await this.repo.updateParticipant(conversationId, this.userId, {
      ...(patch.read ? { last_read_at: new Date().toISOString() } : {}),
      ...(patch.muted === undefined ? {} : { muted: patch.muted }),
    });
    if (!ok) throw new ApiException('NOT_FOUND', 'Unterhaltung nicht gefunden');
  }

  async leave(conversationId: string) {
    const conv = await this.repo.findConversation(conversationId);
    if (!conv) throw new ApiException('NOT_FOUND', 'Unterhaltung nicht gefunden');
    if (conv.kind === 'direct') {
      throw new ApiException('VALIDATION_ERROR', 'Direktnachrichten lassen sich nicht verlassen');
    }
    await this.repo.leave(conversationId, this.userId);
  }

  private async push(conversationId: string, body: string) {
    const [conv, recipients, names] = await Promise.all([
      this.repo.findConversation(conversationId),
      this.repo.listRecipients(conversationId, this.userId),
      this.repo.userNames([this.userId]),
    ]);
    if (!conv) return;
    const sender = names.get(this.userId) ?? 'Neue Nachricht';
    const title = conv.kind === 'group' ? `${conv.title} · ${sender}` : sender;
    for (const r of recipients.filter((x) => !x.muted).slice(0, PUSH_LIMIT)) {
      pushNotificationService
        .sendToUser(r.user_id, {
          title,
          body: body.slice(0, 100),
          url: `/messages?c=${conversationId}`,
          tag: `chat-${conversationId}`,
        })
        .catch(() => undefined);
    }
  }
}
