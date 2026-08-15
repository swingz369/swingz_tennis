'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  BellOff,
  Clock,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  Settings,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

import { createLogger } from '@/lib/logger';

const log = createLogger('notification-settings');

export interface Notification {
  id: string;
  type: 'booking' | 'reminder' | 'announcement' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  bookingReminders: boolean;
  sessionReminders: boolean;
  newsUpdates: boolean;
  promotionalEmails: boolean;
  reminderTime: number; // hours before session
}

export default function NotificationSettings() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    pushNotifications: true,
    bookingReminders: true,
    sessionReminders: true,
    newsUpdates: true,
    promotionalEmails: false,
    reminderTime: 24,
  });

  // Fetch notifications from API
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchNotifications() {
      try {
        const res = await apiFetch('/api/user/notifications', {
          signal: abortController.signal,
        });
        if (res.ok) {
          const data = await res.json();
          const mapped: Notification[] = (data.notifications || []).map(
            (n: Record<string, unknown>) => ({
              id: n.id,
              type: n.type || 'system',
              title: n.title || '',
              message: n.message || '',
              timestamp: n.created_at || n.timestamp || new Date().toISOString(),
              read: n.read || false,
              actionUrl: n.action_url || undefined,
            })
          );
          setNotifications(mapped);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          log.error('Failed to fetch notifications:', err);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchNotifications();
    return () => abortController.abort();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiFetch(`/api/user/notifications/${id}`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      toast.success('Benachrichtigung als gelesen markiert');
    } catch (err) {
      log.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiFetch('/api/user/notifications/mark-all-read', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('Alle Benachrichtigungen als gelesen markiert');
    } catch (err) {
      log.error('Failed to mark all as read:', err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await apiFetch(`/api/user/notifications/${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Benachrichtigung gelöscht');
    } catch (err) {
      log.error('Failed to delete notification:', err);
    }
  };

  const handleClearAll = async () => {
    await Promise.all(
      notifications.map((n) =>
        apiFetch(`/api/user/notifications/${n.id}`, { method: 'DELETE' }).catch(() => {})
      )
    );
    setNotifications([]);
    toast.success('Alle Benachrichtigungen gelöscht');
  };

  const handleSettingChange = (key: keyof NotificationSettings, value: boolean | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    toast.success('Einstellung aktualisiert');
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success('Push-Benachrichtigungen aktiviert');
        setSettings((prev) => ({ ...prev, pushNotifications: true }));
      } else {
        toast.error('Push-Benachrichtigungen abgelehnt');
      }
    } else {
      toast.error('Push-Benachrichtigungen werden von diesem Browser nicht unterstützt');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Benachrichtigungen</h1>
          <p className="text-muted-foreground">Verwalte deine Benachrichtigungseinstellungen</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge variant="default" className="gap-1">
              <Bell className="h-3 w-3" />
              {unreadCount} ungelesen
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
          >
            Alle als gelesen
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={notifications.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Alle löschen
          </Button>
        </div>
      </div>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Benachrichtigungseinstellungen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Push Notifications */}
          <div className="flex items-center justify-between p-4 bg-muted dark:bg-muted rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                {settings.pushNotifications ? (
                  <Bell className="h-5 w-5 text-primary" />
                ) : (
                  <BellOff className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="font-medium">Push-Benachrichtigungen</div>
                <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                  Erhalte Benachrichtigungen direkt in deinem Browser
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!settings.pushNotifications && (
                <Button variant="outline" size="sm" onClick={requestNotificationPermission}>
                  Aktivieren
                </Button>
              )}
              <Switch
                checked={settings.pushNotifications}
                onCheckedChange={(checked) => handleSettingChange('pushNotifications', checked)}
              />
            </div>
          </div>

          {/* Email Notifications */}
          <div className="flex items-center justify-between p-4 bg-muted dark:bg-muted rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-100 rounded-xl">
                <User className="h-5 w-5 text-info-600" />
              </div>
              <div>
                <div className="font-medium">E-Mail-Benachrichtigungen</div>
                <div className="text-sm text-muted-foreground dark:text-muted-foreground">
                  Erhalte wichtige Updates per E-Mail
                </div>
              </div>
            </div>
            <Switch
              checked={settings.emailNotifications}
              onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
            />
          </div>

          {/* Specific Notification Types */}
          <div className="space-y-3">
            <div className="font-medium text-sm text-foreground dark:text-foreground">
              Benachrichtigungstypen
            </div>

            <div className="flex items-center justify-between p-3 border dark:border-white/10 rounded-xl">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground dark:text-muted-foreground" />
                <span className="text-sm">Buchungsbestätigungen</span>
              </div>
              <Switch
                checked={settings.bookingReminders}
                onCheckedChange={(checked) => handleSettingChange('bookingReminders', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 border dark:border-white/10 rounded-xl">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground dark:text-muted-foreground" />
                <span className="text-sm">Trainingserinnerungen</span>
              </div>
              <Switch
                checked={settings.sessionReminders}
                onCheckedChange={(checked) => handleSettingChange('sessionReminders', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 border dark:border-white/10 rounded-xl">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground dark:text-muted-foreground" />
                <span className="text-sm">News & Updates</span>
              </div>
              <Switch
                checked={settings.newsUpdates}
                onCheckedChange={(checked) => handleSettingChange('newsUpdates', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 border dark:border-white/10 rounded-xl">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground dark:text-muted-foreground" />
                <span className="text-sm">Werbung & Angebote</span>
              </div>
              <Switch
                checked={settings.promotionalEmails}
                onCheckedChange={(checked) => handleSettingChange('promotionalEmails', checked)}
              />
            </div>
          </div>

          {/* Reminder Time */}
          <div className="space-y-2">
            <div className="font-medium text-sm text-foreground dark:text-foreground">
              Erinnerungszeit
            </div>
            <div className="flex items-center gap-4">
              <Select
                value={settings.reminderTime.toString()}
                onValueChange={(v) => handleSettingChange('reminderTime', parseInt(v))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Stunde vorher</SelectItem>
                  <SelectItem value="2">2 Stunden vorher</SelectItem>
                  <SelectItem value="6">6 Stunden vorher</SelectItem>
                  <SelectItem value="12">12 Stunden vorher</SelectItem>
                  <SelectItem value="24">24 Stunden vorher</SelectItem>
                  <SelectItem value="48">48 Stunden vorher</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground dark:text-muted-foreground">
                vor Trainingssessions
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Letzte Benachrichtigungen</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BellOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>Keine Benachrichtigungen</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => {
                return (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                      notification.read
                        ? 'bg-background dark:bg-card border-border dark:border-white/10'
                        : 'bg-primary/5 border-primary/30'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl ${
                        notification.read ? 'bg-muted dark:bg-muted' : 'bg-primary/20'
                      }`}
                    >
                      <Bell className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium">{notification.title}</div>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground dark:text-muted-foreground">
                          {new Date(notification.timestamp).toLocaleString('de-DE')}
                        </span>
                        {notification.actionUrl && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => {
                              // Navigate to action URL
                              if (notification.actionUrl) {
                                window.location.href = notification.actionUrl;
                              }
                            }}
                          >
                            Anzeigen
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleMarkAsRead(notification.id)}
                          title="Als gelesen markieren"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDeleteNotification(notification.id)}
                        title="Löschen"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-info-50 border-info-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-info-600 mt-0.5" />
            <div className="space-y-1 text-sm text-info-900">
              <p className="font-medium">Wichtige Informationen</p>
              <ul className="list-disc list-inside space-y-1 text-info-800">
                <li>
                  Push-Benachrichtigungen funktionieren nur, wenn du diese im Browser erlaubst
                </li>
                <li>Einige Benachrichtigungen sind wichtig für deine Buchungen und Trainings</li>
                <li>Du kannst jederzeit deine Einstellungen anpassen</li>
                <li>Alte Benachrichtigungen werden automatisch nach 30 Tagen gelöscht</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
