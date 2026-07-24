'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { de } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CenteredModal } from '@/components/ui/centered-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Inbox,
  Send,
  PenSquare,
  Mail,
  ArrowLeft,
  Reply,
  Loader2,
  Users,
  GraduationCap,
  UserCheck,
  Search,
  X,
  Check,
  ChevronsUpDown,
  MailOpen,
  MessageSquare,
  CheckCircle2,
  Newspaper,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { ScrollReveal } from '@/components/animations';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/messages/RichTextEditor';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import { apiFetch } from '@/lib/api-fetch';
import { useUserRole } from '@/hooks/use-user-role';
import { useUserClub, useUserRoles } from '@/hooks/use-user-data';
import { useMessagesRealtime } from '@/hooks/use-messages-realtime';
import NewsAnnouncements from '@/components/news-announcements';

const EmailCampaignsClient = dynamic(
  () => import('@/app/(protected)/admin/(gated)/email-campaigns/email-campaigns-client'),
  { ssr: false }
);

/* ─────────────────── Types ─────────────────── */

interface MessageUser {
  full_name: string;
  email: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  club_id: string | null;
  subject: string;
  content: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  replied_to_id: string | null;
  broadcast_type: string | null;
  sender: MessageUser;
  receiver: MessageUser;
}

interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

type Folder = 'inbox' | 'sent' | 'news';

