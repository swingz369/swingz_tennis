'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
} from 'lucide-react';
import { toast } from 'sonner';

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

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'booking',
    title: 'Buchung bestätigt',
    message: 'Deine Buchung für Training am 15. Mai wurde bestätigt.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    read: false,
    actionUrl: '/bookings',
  },
  {
    id: '2',
    type: 'reminder',
    title: 'Erinnerung: Training morgen',
    message: 'Vergiss nicht dein Training morgen um 10:00 Uhr mit Trainer Max.',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    read: false,
    actionUrl: '/training-schedule',
  },
  {
    id: '3',
    type: 'announcement',
    title: 'Neue Trainingsgruppe verfügbar',
    message: 'Es gibt jetzt Plätze in der Anfänger-Gruppe am Dienstagabend.',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    read: true,
    actionUrl: '/news',
  },
  {
    id: '4',
    type: 'system',
    title: 'Willkommen bei SwingZ',
    message: 'Vielen Dank für deine Anmeldung! Hier sind einige Tipps für den Start.',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    read: true,
  },
];

export default function NotificationSettings() {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [settings, setSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    pushNotifications: true,
    bookingReminders: true,
    sessionReminders: true,
    newsUpdates: true,
    promotionalEmails: false,
    reminderTime: 24,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'booking':
        return <Calendar className="h-5 w-5 text-blue-600" />;
      case 'reminder':
        return <Clock className="h-5 w-5 text-orange-600" />;
      case 'announcement':
        return <Bell className="h-5 w-5 text-purple-600" />;
      case 'system':
        return <User className="h-5 w-5 text-green-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    toast.success('Benachrichtigung als gelesen markiert');
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success('Alle Benachrichtigungen als gelesen markiert');
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success('Benachrichtigung gelöscht');
  };

  const handleClearAll = () => {
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
          <h1 className="text-2xl font-bold text-brand-primary">Benachrichtigungen</h1>
          <p className="text-gray-500">Verwalte deine Benachrichtigungseinstellungen</p>
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
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-primary/10 rounded-lg">
                {settings.pushNotifications ? (
                  <Bell className="h-5 w-5 text-brand-primary" />
                ) : (
                  <BellOff className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <div>
                <div className="font-medium">Push-Benachrichtigungen</div>
                <div className="text-sm text-gray-600">
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
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium">E-Mail-Benachrichtigungen</div>
                <div className="text-sm text-gray-600">Erhalte wichtige Updates per E-Mail</div>
              </div>
            </div>
            <Switch
              checked={settings.emailNotifications}
              onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
            />
          </div>

          {/* Specific Notification Types */}
          <div className="space-y-3">
            <div className="font-medium text-sm text-gray-700">Benachrichtigungstypen</div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                <span className="text-sm">Buchungsbestätigungen</span>
              </div>
              <Switch
                checked={settings.bookingReminders}
                onCheckedChange={(checked) => handleSettingChange('bookingReminders', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="text-sm">Trainingserinnerungen</span>
              </div>
              <Switch
                checked={settings.sessionReminders}
                onCheckedChange={(checked) => handleSettingChange('sessionReminders', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-gray-600" />
                <span className="text-sm">News & Updates</span>
              </div>
              <Switch
                checked={settings.newsUpdates}
                onCheckedChange={(checked) => handleSettingChange('newsUpdates', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-600" />
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
            <div className="font-medium text-sm text-gray-700">Erinnerungszeit</div>
            <div className="flex items-center gap-4">
              <select
                value={settings.reminderTime.toString()}
                onChange={(e) => handleSettingChange('reminderTime', parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="1">1 Stunde vorher</option>
                <option value="2">2 Stunden vorher</option>
                <option value="6">6 Stunden vorher</option>
                <option value="12">12 Stunden vorher</option>
                <option value="24">24 Stunden vorher</option>
                <option value="48">48 Stunden vorher</option>
              </select>
              <span className="text-sm text-gray-600">vor Trainingssessions</span>
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
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BellOff className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Keine Benachrichtigungen</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const NotificationIcon = getNotificationIcon(notification.type);

                return (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                      notification.read
                        ? 'bg-white border-gray-200'
                        : 'bg-brand-primary/5 border-brand-primary/30'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        notification.read ? 'bg-gray-100' : 'bg-brand-primary/20'
                      }`}
                    >
                      <Bell className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium">{notification.title}</div>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-brand-primary flex-shrink-0 mt-2" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">
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
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-1 text-sm text-blue-900">
              <p className="font-medium">Wichtige Informationen</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
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
