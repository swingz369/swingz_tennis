'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { useUserRole } from '@/hooks/use-user-role';
import { useUserClub } from '@/hooks/use-user-data';

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

type Folder = 'inbox' | 'sent';

/* ─────────────────── Main Component ─────────────────── */

export default function MessagesPage() {
  const [folder, setFolder] = useState<Folder>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { isAdmin } = useUserRole();
  const { data: clubData } = useUserClub();
  const clubId = clubData?.clubId ?? null;

  // ── Fetch messages ──
  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/messages?folder=${folder}`);
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      setMessages(data.messages ?? []);
      if (folder === 'inbox') setUnreadCount(data.unreadCount ?? 0);
    } catch {
      toast.error('Nachrichten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

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
        m.content.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  // ── Handle message click ──
  const handleMessageClick = (msg: Message) => {
    setSelectedMessage(msg);
    if (!msg.is_read && folder === 'inbox') {
      markAsRead(msg.id);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nachrichten</h1>
          <p className="text-sm text-muted-foreground">
            Verwalte deine Nachrichten und Kommunikation
          </p>
        </div>
        <Button onClick={() => setComposeOpen(true)} className="gap-2">
          <PenSquare className="h-4 w-4" />
          Neue Nachricht
        </Button>
      </div>

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
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 lg:flex-none ${
                folder === 'inbox'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Inbox className="h-4 w-4" />
              Posteingang
              {unreadCount > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setFolder('sent');
                setSelectedMessage(null);
              }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 lg:flex-none ${
                folder === 'sent'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Send className="h-4 w-4" />
              Gesendet
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

        {/* Message List + Detail */}
        <div className="flex-1 min-w-0">
          {selectedMessage ? (
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

      {/* Compose Dialog */}
      {composeOpen && (
        <ComposeDialog
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
          clubId={clubId}
          isAdmin={isAdmin}
          replyTo={selectedMessage}
          onSent={() => {
            setComposeOpen(false);
            fetchMessages();
          }}
        />
      )}
    </div>
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
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-[9px] font-semibold text-blue-700 border border-blue-100">
                    <Users className="h-2.5 w-2.5" />
                    Rundnachricht
                  </span>
                )}
                <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                  {format(new Date(msg.created_at), 'dd.MM.yy HH:mm', { locale: de })}
                </span>
              </div>
              <p
                className={`text-sm truncate ${folder === 'inbox' && !msg.is_read ? 'font-semibold' : 'text-muted-foreground'}`}
              >
                {msg.subject}
              </p>
              <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                {msg.content.substring(0, 80)}
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

      {/* Content */}
      <div className="px-4 py-4">
        <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
          {message.content}
        </div>
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
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  clubId: string | null;
  isAdmin: boolean;
  replyTo: Message | null;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState(
    replyTo?.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo?.subject ?? ''}`
  );
  const [content, setContent] = useState('');
  const [recipientMode, setRecipientMode] = useState<'individual' | 'all' | 'trainers'>(
    'individual'
  );
  const [receiverId, setReceiverId] = useState(replyTo?.sender_id ?? '');
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch club members for recipient selection
  useEffect(() => {
    if (!clubId || recipientMode !== 'individual') return;
    setMembersLoading(true);
    apiFetch(`/api/members?clubId=${clubId}&limit=100&active=true`)
      .then((res) => res.json())
      .then((data) => {
        const items = (data.members ?? []).map((m: any) => ({
          id: m.userId ?? m.id,
          full_name: m.fullName ?? m.full_name ?? m.email,
          email: m.email,
          role: m.role ?? 'member',
        }));
        setMembers(items);
        // Auto-set receiverId for reply if it's in the list
        if (replyTo?.sender_id && items.some((m: ClubMember) => m.id === replyTo.sender_id)) {
          setReceiverId(replyTo.sender_id);
        }
      })
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [clubId, recipientMode, replyTo?.sender_id]);

  const handleSend = async () => {
    if (!subject.trim() || !content.trim()) {
      toast.error('Betreff und Nachricht sind erforderlich');
      return;
    }

    if (recipientMode === 'individual' && !receiverId) {
      toast.error('Bitte wähle einen Empfänger');
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
                onClick={() => setRecipientMode('individual')}
                className="gap-1.5"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Einzeln
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

        {/* Broadcast info */}
        {isAdmin && recipientMode !== 'individual' && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
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

        {/* Content */}
        <div className="space-y-2">
          <Label htmlFor="content">Nachricht</Label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Deine Nachricht..."
            rows={6}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
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
