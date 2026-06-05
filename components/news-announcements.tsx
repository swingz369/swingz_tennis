'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from '@/lib/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Calendar,
  Clock,
  Tag,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

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

export default function NewsAnnouncements() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pinned' | 'recent'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Fetch news from API
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchNews() {
      try {
        const res = await apiFetch('/api/news', {
          signal: abortController.signal,
        });
        if (res.ok) {
          const data = await res.json();
          const mapped: NewsItem[] = (data.news || []).map((n: any) => ({
            id: n.id,
            title: n.title || '',
            content: n.content || '',
            type: n.type || 'announcement',
            priority: n.priority || 'medium',
            publishedAt: n.published_at || n.created_at || new Date().toISOString(),
            author: n.author || 'SwingZ Team',
            tags: n.tags || [],
            expiresAt: n.expires_at || undefined,
            isPinned: n.is_pinned || false,
          }));
          setNews(mapped);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch news:', err);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchNews();
    return () => abortController.abort();
  }, []);

  const getPriorityColor = (priority: NewsItem['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-muted text-foreground border-border';
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
        <p className="text-muted-foreground">
          Bleib auf dem Laufenden über Neuigkeiten und Updates
        </p>
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

        <div className="w-px h-8 bg-muted mx-2" />

        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="announcement">Ankündigungen</SelectItem>
            <SelectItem value="update">Updates</SelectItem>
            <SelectItem value="maintenance">Wartungen</SelectItem>
            <SelectItem value="event">Veranstaltungen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* News List */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ) : sortedNews.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">Keine Nachrichten gefunden</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          sortedNews.map((item) => {
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
                      <div
                        className={`p-2 rounded-lg ${
                          item.isPinned ? 'bg-brand-primary/20' : 'bg-muted'
                        }`}
                      >
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
                            <Badge variant="outline" className="text-xs bg-muted">
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
                  <p className="text-foreground mb-4">{item.content}</p>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(parseISO(item.publishedAt), 'dd. MMMM yyyy', { locale: de })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{format(parseISO(item.publishedAt), 'HH:mm', { locale: de })}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{item.author}</span>
                    </div>
                    {item.expiresAt && (
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Gültig bis:</span>
                        <span>
                          {format(parseISO(item.expiresAt), 'dd. MMMM yyyy', { locale: de })}
                        </span>
                      </div>
                    )}
                  </div>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
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
                <div className="text-sm text-muted-foreground">Gesamt</div>
                <div className="text-2xl font-bold">{news.length}</div>
              </div>
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Angepinnt</div>
                <div className="text-2xl font-bold">{news.filter((n) => n.isPinned).length}</div>
              </div>
              <CheckCircle className="h-8 w-8 text-brand-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Dringend</div>
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
                <div className="text-sm text-muted-foreground">Diese Woche</div>
                <div className="text-2xl font-bold">
                  {
                    news.filter((n) => {
                      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                      return new Date(n.publishedAt) >= weekAgo;
                    }).length
                  }
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
