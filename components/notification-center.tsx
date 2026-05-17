'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  BellOff,
  CheckCheck,
  Calendar,
  CreditCard,
  MessageSquare,
  Users,
  Clock,
  AlertCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  booking_confirmed: Calendar,
  booking_cancelled: Calendar,
  message_received: MessageSquare,
  payment_received: CreditCard,
  payment_overdue: AlertCircle,
  member_joined: Users,
  member_left: Users,
  trial_scheduled: Calendar,
  trainer_assigned: Users,
  system: Info,
};

const typeColors: Record<string, string> = {
  booking_confirmed: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  booking_cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  message_received: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  payment_received: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  payment_overdue: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  member_joined: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/mark-read', { method: 'PATCH', body: '{}' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('Alle als gelesen markiert');
    } catch {
      toast.error('Fehler beim Markieren');
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const handleClick = (notification: Notification) => {
    if (!notification.is_read) handleMarkRead(notification.id);
    if (notification.link) {
      window.location.href = notification.link;
    }
    setOpen(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `Vor ${diffMins} Min.`;
    if (diffHours < 24) return `Vor ${diffHours} Std.`;
    if (diffDays < 7) return `Vor ${diffDays} T.`;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  };

  const getIcon = (type: string) => {
    const Icon = typeIcons[type] || Info;
    const color =
      typeColors[type] || 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
    return { Icon, color };
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-12 z-50 w-96 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Benachrichtigungen
                {unreadCount > 0 && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full">
                    {unreadCount} neu
                  </span>
                )}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className="text-xs"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Alle gelesen
              </Button>
            </div>

            {/* Notifications List */}
            <ScrollArea className="max-h-[28rem]">
              {loading ? (
                <div className="p-8 text-center text-gray-400">
                  <Bell className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm">Wird geladen...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <BellOff className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Keine Benachrichtigungen</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {notifications.map((notification) => {
                    const { Icon, color } = getIcon(notification.type);
                    return (
                      <div
                        key={notification.id}
                        onClick={() => handleClick(notification)}
                        className={cn(
                          'flex items-start gap-3 p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800',
                          !notification.is_read && 'bg-blue-50/50 dark:bg-blue-900/10'
                        )}
                      >
                        <div
                          className={cn(
                            'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0',
                            color
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={cn(
                                'text-sm font-medium truncate',
                                !notification.is_read
                                  ? 'text-gray-900 dark:text-gray-100'
                                  : 'text-gray-600 dark:text-gray-400'
                              )}
                            >
                              {notification.title}
                            </p>
                            <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                              <Clock className="h-3 w-3" />
                              {formatDate(notification.created_at)}
                            </span>
                          </div>
                          <p
                            className={cn(
                              'text-xs mt-0.5',
                              !notification.is_read
                                ? 'text-gray-700 dark:text-gray-300'
                                : 'text-gray-500 dark:text-gray-400'
                            )}
                          >
                            {notification.message}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}
