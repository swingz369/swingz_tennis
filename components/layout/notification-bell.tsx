'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Clock, Loader2, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-fetch';
import { useNotificationsRealtime } from '@/hooks/use-notifications-realtime';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Enhanced NotificationBell with dropdown panel.
 *
 * Shows a bell icon with unread count badge.
 * Clicking opens a dropdown with the last 5 notifications.
 * Uses Supabase Realtime for instant updates, falls back to 30s polling.
 *
 * @example
 * <NotificationBell userId={user.id} />
 */

interface Notification {
  id: string;
  title: string;
  message?: string;
  type: string;
  is_read: boolean;
  created_at: string;
  link?: string;
}

interface NotificationBellProps {
  userId?: string;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  booking: Clock,
  invoice: Check,
  system: Bell,
  message_received: MessageSquare,
  message: MessageSquare,
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Gerade eben';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Vor ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Vor ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Vor ${days}d`;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Fetch unread count (notifications + messages combined)
  const fetchCount = useCallback(async () => {
    if (!userId) return;
    try {
      const [notifRes, msgRes] = await Promise.all([
        apiFetch('/api/user/notifications/count'),
        apiFetch('/api/messages?folder=inbox&countOnly=true'),
      ]);
      let total = 0;
      if (notifRes.ok) {
        const data = await notifRes.json();
        total += data?.count ?? 0;
      }
      if (msgRes.ok) {
        const data = await msgRes.json();
        total += data?.unreadCount ?? 0;
      }
      setUnreadCount(total);
    } catch {
      // Silent fail
    }
  }, [userId]);

  // Initial fetch + Supabase Realtime for instant updates (fallback: 30s polling)
  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useNotificationsRealtime(userId, fetchCount);

  // Fetch notifications + messages when dropdown opens
  const fetchAlerts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [notifRes, msgRes] = await Promise.all([
        apiFetch('/api/user/notifications?limit=5'),
        apiFetch('/api/messages?folder=inbox'),
      ]);

      const items: Notification[] = [];

      if (notifRes.ok) {
        const data = await notifRes.json();
        const raw: unknown[] = data.notifications ?? [];
        for (const n of raw) {
          const entry = n as Record<string, unknown>;
          const type = String(entry.type ?? 'system');
          // Skip message_received notifications — messages are shown directly below
          if (type === 'message_received') continue;
          items.push({
            id: String(entry.id),
            title: String(entry.title ?? ''),
            message: entry.message ? String(entry.message) : undefined,
            type,
            is_read: Boolean(entry.read),
            created_at: String(entry.created_at ?? ''),
            link: entry.action_url ? String(entry.action_url) : undefined,
          });
        }
      }

      // Also fetch inbox messages and merge them in
      if (msgRes.ok) {
        const data = await msgRes.json();
        const messages: unknown[] = data.messages ?? [];
        for (const m of messages) {
          const msg = m as Record<string, unknown>;
          const sender = msg.sender as Record<string, unknown> | undefined;
          const senderName = (sender?.full_name as string) || 'Unbekannt';
          items.push({
            id: `msg-${String(msg.id)}`,
            title: `Nachricht von ${senderName}`,
            message: String(msg.subject ?? msg.content ?? ''),
            type: 'message',
            is_read: Boolean(msg.is_read),
            created_at: String(msg.created_at ?? ''),
            link: '/messages',
          });
        }
      }

      // Sort by date descending and take top 8
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(items.slice(0, 8));
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) fetchAlerts();
  }, [open, fetchAlerts]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-xl"
              aria-label={
                unreadCount > 0
                  ? `${unreadCount} ungelesene Benachrichtigungen`
                  : 'Benachrichtigungen'
              }
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-error-500 text-2xs font-bold text-white animate-in fade-in-0 zoom-in-95">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {unreadCount > 0 ? `${unreadCount} ungelesene Benachrichtigungen` : 'Benachrichtigungen'}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-80">
        <div className="px-3 py-2">
          <p className="text-sm font-semibold text-foreground">Benachrichtigungen</p>
          {unreadCount > 0 && (
            <p className="text-xs text-muted-foreground">{unreadCount} ungelesen</p>
          )}
        </div>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-6 text-center">
            <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Keine Benachrichtigungen</p>
          </div>
        ) : (
          <>
            {notifications.map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? Bell;
              return (
                <DropdownMenuItem
                  key={n.id}
                  className={cn(
                    'flex items-start gap-3 px-3 py-2.5 cursor-pointer',
                    !n.is_read && 'bg-brand-light/5'
                  )}
                  asChild
                >
                  <Link href={n.link || '/notifications'}>
                    <div
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-xl shrink-0 mt-0.5',
                        !n.is_read
                          ? 'bg-brand-light/10 text-brand-light'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm truncate',
                          !n.is_read ? 'font-medium text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{n.message}</p>
                      )}
                      <p className="text-2xs text-muted-foreground/60 mt-0.5">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div className="h-2 w-2 rounded-full bg-brand-light shrink-0 mt-1.5" />
                    )}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </>
        )}

        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-3 py-1.5">
          {unreadCount > 0 && (
            <button
              onClick={async () => {
                try {
                  // Mark both notifications AND messages as read (independently)
                  const [notifRes, msgRes] = await Promise.all([
                    apiFetch('/api/user/notifications/mark-all-read', { method: 'POST' }),
                    apiFetch('/api/messages/mark-all-read', { method: 'POST' }),
                  ]);
                  const notifOk = notifRes.ok;
                  const msgOk = msgRes.ok;
                  if (notifOk || msgOk) {
                    setUnreadCount(0);
                    setNotifications((prev) =>
                      prev.map((n) => {
                        if (n.type === 'message') return msgOk ? { ...n, is_read: true } : n;
                        return notifOk ? { ...n, is_read: true } : n;
                      })
                    );
                    toast.success('Alle Benachrichtigungen und Nachrichten als gelesen markiert');
                  }
                } catch {
                  /* non-critical */
                }
              }}
              className="text-xs font-medium text-brand-light hover:text-primary transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5 inline mr-1" />
              Alle lesen
            </button>
          )}
          <Link
            href="/messages"
            className="text-xs font-medium text-brand-light hover:text-primary ml-auto"
          >
            Alle anzeigen
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
