'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { differenceInCalendarDays, format, isToday, isYesterday } from 'date-fns';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Copy,
  Info,
  Loader2,
  LogOut,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  MoreHorizontal,
  PenSquare,
  Pencil,
  Reply,
  Search,
  Send,
  SmilePlus,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { de } from '@/lib/locale';
import { apiFetch } from '@/lib/api-fetch';
import { extractErrorMessage } from '@/lib/typed-helpers';
import { CHAT_REACTIONS } from '@/lib/chat-reactions';
import { useChatRealtime, type ChatRealtimeMessage } from '@/hooks/use-chat-realtime';
import { NewChatDialog } from '@/components/chat/new-chat-dialog';
import { ChatAvatar } from '@/components/chat/chat-avatar';
import NewsAnnouncements from '@/components/news-announcements';

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

interface Reaction {
  emoji: string;
  user_ids: string[];
}

interface Msg extends ChatRealtimeMessage {
  sender_name?: string;
  reactions?: Reaction[];
}

interface NewsTeaser {
  title: string;
  pinned: boolean;
  unread: number;
}

type Filter = 'all' | 'unread' | 'group' | 'direct';

interface Props {
  clubId: string | null;
  userId?: string;
  isAdmin: boolean;
  canCreateGroup: boolean;
}

const PAGE = 40;
const FILTERS: [Filter, string][] = [
  ['all', 'Alle'],
  ['unread', 'Ungelesen'],
  ['group', 'Gruppen'],
  ['direct', 'Direkt'],
];

async function call<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(data) || 'Anfrage fehlgeschlagen');
  return data as T;
}

function listTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Gestern';
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, 'EEE', { locale: de });
  return format(d, 'dd.MM.', { locale: de });
}

function listBucket(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return 'Heute';
  if (isYesterday(d)) return 'Gestern';
  if (differenceInCalendarDays(new Date(), d) < 7) return 'Diese Woche';
  return 'Älter';
}

function convTitle(c: Conversation, userId?: string) {
  if (c.kind === 'group') return c.title ?? 'Gruppe';
  return c.participants.find((p) => p.user_id !== userId)?.name ?? 'Unterhaltung';
}

function otherId(c: Conversation, userId?: string) {
  return c.participants.find((p) => p.user_id !== userId)?.user_id ?? c.id;
}

/** Reaktion setzen/entfernen, idempotent (Echo per Realtime ändert nichts mehr). */
function patchReactions(list: Reaction[], uid: string, emoji: string, removed: boolean) {
  const has = list.find((r) => r.emoji === emoji);
  if (removed) {
    return list
      .map((r) => (r.emoji === emoji ? { ...r, user_ids: r.user_ids.filter((u) => u !== uid) } : r))
      .filter((r) => r.user_ids.length > 0);
  }
  if (has?.user_ids.includes(uid)) return list;
  return has
    ? list.map((r) => (r.emoji === emoji ? { ...r, user_ids: [...r.user_ids, uid] } : r))
    : [...list, { emoji, user_ids: [uid] }];
}

const newsOpenInitially = (sp: URLSearchParams) => sp.get('section') === 'news';

