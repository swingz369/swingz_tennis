'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, isToday, isYesterday } from 'date-fns';
import {
  ArrowLeft,
  BellOff,
  Bell,
  Check,
  Loader2,
  LogOut,
  MessageSquare,
  Pencil,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { de } from '@/lib/locale';
import { apiFetch } from '@/lib/api-fetch';
import { extractErrorMessage } from '@/lib/typed-helpers';
import { useChatRealtime, type ChatRealtimeMessage } from '@/hooks/use-chat-realtime';
import { NewChatDialog } from '@/components/chat/new-chat-dialog';

interface Conversation {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  muted: boolean;
  participant_count: number;
  participants: { user_id: string; name: string }[];
}

interface Msg extends ChatRealtimeMessage {
  sender_name?: string;
}

interface Props {
  clubId: string | null;
  userId?: string;
  isAdmin: boolean;
  canCreateGroup: boolean;
  newChatOpen: boolean;
  onNewChatClose: () => void;
}

const PAGE = 40;

async function call<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(data) || 'Anfrage fehlgeschlagen');
  return data as T;
}

function listTime(iso: string) {
  const d = new Date(iso);
  return isToday(d)
    ? format(d, 'HH:mm')
    : isYesterday(d)
      ? 'Gestern'
      : format(d, 'dd.MM.', { locale: de });
}

function convTitle(c: Conversation, userId?: string) {
  if (c.kind === 'group') return c.title ?? 'Gruppe';
  return c.participants.find((p) => p.user_id !== userId)?.name ?? 'Unterhaltung';
}

