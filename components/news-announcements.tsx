'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Calendar, Clock, Tag, TrendingUp, Info, AlertTriangle, CheckCircle } from 'lucide-react';

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  type: 'announcement' | 'update' | 'maintenance' | 'event';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  publishedAt: string;
  author: string;
  tags?: string[];
  expiresAt?: string;
  isPinned?: boolean;
}

const MOCK_NEWS: NewsItem[] = [
  {
    id: '1',
    title: 'Neue Trainingsgruppen ab nächster Woche',
    content: 'Ab kommender Woche starten wir neue Trainingsgruppen für Anfänger und Fortgeschrittene. Die Anmeldung ist jetzt möglich. Plätze sind begrenzt, also sichere dir deinen Platz frühzeitig!',
    type: 'announcement',
    priority: 'high',
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    author: 'SwingZ Team',
    tags: ['Training', 'Neuigkeiten'],
    isPinned: true,
  },
  {
    id: '2',
    title: 'Wartungsarbeiten am Platz 3',
    content: 'Am kommenden Wochenende führen wir Wartungsarbeiten an Platz 3 durch. Der Platz wird von Samstag bis Montag nicht verfügbar sein. Bitte buche deine Sessions entsprechend um.',
    type: 'maintenance',
    priority: 'urgent',
    publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    author: 'Facility Management',
    tags: ['Wartung', 'Platz 3'],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    title: 'Sommerturnier Anmeldung',
    content: 'Die Anmeldung für unser jährliches Sommerturnier ist jetzt offen! Melde dich und dein Team an bis zum 15. Juni. Preise und Turnierdetails findest du auf unserer Webseite.',
    type: 'event',
    priority: 'medium',
    publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    author: 'Event Team',
    tags: ['Turnier', 'Sommer'],
  },
  {
    id: '4',
    title: 'Neue Trainer im Team',
    content: 'Wir freuen uns, zwei neue Trainer in unserem Team begrüßen zu dürfen! Anna Schmidt und Thomas Müller bringen jahrelange Erfahrung mit und werden unsere Trainingsangebote erweitern.',
    type: 'update',
    priority: 'low',
    publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    author: 'SwingZ Team',
    tags: ['Personal', 'Neuigkeiten'],
  },
];

export default function NewsAnnouncements() {
  const [news, setNews] = useState<NewsItem[]>(MOCK_NEWS);
  const [filter, setFilter] = useState<'all' | 'pinned' | 'recent'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const getNewsIcon = (type: NewsItem['type']) => {
    switch (type) {
      case 'announcement':
        return <Bell className="h-5 w-5 text-blue-600" />;
      case 'update':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'maintenance':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'event':
        return <Calendar className="h-5 w-5 text-purple-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: NewsItem['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityLabel = (priority: NewsItem['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'Dringend';
      case 'high':
        return 'Hoch';
      case 'medium':
        return 'Mittel';
      case 'low':
        return 'Niedrig';
    }
  };

  const getTypeLabel = (type: NewsItem['type']) => {
    switch (type) {
      case 'announcement':
        return 'Ankündigung';
      case 'update':
        return 'Update';
      case 'maintenance':
        return 'Wartung';
      case 'event':
        return 'Veranstaltung';
      default:
        return type;
    }
  };

  const filteredNews = news.filter((item) => {
    if (filter === 'pinned' && !item.isPinned) return false;
    if (filter === 'recent') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return new Date(item.publishedAt) >= weekAgo;
    }
    if (selectedType !== 'all' && item.type !== selectedType) return false;
    return true;
  });

  const sortedNews = [...filteredNews].sort((a, b) => {
    // Pinned items first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    // Then by priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Finally by date (newest first)
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  const isExpired = (item: NewsItem) => {
    if (!item.expiresAt) return false;
    return new Date(item.expiresAt) < new Date();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">News & Ankündigungen</h1>
        <p className="text-gray-500">Bleib auf dem Laufenden über Neuigkeiten und Updates</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          Alle
        </Button>
        <Button
          variant={filter === 'pinned' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('pinned')}
        >
          Angepinnt
        </Button>
        <Button
          variant={filter === 'recent' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('recent')}
        >
          Letzte 7 Tage
        </Button>

        <div className="w-px h-8 bg-gray-300 mx-2" />

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <option value="all">Alle Typen</option>
          <option value="announcement">Ankündigungen</option>
          <option value="update">Updates</option>
          <option value="maintenance">Wartungen</option>
          <option value="event">Veranstaltungen</option>
        </select>
      </div>

      {/* News List */}
      <div className="space-y-4">
        {sortedNews.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">Keine Nachrichten gefunden</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          sortedNews.map((item) => {
            const NewsIcon = getNewsIcon(item.type);
            const expired = isExpired(item);

            return (
              <Card
                key={item.id}
                className={`transition-all hover:shadow-md ${
                  item.isPinned ? 'border-brand-primary/30 bg-brand-primary/5' : ''
                } ${expired ? 'opacity-60' : ''}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${
                        item.isPinned
                          ? 'bg-brand-primary/20'
                          : 'bg-gray-100'
                      }`}>
                        <Bell className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {item.isPinned && (
                            <Badge variant="default" className="text-xs">
                              Angepinnt
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-xs ${getPriorityColor(item.priority)}`}
                          >
                            {getPriorityLabel(item.priority)}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {getTypeLabel(item.type)}
                          </Badge>
                          {expired && (
                            <Badge variant="outline" className="text-xs bg-gray-100">
                              Abgelaufen
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-xl">{item.title}</CardTitle>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">{item.content}</p>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(parseISO(item.publishedAt), 'dd. MMMM yyyy', { locale: de })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>
                        {format(parseISO(item.publishedAt), 'HH:mm', { locale: de })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{item.author}</span>
                    </div>
                    {item.expiresAt && (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Gültig bis:</span>
                        <span>
                          {format(parseISO(item.expiresAt), 'dd. MMMM yyyy', { locale: de })}
                        </span>
                      </div>
                    )}
                  </div>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {item.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs"
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Gesamt</div>
                <div className="text-2xl font-bold">{news.length}</div>
              </div>
              <Bell className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Angepinnt</div>
                <div className="text-2xl font-bold">
                  {news.filter((n) => n.isPinned).length}
                </div>
              </div>
              <CheckCircle className="h-8 w-8 text-brand-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Dringend</div>
                <div className="text-2xl font-bold">
                  {news.filter((n) => n.priority === 'urgent' || n.priority === 'high').length}
                </div>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Diese Woche</div>
                <div className="text-2xl font-bold">
                  {news.filter((n) => {
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    return new Date(n.publishedAt) >= weekAgo;
                  }).length}
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}