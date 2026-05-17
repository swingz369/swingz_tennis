'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, MailOpen, Send, ArrowLeft, Trash2, MessageSquare, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  subject: string;
  content: string;
  is_read: boolean;
  read_at: string | null;
  replied_to_id: string | null;
  created_at: string;
  sender?: { full_name: string; email: string };
  receiver?: { full_name: string; email: string };
}

interface InboxProps {
  folder?: 'inbox' | 'sent';
}

export function Inbox({ folder: initialFolder = 'inbox' }: InboxProps) {
  const [folder, setFolder] = useState<'inbox' | 'sent'>(initialFolder);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState({ receiverId: '', subject: '', content: '' });
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/messages?folder=${folder}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSelect = async (msg: Message) => {
    setSelectedMsg(msg);
    if (!msg.is_read && folder === 'inbox') {
      try {
        await fetch(`/api/messages/${msg.id}/read`, { method: 'PATCH' });
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m)));
      } catch {
        // silent
      }
    }
  };

  const handleSend = async () => {
    if (!composeData.receiverId || !composeData.subject || !composeData.content) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(composeData),
      });
      if (!res.ok) throw new Error('Send failed');
      toast.success('Nachricht gesendet');
      setShowCompose(false);
      setComposeData({ receiverId: '', subject: '', content: '' });
      if (folder === 'sent') fetchMessages();
    } catch {
      toast.error('Fehler beim Senden');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `Vor ${diffMins} Min.`;
    if (diffHours < 24) return `Vor ${diffHours} Std.`;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          {selectedMsg && (
            <Button variant="ghost" size="icon" onClick={() => setSelectedMsg(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {selectedMsg ? selectedMsg.subject : folder === 'inbox' ? 'Posteingang' : 'Gesendet'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={folder === 'inbox' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setFolder('inbox');
              setSelectedMsg(null);
            }}
          >
            <Mail className="h-4 w-4 mr-1" />
            Eingang
          </Button>
          <Button
            variant={folder === 'sent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setFolder('sent');
              setSelectedMsg(null);
            }}
          >
            <Send className="h-4 w-4 mr-1" />
            Gesendet
          </Button>
          <Button size="sm" onClick={() => setShowCompose(true)}>
            <MessageSquare className="h-4 w-4 mr-1" />
            Neu
          </Button>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          <h3 className="font-medium mb-3 text-gray-900 dark:text-gray-100">Neue Nachricht</h3>
          <input
            type="text"
            placeholder="Empfänger-ID"
            value={composeData.receiverId}
            onChange={(e) => setComposeData({ ...composeData, receiverId: e.target.value })}
            className="w-full mb-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          />
          <input
            type="text"
            placeholder="Betreff"
            value={composeData.subject}
            onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
            className="w-full mb-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          />
          <textarea
            placeholder="Nachricht..."
            value={composeData.content}
            onChange={(e) => setComposeData({ ...composeData, content: e.target.value })}
            rows={3}
            className="w-full mb-3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCompose(false)}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={handleSend} disabled={sending}>
              {sending ? 'Sendet...' : 'Senden'}
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Message List */}
        {!selectedMsg && (
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                <Mail className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                <p className="text-sm">Keine Nachrichten</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => handleSelect(msg)}
                    className={cn(
                      'flex items-start gap-3 p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800',
                      !msg.is_read && folder === 'inbox' && 'bg-blue-50 dark:bg-blue-900/10'
                    )}
                  >
                    <div
                      className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
                        !msg.is_read && folder === 'inbox'
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      )}
                    >
                      {msg.is_read || folder === 'sent' ? (
                        <MailOpen className="h-5 w-5" />
                      ) : (
                        <Mail className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            !msg.is_read && folder === 'inbox'
                              ? 'text-gray-900 dark:text-gray-100'
                              : 'text-gray-600 dark:text-gray-400'
                          )}
                        >
                          {folder === 'inbox'
                            ? msg.sender?.full_name || msg.sender?.email || msg.sender_id
                            : msg.receiver?.full_name || msg.receiver?.email || msg.receiver_id}
                        </p>
                        <span className="text-xs text-gray-400 flex-shrink-0 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          'text-sm truncate mt-0.5',
                          !msg.is_read && folder === 'inbox'
                            ? 'font-medium text-gray-800 dark:text-gray-200'
                            : 'text-gray-500 dark:text-gray-400'
                        )}
                      >
                        {msg.subject}
                      </p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {msg.content.substring(0, 80)}
                        {msg.content.length > 80 ? '...' : ''}
                      </p>
                    </div>
                    {!msg.is_read && folder === 'inbox' && (
                      <Badge
                        variant="default"
                        className="flex-shrink-0 h-2 w-2 rounded-full p-0 bg-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}

        {/* Message Detail */}
        {selectedMsg && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {folder === 'inbox'
                      ? selectedMsg.sender?.full_name || selectedMsg.sender_id
                      : selectedMsg.receiver?.full_name || selectedMsg.receiver_id}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(selectedMsg.created_at)}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {selectedMsg.subject}
            </h3>
            <ScrollArea className="flex-1">
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {selectedMsg.content}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