export function ChatView({
  clubId,
  userId,
  isAdmin,
  canCreateGroup,
  newChatOpen,
  onNewChatClose,
}: Props) {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const selectedRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const names = useRef(new Map<string, string>());
  const endRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);

  useEffect(() => {
    selectedRef.current = selectedId;
    conversationsRef.current = conversations;
  });

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const loadConversations = useCallback(async () => {
    try {
      const data = await call<{ conversations: Conversation[] }>('/api/chat/conversations');
      data.conversations.forEach((c) =>
        c.participants.forEach((p) => names.current.set(p.user_id, p.name))
      );
      setConversations(data.conversations);
    } catch {
      toast.error('Chats konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, clubId]);

  const markRead = useCallback((id: string) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)));
    call(`/api/chat/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    }).catch(() => undefined);
  }, []);

  const loadMessages = useCallback(async (id: string, before?: string) => {
    setMessagesLoading(true);
    try {
      const q = new URLSearchParams({ limit: String(PAGE), ...(before ? { before } : {}) });
      const data = await call<{ messages: Msg[]; hasMore: boolean }>(
        `/api/chat/conversations/${id}/messages?${q}`
      );
      data.messages.forEach((m) => m.sender_name && names.current.set(m.sender_id, m.sender_name));
      if (selectedRef.current !== id) return;
      stickBottom.current = !before;
      setMessages((prev) => (before ? [...data.messages, ...prev] : data.messages));
      setHasMore(data.hasMore);
    } catch {
      toast.error('Nachrichten konnten nicht geladen werden');
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      selectedRef.current = id;
      setMessages([]);
      setEditing(null);
      setDraft('');
      window.history.replaceState(null, '', id ? `/messages?c=${id}` : '/messages');
      if (id) {
        loadMessages(id);
        markRead(id);
      }
    },
    [loadMessages, markRead]
  );

  // Einstieg über ?c=<id> (Push) oder ?compose=<userId> (z. B. Matchmaking).
  const entered = useRef(false);
  useEffect(() => {
    if (entered.current || loading) return;
    const c = searchParams.get('c');
    const compose = searchParams.get('compose');
    if (c) {
      entered.current = true;
      select(c);
    } else if (compose && clubId) {
      entered.current = true;
      call<{ id: string }>('/api/chat/conversations', {
        method: 'POST',
        body: JSON.stringify({ kind: 'direct', userId: compose }),
      })
        .then(async ({ id }) => {
          await loadConversations();
          select(id);
        })
        .catch((e: Error) => toast.error(e.message));
    }
  }, [searchParams, loading, clubId, select, loadConversations]);

  useChatRealtime(userId, (e) => {
    if (e.type === 'resync') {
      loadConversations();
      if (selectedRef.current) loadMessages(selectedRef.current);
      return;
    }
    const m = e.message;
    const open = selectedRef.current === m.conversation_id;
    if (e.type === 'message_updated') {
      if (open) setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
      return;
    }
    if (!conversationsRef.current.some((c) => c.id === m.conversation_id)) {
      loadConversations();
    } else {
      const mine = m.sender_id === userId;
      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === m.conversation_id
              ? {
                  ...c,
                  last_message_at: m.created_at,
                  last_message_preview: m.body.slice(0, 120),
                  unread_count: mine || open ? c.unread_count : c.unread_count + 1,
                }
              : c
          )
          .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
      );
    }
    if (open) {
      stickBottom.current = true;
      setMessages((prev) =>
        prev.some((x) => x.id === m.id)
          ? prev
          : [...prev, { ...m, sender_name: names.current.get(m.sender_id) }]
      );
      if (m.sender_id !== userId) markRead(m.conversation_id);
    }
  });

  useEffect(() => {
    if (stickBottom.current) endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !selectedId || sending) return;
    setSending(true);
    try {
      const { message } = await call<{ message: Msg }>(
        `/api/chat/conversations/${selectedId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ body }),
        }
      );
      setDraft('');
      stickBottom.current = true;
      setMessages((prev) => (prev.some((x) => x.id === message.id) ? prev : [...prev, message]));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Nachricht konnte nicht gesendet werden');
    } finally {
      setSending(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || !editing.text.trim()) return;
    try {
      const { message } = await call<{ message: Msg }>(`/api/chat/messages/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ body: editing.text }),
      });
      setMessages((prev) => prev.map((x) => (x.id === message.id ? { ...x, ...message } : x)));
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Änderung fehlgeschlagen');
    }
  };

  const remove = async (id: string) => {
    try {
      await call(`/api/chat/messages/${id}`, { method: 'DELETE' });
      setMessages((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, body: '', deleted_at: new Date().toISOString() } : x
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    }
  };

  const toggleMute = async (c: Conversation) => {
    setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, muted: !c.muted } : x)));
    call(`/api/chat/conversations/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ muted: !c.muted }),
    }).catch(() => {
      toast.error('Stummschaltung fehlgeschlagen');
      loadConversations();
    });
  };

  const leave = async (c: Conversation) => {
    try {
      await call(`/api/chat/conversations/${c.id}`, { method: 'DELETE' });
      select(null);
      setConversations((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verlassen fehlgeschlagen');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        convTitle(c, userId).toLowerCase().includes(q) ||
        (c.last_message_preview ?? '').toLowerCase().includes(q)
    );
  }, [conversations, search, userId]);

  return (
    <>
      <div className="flex h-[calc(100dvh-17rem)] min-h-[28rem] overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        {/* Liste */}
        <div
          className={cn(
            'w-full shrink-0 flex-col border-border/60 lg:flex lg:w-80 lg:border-r',
            selected ? 'hidden' : 'flex'
          )}
        >
          <div className="relative border-b border-border/60 p-2">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3" role="status" aria-label="Wird geladen">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
                <MessageSquare className="h-9 w-9 opacity-40" />
                {conversations.length === 0
                  ? 'Noch keine Chats. Starte mit „Neuer Chat“.'
                  : 'Keine Treffer'}
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c.id)}
                  className={cn(
                    'flex w-full items-start gap-3 border-b border-border/40 px-3 py-3 text-left transition-colors hover:bg-muted/50',
                    c.id === selectedId && 'bg-primary/5'
                  )}
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {c.kind === 'group' ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      convTitle(c, userId).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          c.unread_count > 0 ? 'font-semibold' : 'font-medium'
                        )}
                      >
                        {convTitle(c, userId)}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {listTime(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-xs',
                          c.unread_count > 0 ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {c.last_message_preview ?? 'Noch keine Nachrichten'}
                      </span>
                      {c.unread_count > 0 && (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-1.5 text-xs font-medium text-primary-foreground',
                            c.muted ? 'bg-muted-foreground' : 'bg-primary'
                          )}
                        >
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Verlauf */}
        <div className={cn('min-w-0 flex-1 flex-col lg:flex', selected ? 'flex' : 'hidden')}>
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-40" />
              <p className="text-sm">Wähle einen Chat aus</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => select(null)}
                  aria-label="Zurück"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{convTitle(selected, userId)}</p>
                  {selected.kind === 'group' && (
                    <p className="truncate text-xs text-muted-foreground">
                      {selected.participant_count} Teilnehmer
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleMute(selected)}
                  aria-label={selected.muted ? 'Stummschaltung aufheben' : 'Stummschalten'}
                  title={selected.muted ? 'Stummschaltung aufheben' : 'Stummschalten'}
                >
                  {selected.muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                </Button>
                {selected.kind === 'group' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => leave(selected)}
                    aria-label="Gruppe verlassen"
                    title="Gruppe verlassen"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
                {hasMore && (
                  <div className="flex justify-center pb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={messagesLoading}
                      onClick={() => loadMessages(selected.id, messages[0]?.created_at)}
                    >
                      {messagesLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      Ältere Nachrichten laden
                    </Button>
                  </div>
                )}
                {messages.map((m, i) => {
                  const mine = m.sender_id === userId;
                  const showName =
                    selected.kind === 'group' &&
                    !mine &&
                    messages[i - 1]?.sender_id !== m.sender_id;
                  const day = format(new Date(m.created_at), 'yyyy-MM-dd');
                  const newDay =
                    i === 0 || format(new Date(messages[i - 1].created_at), 'yyyy-MM-dd') !== day;
                  return (
                    <div key={m.id}>
                      {newDay && (
                        <p className="py-2 text-center text-xs text-muted-foreground">
                          {isToday(new Date(m.created_at))
                            ? 'Heute'
                            : format(new Date(m.created_at), 'EEEE, dd. MMMM', { locale: de })}
                        </p>
                      )}
                      {showName && (
                        <p className="mt-2 px-1 text-xs font-medium text-muted-foreground">
                          {m.sender_name ?? 'Mitglied'}
                        </p>
                      )}
                      <div
                        className={cn(
                          'group flex items-end gap-1',
                          mine ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {mine && !m.deleted_at && editing?.id !== m.id && (
                          <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditing({ id: m.id, text: m.body })}
                              aria-label="Bearbeiten"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => remove(m.id)}
                              aria-label="Löschen"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {editing?.id === m.id ? (
                          <div className="flex w-full max-w-[75%] items-end gap-1">
                            <Textarea
                              // eslint-disable-next-line jsx-a11y/no-autofocus -- Fokus nach bewusstem Klick auf „Bearbeiten“
                              autoFocus
                              value={editing.text}
                              onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  saveEdit();
                                }
                                if (e.key === 'Escape') setEditing(null);
                              }}
                              className="min-h-9 resize-none text-sm [field-sizing:content]"
                              rows={1}
                            />
                            <Button
                              size="icon"
                              className="h-9 w-9 shrink-0"
                              onClick={saveEdit}
                              aria-label="Speichern"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 shrink-0"
                              onClick={() => setEditing(null)}
                              aria-label="Abbrechen"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              'max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm',
                              m.deleted_at
                                ? 'border border-dashed border-border italic text-muted-foreground'
                                : mine
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                            )}
                          >
                            {m.deleted_at ? 'Nachricht gelöscht' : m.body}
                            <span
                              className={cn(
                                'ml-2 select-none text-[10px]',
                                mine && !m.deleted_at
                                  ? 'text-primary-foreground/70'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {format(new Date(m.created_at), 'HH:mm')}
                              {m.edited_at && !m.deleted_at ? ' · bearbeitet' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <div className="flex items-end gap-2 border-t border-border/60 p-3">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Nachricht schreiben…"
                  maxLength={5000}
                  rows={1}
                  className="max-h-40 min-h-10 resize-none text-sm [field-sizing:content]"
                />
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={send}
                  disabled={sending || !draft.trim()}
                  aria-label="Senden"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <NewChatDialog
        open={newChatOpen}
        onClose={onNewChatClose}
        clubId={clubId}
        isAdmin={isAdmin}
        canCreateGroup={canCreateGroup}
        currentUserId={userId}
        onCreated={async (id) => {
          onNewChatClose();
          await loadConversations();
          select(id);
        }}
      />
    </>
  );
}
