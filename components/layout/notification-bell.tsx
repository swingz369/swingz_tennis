'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';
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

/**
 * Enhanced NotificationBell with dropdown panel.
 *
 * Shows a bell icon with unread count badge.
 * Clicking opens a dropdown with the last 5 notifications.
 * Polls every 30s for new notifications.
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
}

interface NotificationBellProps {
  userId?: string;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  booking: Clock,
  invoice: Check,
  system: Bell,
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

  // Poll unread count
  useEffect(() => {
    if (!userId) return;

    const fetchCount = async () => {
      try {
        const res = await apiFetch('/api/user/notifications/count');
        if (res.ok) {
          const { count } = await res.json();
          setUnreadCount(count ?? 0);
        }
      } catch {
        // Silent fail
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [userId]);

  // Fetch notifications when dropdown opens
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/user/notifications?limit=5');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-xl"
          aria-label={
            unreadCount > 0 ? `${unreadCount} ungelesene Benachrichtigungen` : 'Benachrichtigungen'
          }
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-in fade-in-0 zoom-in-95">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

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
                  <Link href="/notifications">
                    <div
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-lg shrink-0 mt-0.5',
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
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{n.message}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">
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
        <DropdownMenuItem asChild className="justify-center">
          <Link
            href="/notifications"
            className="text-xs font-medium text-brand-light hover:text-brand-primary"
          >
            Alle anzeigen
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