export function ChatView({ clubId, userId, isAdmin, canCreateGroup }: Props) {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newsOpen, setNewsOpen] = useState(newsOpenInitially(searchParams));
  const [newsTeaser, setNewsTeaser] = useState<NewsTeaser | null>(null);
  // Einmal geöffnet, gelten die News als gesehen (NewsAnnouncements markiert sie gelesen).
  const [newsSeen, setNewsSeen] = useState(newsOpenInitially(searchParams));
  const [messages, setMessages] = useState<Msg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(true);
  const [infoSheet, setInfoSheet] = useState(false);
  const [msgSheet, setMsgSheet] = useState<Msg | null>(null);
  const [convSheet, setConvSheet] = useState<Conversation | null>(null);

  const selectedRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const names = useRef(new Map<string, string>());
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const stickBottom = useRef(true);

  useEffect(() => {
    selectedRef.current = selectedId;
    conversationsRef.current = conversations;
  });

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  // Namen für Avatare/Reaktionen — aus Teilnehmern und geladenen Nachrichten (kein Ref im Render).
  const nameOf = useMemo(() => {
    const map = new Map(selected?.participants.map((p) => [p.user_id, p.name]) ?? []);
    messages.forEach((m) => m.sender_name && map.set(m.sender_id, m.sender_name));
    return map;
  }, [selected, messages]);

  // ── Handy: gedrückt halten öffnet die Aktionen (ersetzt Hover). ──
  const pressTimer = useRef<number | undefined>(undefined);
  const pressed = useRef(false);
  const longPress = (fn: () => void) => ({
    onTouchStart: () => {
      pressed.current = false;
      pressTimer.current = window.setTimeout(() => {
        pressed.current = true;
        navigator.vibrate?.(10);
        fn();
      }, 450);
    },
    onTouchEnd: () => window.clearTimeout(pressTimer.current),
    onTouchMove: () => window.clearTimeout(pressTimer.current),
    onContextMenu: (e: MouseEvent) => {
      if (window.matchMedia('(pointer: coarse)').matches) e.preventDefault();
    },
  });

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

  // Vereinsnews als angepinnte Karte über der Liste. Lesen markiert hier nichts.
  useEffect(() => {
    call<{ news?: Record<string, unknown>[] }>('/api/news')
      .then(({ news = [] }) => {
        const top = news.find((n) => n.is_pinned) ?? news[0];
        setNewsTeaser(
          top
            ? {
                title: String(top.title ?? ''),
                pinned: Boolean(top.is_pinned),
                unread: news.filter((n) => n.is_read === false).length,
              }
            : null
        );
      })
      .catch(() => setNewsTeaser(null));
  }, [clubId]);

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
      setNewsOpen(false);
      selectedRef.current = id;
      setMessages([]);
      setEditing(null);
      setReplyTo(null);
      setDraft('');
      window.history.replaceState(null, '', id ? `/messages?c=${id}` : '/messages');
      if (id) {
        loadMessages(id);
        markRead(id);
      }
    },
    [loadMessages, markRead]
  );

  const openNews = () => {
    select(null);
    setNewsOpen(true);
    setNewsSeen(true);
    window.history.replaceState(null, '', '/messages?section=news');
  };

  const openDirect = useCallback(
    async (otherUserId: string) => {
      try {
        const { id } = await call<{ id: string }>('/api/chat/conversations', {
          method: 'POST',
          body: JSON.stringify({ kind: 'direct', userId: otherUserId }),
        });
        await loadConversations();
        select(id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Chat konnte nicht geöffnet werden');
      }
    },
    [loadConversations, select]
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
      openDirect(compose);
    }
  }, [searchParams, loading, clubId, select, openDirect]);

  const applyReaction = useCallback(
    (messageId: string, uid: string, emoji: string, removed: boolean) =>
      setMessages((prev) =>
        prev.map((x) =>
          x.id === messageId
            ? { ...x, reactions: patchReactions(x.reactions ?? [], uid, emoji, removed) }
            : x
        )
      ),
    []
  );

  useChatRealtime(userId, (e) => {
    if (e.type === 'resync') {
      loadConversations();
      if (selectedRef.current) loadMessages(selectedRef.current);
      return;
    }
    if (e.type === 'reaction') {
      const r = e.reaction;
      if (selectedRef.current === r.conversation_id) {
        applyReaction(r.message_id, r.user_id, r.emoji, r.removed);
      }
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
          : [...prev, { ...m, sender_name: names.current.get(m.sender_id), reactions: [] }]
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
        { method: 'POST', body: JSON.stringify({ body, replyToId: replyTo?.id ?? null }) }
      );
      setDraft('');
      setReplyTo(null);
      stickBottom.current = true;
      setMessages((prev) =>
        prev.some((x) => x.id === message.id) ? prev : [...prev, { ...message, reactions: [] }]
      );
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

  const toggleReaction = (m: Msg, emoji: string) => {
    if (!userId) return;
    const on = !m.reactions?.find((r) => r.emoji === emoji)?.user_ids.includes(userId);
    applyReaction(m.id, userId, emoji, !on);
    call(`/api/chat/messages/${m.id}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji, on }),
    }).catch(() => {
      applyReaction(m.id, userId, emoji, on);
      toast.error('Reaktion fehlgeschlagen');
    });
  };

  const startReply = (m: Msg) => {
    setReplyTo(m);
    setEditing(null);
    composerRef.current?.focus();
  };

  const copy = (m: Msg) =>
    navigator.clipboard
      .writeText(m.body)
      .then(() => toast.success('Text kopiert'))
      .catch(() => toast.error('Kopieren nicht möglich'));

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
      if (selectedRef.current === c.id) select(null);
      setConversations((prev) => prev.filter((x) => x.id !== c.id));
      setInfoSheet(false);
      toast.success('Gruppe verlassen');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verlassen fehlgeschlagen');
    }
  };

  const openInfo = () => {
    if (window.matchMedia('(min-width: 1280px)').matches) setInfoOpen((v) => !v);
    else setInfoSheet(true);
  };

  const unreadTotal = conversations.reduce((s, c) => s + (c.unread_count > 0 ? 1 : 0), 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === 'unread' && c.unread_count === 0) return false;
      if (filter === 'group' && c.kind !== 'group') return false;
      if (filter === 'direct' && c.kind !== 'direct') return false;
      return (
        !q ||
        convTitle(c, userId).toLowerCase().includes(q) ||
        (c.last_message_preview ?? '').toLowerCase().includes(q)
      );
    });
  }, [conversations, search, filter, userId]);

  const recentContacts = useMemo(
    () =>
      conversations
        .filter((c) => c.kind === 'direct')
        .slice(0, 6)
        .map((c) => ({ id: otherId(c, userId), name: convTitle(c, userId) })),
    [conversations, userId]
  );

  const showThread = Boolean(selected) || newsOpen;

  const messageMenuItems = (m: Msg, Item: (p: ItemProps) => ReactElement) => {
    const mine = m.sender_id === userId;
    return (
      <>
        <Item onSelect={() => startReply(m)}>
          <Reply className="h-4 w-4" /> Antworten
        </Item>
        <Item onSelect={() => copy(m)}>
          <Copy className="h-4 w-4" /> Text kopieren
        </Item>
        {selected?.kind === 'group' && !mine && (
          <Item onSelect={() => openDirect(m.sender_id)}>
            <MessageSquare className="h-4 w-4" /> Privat an {m.sender_name ?? 'Mitglied'}
          </Item>
        )}
        {mine && (
          <Item onSelect={() => setEditing({ id: m.id, text: m.body })}>
            <Pencil className="h-4 w-4" /> Bearbeiten
          </Item>
        )}
        {mine && (
          <Item onSelect={() => remove(m.id)} destructive>
            <Trash2 className="h-4 w-4" /> Löschen
          </Item>
        )}
      </>
    );
  };

  return (
    <>
      <div className="flex h-[calc(100dvh-15rem)] min-h-[30rem] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        {/* ── Liste ── */}
        <div
          className={cn(
            'relative w-full shrink-0 flex-col border-border/60 lg:flex lg:w-80 lg:border-r xl:w-[22rem]',
            showThread ? 'hidden' : 'flex'
          )}
        >
          <div className="space-y-3 border-b border-border/60 p-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Personen, Gruppen, Nachrichten…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 rounded-xl pl-9 text-sm"
                  aria-label="Chats durchsuchen"
                />
              </div>
              <Button
                variant="highlight"
                className="hidden h-10 rounded-xl lg:inline-flex"
                onClick={() => setNewChatOpen(true)}
              >
                <PenSquare className="h-4 w-4" /> Neu
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Chats filtern">
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    filter === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                  {key === 'unread' && unreadTotal > 0 && (
                    <span className="rounded-full bg-highlight px-1.5 text-[10px] text-highlight-foreground">
                      {unreadTotal}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-20 lg:pb-2">
            {newsTeaser && (
              <button
                type="button"
                onClick={openNews}
                className={cn(
                  'mx-3 mt-3 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl bg-primary px-3.5 py-3 text-left text-primary-foreground transition-opacity hover:opacity-95',
                  newsOpen && 'ring-2 ring-highlight ring-offset-2 ring-offset-card'
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-highlight text-highlight-foreground">
                  <Megaphone className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{newsTeaser.title}</span>
                  <span className="block truncate text-xs opacity-75">
                    Vereinsnews{newsTeaser.pinned ? ' · angepinnt' : ''}
                  </span>
                </span>
                {newsTeaser.unread > 0 && !newsSeen && (
                  <span className="shrink-0 rounded-full bg-highlight px-2 text-xs font-bold text-highlight-foreground">
                    {newsTeaser.unread}
                  </span>
                )}
              </button>
            )}

            {loading ? (
              <div className="space-y-2 p-3" role="status" aria-label="Wird geladen">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-10 text-center text-sm text-muted-foreground">
                <MessagesSquare className="h-10 w-10 opacity-40" />
                {conversations.length === 0 ? (
                  <>
                    <p>Noch keine Chats.</p>
                    <Button variant="highlight" size="sm" onClick={() => setNewChatOpen(true)}>
                      <PenSquare className="h-4 w-4" /> Ersten Chat starten
                    </Button>
                  </>
                ) : (
                  <p>Keine Treffer</p>
                )}
              </div>
            ) : (
              filtered.map((c, i) => {
                const bucket = listBucket(c.last_message_at);
                const newBucket = i === 0 || listBucket(filtered[i - 1].last_message_at) !== bucket;
                const title = convTitle(c, userId);
                const unread = c.unread_count > 0;
                return (
                  <div key={c.id}>
                    {newBucket && (
                      <p className="px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {bucket}
                      </p>
                    )}
                    <button
                      type="button"
                      {...longPress(() => setConvSheet(c))}
                      onClick={() => {
                        if (pressed.current) {
                          pressed.current = false;
                          return;
                        }
                        select(c.id);
                      }}
                      className={cn(
                        'mx-1.5 flex w-[calc(100%-0.75rem)] select-none items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-muted/60',
                        c.id === selectedId && 'bg-accent hover:bg-accent'
                      )}
                    >
                      <ChatAvatar id={otherId(c, userId)} name={title} group={c.kind === 'group'} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn('truncate text-sm', unread ? 'font-bold' : 'font-medium')}
                          >
                            {title}
                          </span>
                          <span
                            className={cn(
                              'shrink-0 text-xs',
                              unread && !c.muted
                                ? 'font-semibold text-foreground'
                                : 'text-muted-foreground'
                            )}
                          >
                            {listTime(c.last_message_at)}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'truncate text-[13px]',
                              unread ? 'font-medium text-foreground' : 'text-muted-foreground'
                            )}
                          >
                            {c.last_message_preview ?? 'Noch keine Nachrichten'}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            {c.muted && (
                              <BellOff
                                className="h-3.5 w-3.5 text-muted-foreground"
                                aria-label="Stumm"
                              />
                            )}
                            {unread && (
                              <span
                                className={cn(
                                  'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
                                  c.muted
                                    ? 'bg-muted-foreground text-background'
                                    : 'bg-primary text-primary-foreground'
                                )}
                              >
                                {c.unread_count}
                              </span>
                            )}
                          </span>
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Handy: schwebender Knopf statt Kopfzeilen-Aktion */}
          <Button
            variant="highlight"
            size="icon"
            className="absolute bottom-4 right-4 h-14 w-14 rounded-2xl shadow-lg lg:hidden"
            onClick={() => setNewChatOpen(true)}
            aria-label="Neue Nachricht"
          >
            <PenSquare className="h-6 w-6" />
          </Button>
        </div>

        {/* ── Verlauf / Vereinsnews ── */}
        <div className={cn('min-w-0 flex-1 flex-col lg:flex', showThread ? 'flex' : 'hidden')}>
          {newsOpen ? (
            <>
              <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setNewsOpen(false)}
                  aria-label="Zurück"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-highlight text-highlight-foreground">
                  <Megaphone className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Vereinsnews</p>
                  <p className="text-xs text-muted-foreground">
                    Ankündigungen an den ganzen Verein
                  </p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto bg-muted/30 p-4">
                <NewsAnnouncements canManage={isAdmin} />
              </div>
            </>
          ) : !selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-muted/30 p-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card shadow-sm">
                <MessagesSquare className="h-8 w-8 text-muted-foreground" />
              </span>
              <p className="font-semibold">Wähle einen Chat aus</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Oder schreib jemandem aus dem Verein — einer Person, deiner Trainingsgruppe oder
                allen.
              </p>
              <Button variant="highlight" onClick={() => setNewChatOpen(true)}>
                <PenSquare className="h-4 w-4" /> Neue Nachricht
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => select(null)}
                  aria-label="Zurück"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  onClick={openInfo}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                >
                  <ChatAvatar
                    id={otherId(selected, userId)}
                    name={convTitle(selected, userId)}
                    group={selected.kind === 'group'}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {convTitle(selected, userId)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {selected.kind === 'group'
                        ? `${selected.participant_count} Mitglieder · ${selected.participants
                            .slice(0, 3)
                            .map((p) => (p.user_id === userId ? 'Du' : p.name.split(' ')[0]))
                            .join(', ')}${selected.participant_count > 3 ? ' …' : ''}`
                        : 'Direktnachricht'}
                    </span>
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleMute(selected)}
                  aria-label={selected.muted ? 'Stummschaltung aufheben' : 'Stummschalten'}
                  title={selected.muted ? 'Stummschaltung aufheben' : 'Stummschalten'}
                >
                  {selected.muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={openInfo}
                  aria-label="Details"
                  title="Details"
                  className={cn(infoOpen && 'xl:bg-muted xl:text-foreground')}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto bg-muted/30 px-3 py-3 sm:px-5">
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
                  const isGroup = selected.kind === 'group';
                  const prev = messages[i - 1];
                  const day = format(new Date(m.created_at), 'yyyy-MM-dd');
                  const newDay = !prev || format(new Date(prev.created_at), 'yyyy-MM-dd') !== day;
                  const runStart = newDay || prev.sender_id !== m.sender_id;
                  const name = nameOf.get(m.sender_id) ?? 'Mitglied';
                  const replied = m.reply_to_id ? byId.get(m.reply_to_id) : undefined;
                  const active = !m.deleted_at && editing?.id !== m.id;
                  return (
                    <div key={m.id} id={`msg-${m.id}`} className={runStart ? 'mt-3' : 'mt-0.5'}>
                      {newDay && (
                        <p className="my-3 text-center">
                          <span className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
                            {isToday(new Date(m.created_at))
                              ? 'Heute'
                              : isYesterday(new Date(m.created_at))
                                ? 'Gestern'
                                : format(new Date(m.created_at), 'EEEE, d. MMMM', { locale: de })}
                          </span>
                        </p>
                      )}
                      <div className={cn('group flex items-end gap-2', mine && 'flex-row-reverse')}>
                        {isGroup &&
                          !mine &&
                          (runStart ? (
                            <ChatAvatar id={m.sender_id} name={name} size="sm" />
                          ) : (
                            <span className="w-7 shrink-0" />
                          ))}
                        <div
                          className={cn(
                            'flex min-w-0 max-w-[80%] flex-col sm:max-w-[70%]',
                            mine ? 'items-end' : 'items-start'
                          )}
                        >
                          {isGroup && !mine && runStart && (
                            <p className="mb-1 px-1 text-xs font-semibold text-muted-foreground">
                              {name}
                            </p>
                          )}
                          {editing?.id === m.id ? (
                            <div className="flex w-full min-w-64 items-end gap-1">
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
                              {...(active ? longPress(() => setMsgSheet(m)) : {})}
                              className={cn(
                                'select-none whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed sm:select-text',
                                m.deleted_at
                                  ? 'border border-dashed border-border italic text-muted-foreground'
                                  : mine
                                    ? 'rounded-br-md bg-primary text-primary-foreground'
                                    : 'rounded-bl-md border border-border/60 bg-card'
                              )}
                            >
                              {m.reply_to_id && !m.deleted_at && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    document
                                      .getElementById(`msg-${m.reply_to_id}`)
                                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                  }
                                  className={cn(
                                    'mb-1.5 block w-full rounded-lg border-l-[3px] border-highlight px-2 py-1 text-left text-xs',
                                    mine ? 'bg-primary-foreground/10' : 'bg-muted'
                                  )}
                                >
                                  <span className="block font-semibold">
                                    {replied
                                      ? replied.sender_id === userId
                                        ? 'Du'
                                        : (replied.sender_name ?? 'Mitglied')
                                      : 'Antwort'}
                                  </span>
                                  <span className="line-clamp-2 opacity-80">
                                    {replied
                                      ? replied.deleted_at
                                        ? 'Nachricht gelöscht'
                                        : replied.body
                                      : 'auf eine ältere Nachricht'}
                                  </span>
                                </button>
                              )}
                              {m.deleted_at ? 'Nachricht gelöscht' : m.body}
                              <span
                                className={cn(
                                  'ml-2 inline-flex translate-y-0.5 select-none items-center gap-0.5 text-[11px]',
                                  mine && !m.deleted_at
                                    ? 'text-primary-foreground/70'
                                    : 'text-muted-foreground'
                                )}
                              >
                                {format(new Date(m.created_at), 'HH:mm')}
                                {m.edited_at && !m.deleted_at ? ' · bearbeitet' : ''}
                                {mine && !m.deleted_at && <CheckCheck className="h-3 w-3" />}
                              </span>
                            </div>
                          )}
                          {!m.deleted_at && (m.reactions?.length ?? 0) > 0 && (
                            <div className="-mt-1.5 flex flex-wrap gap-1 px-2">
                              {m.reactions!.map((r) => {
                                const own = !!userId && r.user_ids.includes(userId);
                                return (
                                  <button
                                    key={r.emoji}
                                    type="button"
                                    onClick={() => toggleReaction(m, r.emoji)}
                                    title={r.user_ids
                                      .map((u) =>
                                        u === userId ? 'Du' : (nameOf.get(u) ?? 'Mitglied')
                                      )
                                      .join(', ')}
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-xs shadow-sm transition-colors',
                                      own
                                        ? 'border-primary/40 bg-accent font-semibold'
                                        : 'border-border bg-card hover:bg-muted'
                                    )}
                                  >
                                    {r.emoji}
                                    {r.user_ids.length > 1 && <span>{r.user_ids.length}</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Desktop: Aktionen bei Hover/Fokus; auf dem Handy über Gedrückthalten */}
                        {active && (
                          <div className="hidden shrink-0 items-center gap-0.5 self-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100 md:flex">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  aria-label="Reagieren"
                                >
                                  <SmilePlus className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align={mine ? 'end' : 'start'}
                                className="flex min-w-0 gap-0.5 rounded-full p-1"
                              >
                                {CHAT_REACTIONS.map((emoji) => (
                                  <DropdownMenuItem
                                    key={emoji}
                                    onSelect={() => toggleReaction(m, emoji)}
                                    className="rounded-full px-2 text-lg"
                                    aria-label={`Mit ${emoji} reagieren`}
                                  >
                                    {emoji}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => startReply(m)}
                              aria-label="Antworten"
                            >
                              <Reply className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  aria-label="Weitere Aktionen"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align={mine ? 'end' : 'start'}>
                                {messageMenuItems(m, MenuItem)}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <div className="border-t border-border/60 bg-card p-3">
                {replyTo && (
                  <div className="mb-2 flex items-center gap-2 rounded-xl border-l-4 border-highlight bg-muted/70 py-1.5 pl-3 pr-1 text-xs">
                    <Reply className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        Antwort an{' '}
                        {replyTo.sender_id === userId
                          ? 'dich selbst'
                          : (replyTo.sender_name ?? 'Mitglied')}
                      </p>
                      <p className="truncate text-muted-foreground">{replyTo.body}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setReplyTo(null)}
                      aria-label="Antwort verwerfen"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-background py-1.5 pl-1 pr-1.5 focus-within:ring-2 focus-within:ring-ring/40">
                  <Textarea
                    ref={composerRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        send();
                      }
                      if (e.key === 'Escape') setReplyTo(null);
                    }}
                    placeholder={`Nachricht an ${convTitle(selected, userId)}…`}
                    aria-label="Nachricht schreiben"
                    maxLength={5000}
                    rows={1}
                    className="max-h-40 min-h-9 resize-none border-0 bg-transparent text-sm shadow-none [field-sizing:content] focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Button
                    variant="highlight"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-xl"
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
                <p className="mt-1.5 hidden px-1 text-[11px] text-muted-foreground md:block">
                  Enter senden · Shift+Enter neue Zeile
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── Details (breite Bildschirme) ── */}
        {selected && infoOpen && !newsOpen && (
          <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-border/60 xl:block">
            <ConversationInfo
              conv={selected}
              userId={userId}
              onToggleMute={() => toggleMute(selected)}
              onLeave={() => leave(selected)}
              onMessage={(id) => openDirect(id)}
            />
          </aside>
        )}
      </div>

      {/* Details als Sheet (schmalere Bildschirme) */}
      <Sheet open={infoSheet && !!selected} onOpenChange={setInfoSheet}>
        <SheetContent side="right" className="w-full max-w-sm overflow-y-auto p-0">
          <SheetTitle className="sr-only">Details</SheetTitle>
          {selected && (
            <ConversationInfo
              conv={selected}
              userId={userId}
              onToggleMute={() => toggleMute(selected)}
              onLeave={() => leave(selected)}
              onMessage={(id) => {
                setInfoSheet(false);
                openDirect(id);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Handy: Nachricht gedrückt halten */}
      <Sheet open={!!msgSheet} onOpenChange={(o) => !o && setMsgSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-8 pt-3">
          <SheetTitle className="sr-only">Aktionen für die Nachricht</SheetTitle>
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
          {msgSheet && (
            <>
              <div className="mb-3 flex justify-between rounded-full bg-muted px-4 py-2">
                {CHAT_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="text-2xl transition-transform active:scale-125"
                    aria-label={`Mit ${emoji} reagieren`}
                    onClick={() => {
                      toggleReaction(msgSheet, emoji);
                      setMsgSheet(null);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="divide-y divide-border/60">
                {messageMenuItems(msgSheet, (props) => (
                  <SheetItem
                    {...props}
                    onSelect={() => {
                      setMsgSheet(null);
                      props.onSelect?.();
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Handy: Chat in der Liste gedrückt halten */}
      <Sheet open={!!convSheet} onOpenChange={(o) => !o && setConvSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-8 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
          {convSheet && (
            <>
              <SheetTitle className="mb-2 px-2 text-base">
                {convTitle(convSheet, userId)}
              </SheetTitle>
              <div className="divide-y divide-border/60">
                {convSheet.unread_count > 0 && (
                  <SheetItem
                    onSelect={() => {
                      markRead(convSheet.id);
                      setConvSheet(null);
                    }}
                  >
                    <CheckCheck className="h-4 w-4" /> Als gelesen markieren
                  </SheetItem>
                )}
                <SheetItem
                  onSelect={() => {
                    toggleMute(convSheet);
                    setConvSheet(null);
                  }}
                >
                  {convSheet.muted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  {convSheet.muted ? 'Stummschaltung aufheben' : 'Stummschalten'}
                </SheetItem>
                {convSheet.kind === 'group' && (
                  <SheetItem
                    destructive
                    onSelect={() => {
                      leave(convSheet);
                      setConvSheet(null);
                    }}
                  >
                    <LogOut className="h-4 w-4" /> Gruppe verlassen
                  </SheetItem>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        clubId={clubId}
        isAdmin={isAdmin}
        canCreateGroup={canCreateGroup}
        currentUserId={userId}
        recent={recentContacts}
        onCreated={async (id) => {
          setNewChatOpen(false);
          await loadConversations();
          select(id);
        }}
      />
    </>
  );
}

interface ItemProps {
  onSelect?: () => void;
  destructive?: boolean;
  children: ReactNode;
}

/** Menüeintrag fürs Dropdown (Desktop) — gleiche Props wie `SheetItem`. */
function MenuItem({ onSelect, destructive, children }: ItemProps) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className={cn('gap-2', destructive && 'text-destructive focus:text-destructive')}
    >
      {children}
    </DropdownMenuItem>
  );
}

/** Großer Tippbereich im Bottom-Sheet (Handy). */
function SheetItem({ onSelect, destructive, children }: ItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-4 px-2 py-3.5 text-left text-[15px] active:bg-muted',
        destructive && 'text-destructive'
      )}
    >
      {children}
    </button>
  );
}

function ConversationInfo({
  conv,
  userId,
  onToggleMute,
  onLeave,
  onMessage,
}: {
  conv: Conversation;
  userId?: string;
  onToggleMute: () => void;
  onLeave: () => void;
  onMessage: (userId: string) => void;
}) {
  const title = convTitle(conv, userId);
  const others = conv.participants.filter((p) => p.user_id !== userId);
  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <ChatAvatar
          id={otherId(conv, userId)}
          name={title}
          group={conv.kind === 'group'}
          size="lg"
        />
        <p className="text-base font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">
          {conv.kind === 'group'
            ? `Gruppe · ${conv.participant_count} Mitglieder`
            : 'Direktnachricht'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={onToggleMute} className="rounded-xl">
          {conv.muted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          {conv.muted ? 'Ton an' : 'Stumm'}
        </Button>
        {conv.kind === 'group' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onLeave}
            className="rounded-xl text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Verlassen
          </Button>
        ) : (
          <span />
        )}
      </div>

      {conv.kind === 'group' && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mitglieder · {conv.participant_count}
          </p>
          <ul className="space-y-0.5">
            {conv.participants.map((p) => (
              <li key={p.user_id}>
                {p.user_id === userId ? (
                  <div className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 text-sm">
                    <ChatAvatar id={p.user_id} name={p.name} size="sm" />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">Du</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onMessage(p.user_id)}
                    className="group/member flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left text-sm hover:bg-muted"
                    title={`Privat an ${p.name} schreiben`}
                  >
                    <ChatAvatar id={p.user_id} name={p.name} size="sm" />
                    <span className="truncate">{p.name}</span>
                    <MessageSquare className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/member:opacity-100" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {conv.participant_count > conv.participants.length && (
            <p className="mt-2 px-1.5 text-xs text-muted-foreground">
              und {conv.participant_count - conv.participants.length} weitere
            </p>
          )}
        </div>
      )}

      {conv.kind === 'direct' && others[0] && (
        <p className="text-center text-xs text-muted-foreground">
          Nur du und {others[0].name} seht diese Unterhaltung.
        </p>
      )}
    </div>
  );
}