/** Strip HTML tags from a string for plain-text display. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/* ─────────────────── Main Component ─────────────────── */

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const [folder, setFolder] = useState<Folder>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipientId, setComposeRecipientId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Auto-open compose dialog when navigated with ?compose={userId}
  useEffect(() => {
    const composeUserId = searchParams.get('compose');
    if (composeUserId) {
      setComposeRecipientId(composeUserId);
      setComposeOpen(true);
      // Clean up URL without page reload
      window.history.replaceState(null, '', '/messages');
    }
  }, [searchParams]);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: userRoles } = useUserRoles();
  const { isAdmin } = useUserRole(userRoles);
  const { data: clubData } = useUserClub();
  const clubId = clubData?.clubId ?? null;

  // ── Fetch messages ──
  const fetchMessages = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/messages?folder=${folder}`, { signal });
        if (!res.ok) throw new Error('Fehler beim Laden');
        const data = await res.json();
        setMessages(data.messages ?? []);
        if (folder === 'inbox') setUnreadCount(data.unreadCount ?? 0);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        toast.error('Nachrichten konnten nicht geladen werden');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [folder]
  );

  useEffect(() => {
    if (folder === 'news') return;
    const controller = new AbortController();
    fetchMessages(controller.signal);
    return () => controller.abort();
  }, [fetchMessages, folder]);

  // Supabase Realtime — live message updates
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  useEffect(() => {
    import('@/src/infrastructure/external/supabase/client').then(({ createClient }) => {
      createClient()
        .auth.getUser()
        .then(({ data }) => {
          setCurrentUserId(data.user?.id);
        });
    });
  }, []);
  const handleRealtimeUpdate = useCallback(() => {
    if (folder !== 'news') fetchMessages();
  }, [folder, fetchMessages]);
  useMessagesRealtime(currentUserId, handleRealtimeUpdate);

  // ── Mark as read ──
  const markAsRead = useCallback(async (messageId: string) => {
    try {
      await apiFetch(`/api/messages/${messageId}/read`, { method: 'PATCH' });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, is_read: true } : m)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      /* non-critical */
    }
  }, []);

  // ── Filter messages by search ──
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.sender.full_name.toLowerCase().includes(q) ||
        stripHtml(m.content).toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  // ── Handle message click ──
  const handleMessageClick = (msg: Message) => {
    setSelectedMessage(msg);
    if (!msg.is_read && folder === 'inbox') {
      markAsRead(msg.id);
    }
  };

  // ── Stat calculations ──
  const totalMessages = messages.length;
  const readMessages = messages.filter((m) => m.is_read).length;

  const messagesView = (
    <div className="space-y-6">
      {/* ── Header ── */}
      <ScrollReveal>
        <PageHeader
          title="Nachrichten"
          description="Verwalte deine Nachrichten und Kommunikation"
          actions={[
            { label: 'Neue Nachricht', icon: PenSquare, onClick: () => setComposeOpen(true) },
          ]}
        />
      </ScrollReveal>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ScrollReveal delay={0}>
          <StatCard
            icon={Mail}
            label="Ungelesen"
            value={unreadCount}
            sub="im Posteingang"
            color="red"
            animate
          />
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <StatCard
            icon={MessageSquare}
            label={folder === 'inbox' ? 'Posteingang' : 'Gesendet'}
            value={totalMessages}
            sub="Nachrichten"
            color="blue"
            animate
          />
        </ScrollReveal>

        <ScrollReveal delay={160}>
          <StatCard
            icon={CheckCircle2}
            label="Gelesen"
            value={readMessages}
            sub="Nachrichten"
            color="green"
            animate
          />
        </ScrollReveal>

        <ScrollReveal delay={240}>
          <StatCard
            icon={MailOpen}
            label="Leserate"
            value={totalMessages > 0 ? Math.round((readMessages / totalMessages) * 100) : 0}
            sub="gelesen"
            color="orange"
            suffix="%"
            animate
          />
        </ScrollReveal>
      </div>

      {/* ── Folder Tabs + Message Content ── */}
      <ScrollReveal delay={300}>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Sidebar: Folders + Search */}
          <div className="lg:w-56 shrink-0 space-y-3">
            {/* Folder tabs */}
            <div className="flex lg:flex-col gap-1">
              <button
                onClick={() => {
                  setFolder('inbox');
                  setSelectedMessage(null);
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors flex-1 lg:flex-none ${
                  folder === 'inbox'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Inbox className="h-4 w-4" />
                Posteingang
                {unreadCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-2xs font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setFolder('sent');
                  setSelectedMessage(null);
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors flex-1 lg:flex-none ${
                  folder === 'sent'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Send className="h-4 w-4" />
                Gesendet
              </button>
              <button
                onClick={() => {
                  setFolder('news');
                  setSelectedMessage(null);
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors flex-1 lg:flex-none ${
                  folder === 'news'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Newspaper className="h-4 w-4" />
                News
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          {/* Message List + Detail / News Feed */}
          <div className="flex-1 min-w-0">
            {folder === 'news' ? (
              <NewsAnnouncements canManage={isAdmin} compact />
            ) : selectedMessage ? (
              <MessageDetail
                message={selectedMessage}
                onBack={() => setSelectedMessage(null)}
                onReply={() => {
                  setComposeOpen(true);
                }}
                folder={folder}
              />
            ) : (
              <MessageList
                messages={filteredMessages}
                loading={loading}
                folder={folder}
                onSelect={handleMessageClick}
              />
            )}
          </div>
        </div>
      </ScrollReveal>

      {/* Compose Dialog */}
      {composeOpen && (
        <ComposeDialog
          open={composeOpen}
          onClose={() => {
            setComposeOpen(false);
            setComposeRecipientId(null);
          }}
          clubId={clubId}
          isAdmin={isAdmin}
          replyTo={selectedMessage}
          initialReceiverId={composeRecipientId}
          onSent={() => {
            setComposeOpen(false);
            setComposeRecipientId(null);
            fetchMessages();
          }}
        />
      )}
    </div>
  );

  if (!isAdmin) return messagesView;

  return (
    <Tabs defaultValue="messages" className="space-y-4">
      <TabsList>
        <TabsTrigger value="messages" className="gap-1.5">
          <MessageSquare className="h-4 w-4" /> Nachrichten
        </TabsTrigger>
        <TabsTrigger value="campaigns" className="gap-1.5">
          <Mail className="h-4 w-4" /> E-Mail-Kampagnen
        </TabsTrigger>
      </TabsList>
      <TabsContent value="messages">{messagesView}</TabsContent>
      <TabsContent value="campaigns">
        {clubId ? (
          <EmailCampaignsClient clubId={clubId} />
        ) : (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

/* ─────────────────── Message List ─────────────────── */

function MessageList({
  messages,
  loading,
  folder,
  onSelect,
}: {
  messages: Message[];
  loading: boolean;
  folder: Folder;
  onSelect: (msg: Message) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Mail className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">
          {folder === 'inbox' ? 'Posteingang ist leer' : 'Keine gesendeten Nachrichten'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden divide-y divide-border/40">
      {messages.map((msg) => {
        const person = folder === 'sent' ? msg.receiver : msg.sender;
        const isBroadcast = !!msg.broadcast_type;
        return (
          <button
            key={msg.id}
            onClick={() => onSelect(msg)}
            className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            {/* Unread indicator */}
            <div className="pt-1.5 shrink-0">
              {folder === 'inbox' && !msg.is_read ? (
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              ) : (
                <div className="h-2.5 w-2.5 rounded-full bg-transparent" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm truncate ${folder === 'inbox' && !msg.is_read ? 'font-bold text-foreground' : 'font-medium text-foreground/80'}`}
                >
                  {person.full_name}
                </span>
                {isBroadcast && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-info-50 dark:bg-info-900/20 text-[9px] font-semibold text-info-700 dark:text-info-300 border border-info-100 dark:border-info-700/30">
                    <Users className="h-2.5 w-2.5" />
                    Rundnachricht
                  </span>
                )}
                <span className="ml-auto text-2xs text-muted-foreground shrink-0">
                  {format(new Date(msg.created_at), 'dd.MM.yy HH:mm', { locale: de })}
                </span>
              </div>
              <p
                className={`text-sm truncate ${folder === 'inbox' && !msg.is_read ? 'font-semibold' : 'text-muted-foreground'}`}
              >
                {msg.subject}
              </p>
              <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                {stripHtml(msg.content).substring(0, 80)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────── Message Detail ─────────────────── */

function MessageDetail({
  message,
  onBack,
  onReply,
  folder,
}: {
  message: Message;
  onBack: () => void;
  onReply: () => void;
  folder: Folder;
}) {
  const person = folder === 'sent' ? message.receiver : message.sender;

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-muted/30">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-foreground truncate">{message.subject}</h2>
          <p className="text-xs text-muted-foreground">
            {folder === 'sent' ? 'An' : 'Von'}: {person.full_name} ({person.email}){' · '}
            {format(new Date(message.created_at), 'dd. MMMM yyyy, HH:mm', { locale: de })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReply} className="gap-1.5 shrink-0">
          <Reply className="h-3.5 w-3.5" />
          Antworten
        </Button>
      </div>

      {/* Content — render HTML from TipTap, fall back to plain text */}
      <div className="px-4 py-4">
        {/<[a-z][\s\S]*>/i.test(message.content) ? (
          <div
            className="prose prose-sm max-w-none text-foreground dark:prose-invert [&_script]:hidden [&_iframe]:hidden"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.content) }}
          />
        ) : (
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── Compose Dialog ─────────────────── */

function ComposeDialog({
  open,
  onClose,
  clubId,
  isAdmin,
  replyTo,
  initialReceiverId,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  clubId: string | null;
  isAdmin: boolean;
  replyTo: Message | null;
  initialReceiverId?: string | null;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState(
    replyTo ? (replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`) : ''
  );
  const [content, setContent] = useState('');
  const [recipientMode, setRecipientMode] = useState<'individual' | 'all' | 'trainers' | 'multi'>(
    'individual'
  );
  const [receiverId, setReceiverId] = useState(replyTo?.sender_id ?? initialReceiverId ?? '');
  const [selectedReceiverIds, setSelectedReceiverIds] = useState<string[]>(
    replyTo?.sender_id ? [replyTo.sender_id] : initialReceiverId ? [initialReceiverId] : []
  );
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!memberDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMemberDropdownOpen(false);
        setMemberSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [memberDropdownOpen]);

  // Fetch club members for recipient selection
  useEffect(() => {
    if (!clubId || (recipientMode !== 'individual' && recipientMode !== 'multi')) return;
    setMembersLoading(true);
    apiFetch(`/api/members?clubId=${clubId}&limit=100&active=true`)
      .then((res) => res.json())
      .then((data) => {
        const items = (data.members ?? []).map((m: any) => ({
          id: m.userId ?? m.id,
          full_name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
          email: m.email,
          role: m.role ?? 'member',
        }));
        setMembers(items);
        // Auto-set receiverId for reply if it's in the list
        const targetId = replyTo?.sender_id ?? initialReceiverId;
        if (targetId && items.some((m: ClubMember) => m.id === targetId)) {
          setReceiverId(targetId);
        }
      })
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [clubId, recipientMode, replyTo?.sender_id, initialReceiverId]);

  const toggleReceiver = (id: string) => {
    setSelectedReceiverIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.toLowerCase();
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
    );
  }, [members, memberSearch]);

  const handleSend = async () => {
    // Strip HTML tags to check if content is actually empty
    const textContent = stripHtml(content);
    if (!subject.trim() || !textContent) {
      toast.error('Betreff und Nachricht sind erforderlich');
      return;
    }

    if (recipientMode === 'individual' && !receiverId) {
      toast.error('Bitte wähle einen Empfänger');
      return;
    }
    if (recipientMode === 'multi' && selectedReceiverIds.length === 0) {
      toast.error('Bitte wähle mindestens einen Empfänger');
      return;
    }

    setSending(true);
    try {
      const payload: Record<string, any> = {
        subject: subject.trim(),
        content: content.trim(),
        clubId,
      };

      if (recipientMode === 'individual') {
        payload.receiverId = receiverId;
        if (replyTo) payload.repliedToId = replyTo.id;
      } else if (recipientMode === 'multi') {
        payload.receiverIds = selectedReceiverIds;
        if (replyTo) payload.repliedToId = replyTo.id;
      } else {
        payload.broadcastType = recipientMode;
      }

      const res = await apiFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Fehler beim Senden');
      }

      const data = await res.json();
      const count = data.count ?? 1;
      if (count === 0) {
        toast.error(data.note ?? 'Keine Empfänger gefunden — Nachricht wurde nicht gesendet');
        return;
      }
      toast.success(count > 1 ? `Nachricht an ${count} Empfänger gesendet` : 'Nachricht gesendet');
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Senden');
    } finally {
      setSending(false);
    }
  };

  return (
    <CenteredModal open={open} onClose={onClose}>
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <PenSquare className="h-5 w-5" />
          Neue Nachricht
        </h2>
      </div>

      <div className="space-y-4 py-2">
        {/* Recipient mode (admin only) */}
        {isAdmin && (
          <div className="space-y-2">
            <Label>Empfänger</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={recipientMode === 'individual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setRecipientMode('individual');
                  setSelectedReceiverIds([]);
                }}
                className="gap-1.5"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Einzeln
              </Button>
              <Button
                variant={recipientMode === 'multi' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setRecipientMode('multi');
                  setReceiverId('');
                }}
                className="gap-1.5"
              >
                <Users className="h-3.5 w-3.5" />
                Mehrere
              </Button>
              <Button
                variant={recipientMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRecipientMode('all')}
                className="gap-1.5"
              >
                <Users className="h-3.5 w-3.5" />
                Alle Mitglieder
              </Button>
              <Button
                variant={recipientMode === 'trainers' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRecipientMode('trainers')}
                className="gap-1.5"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Nur Trainer
              </Button>
            </div>
          </div>
        )}

        {/* Individual recipient select */}
        {(recipientMode === 'individual' || !isAdmin) && (
          <div className="space-y-2">
            <Label htmlFor="receiver">Empfänger</Label>
            {membersLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Lade Mitglieder...
              </div>
            ) : (
              <Select value={receiverId} onValueChange={setReceiverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Empfänger auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name} ({m.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Multi-recipient select */}
        {isAdmin && recipientMode === 'multi' && (
          <div className="space-y-2">
            <Label>Empfänger auswählen</Label>
            {membersLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Lade Mitglieder...
              </div>
            ) : (
              <>
                {/* Selected recipients as badges */}
                {selectedReceiverIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedReceiverIds.map((id) => {
                      const member = members.find((m) => m.id === id);
                      if (!member) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium"
                        >
                          {member.full_name}
                          <button
                            type="button"
                            onClick={() => toggleReceiver(id)}
                            className="hover:bg-primary/20 rounded-md p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedReceiverIds([])}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Alle entfernen
                    </button>
                  </div>
                )}

                {/* Searchable member dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setMemberDropdownOpen(!memberDropdownOpen)}
                    className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-muted-foreground">
                      {selectedReceiverIds.length > 0
                        ? `${selectedReceiverIds.length} ausgewählt`
                        : 'Mitglieder suchen & auswählen...'}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                  </button>

                  {memberDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-background shadow-lg">
                      <div className="p-2 border-b border-border">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Name, E-Mail oder Rolle suchen..."
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            className="border-0 bg-muted/50 pl-8 pr-3 py-1.5 h-8 text-sm focus-visible:ring-1"
                            // eslint-disable-next-line jsx-a11y/no-autofocus -- search input needs focus on dropdown open
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto p-1">
                        {/* Quick actions */}
                        <button
                          type="button"
                          onClick={() => {
                            const memberIds = members
                              .filter((m) => m.role === 'member')
                              .map((m) => m.id);
                            setSelectedReceiverIds(memberIds);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors font-medium text-primary"
                        >
                          <Users className="h-4 w-4" />
                          Alle Mitglieder auswählen
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const trainerIds = members
                              .filter((m) => m.role === 'trainer')
                              .map((m) => m.id);
                            setSelectedReceiverIds(trainerIds);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors font-medium text-primary"
                        >
                          <GraduationCap className="h-4 w-4" />
                          Alle Trainer auswählen
                        </button>
                        <div className="h-px bg-border my-1" />

                        {/* Member list */}
                        {filteredMembers.map((m) => {
                          const isSelected = selectedReceiverIds.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => toggleReceiver(m.id)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors ${
                                isSelected ? 'bg-primary/5' : ''
                              }`}
                            >
                              <div
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                  isSelected
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'border-border'
                                }`}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                              <span className="flex-1 truncate">{m.full_name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {m.role === 'trainer' ? 'Trainer' : 'Mitglied'}
                              </span>
                            </button>
                          );
                        })}
                        {filteredMembers.length === 0 && (
                          <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                            Keine Mitglieder gefunden
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Broadcast info */}
        {isAdmin && recipientMode !== 'individual' && recipientMode !== 'multi' && (
          <div className="rounded-xl bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-700/30 px-3 py-2 text-sm text-info-800 dark:text-info-300">
            {recipientMode === 'all' &&
              '📣 Nachricht wird an alle aktiven Vereinsmitglieder gesendet.'}
            {recipientMode === 'trainers' &&
              '📣 Nachricht wird an alle Trainer des Vereins gesendet.'}
          </div>
        )}

        {/* Subject */}
        <div className="space-y-2">
          <Label htmlFor="subject">Betreff</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Betreff eingeben..."
          />
        </div>

        {/* Content — Rich Text Editor */}
        <div className="space-y-2">
          <Label>Nachricht</Label>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Deine Nachricht schreiben..."
            minHeight="180px"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
          Abbrechen
        </Button>
        <Button onClick={handleSend} disabled={sending} className="gap-1.5">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? 'Wird gesendet...' : 'Senden'}
        </Button>
      </div>
    </CenteredModal>
  );
}
