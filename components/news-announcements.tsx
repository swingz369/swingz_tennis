'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CenteredModal } from '@/components/ui/centered-modal';
import { toast } from 'sonner';
import {
  Bell,
  Calendar,
  Clock,
  Tag,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Plus,
  Trash2,
  Pin,
  Send,
  Newspaper,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { AnimatedCounter, ScrollReveal } from '@/components/animations';

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

interface NewsAnnouncementsProps {
  /** Whether the current user may create/delete news (admin/superadmin) */
  canManage?: boolean;
  /** Server-rendered initial list (so first paint is fast) */
  initialNews?: NewsItem[];
}

const TYPE_OPTIONS: NewsItem['type'][] = ['announcement', 'update', 'maintenance', 'event'];
const PRIORITY_OPTIONS: NewsItem['priority'][] = ['low', 'medium', 'high', 'urgent'];

export default function NewsAnnouncements({
  canManage = false,
  initialNews = [],
}: NewsAnnouncementsProps) {
  const [news, setNews] = useState<NewsItem[]>(initialNews);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pinned' | 'recent'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Compose-dialog state
  const [composeOpen, setComposeOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    type: 'announcement' as NewsItem['type'],
    priority: 'medium' as NewsItem['priority'],
    isPinned: false,
    expiresAt: '',
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNews = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await apiFetch('/api/news', signal ? { signal } : {});
      if (res.ok) {
        const data = await res.json();
        const mapped: NewsItem[] = (data.news || []).map((n: Record<string, unknown>) => ({
          id: n.id,
          title: n.title || '',
          content: n.content || '',
          type: n.type || 'announcement',
          priority: n.priority || 'medium',
          publishedAt: n.published_at || n.created_at || new Date().toISOString(),
          author: n.author_name || n.author || 'SwingZ Team',
          tags: n.tags || [],
          expiresAt: n.expires_at || undefined,
          isPinned: n.is_pinned || false,
        }));
        setNews(mapped);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Failed to fetch news:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Only refetch if we don't have initial data (defensive — server prefills today)
  useEffect(() => {
    if (initialNews.length > 0) {
      setIsLoading(false);
      return;
    }
    const abortController = new AbortController();
    setIsLoading(true);
    fetchNews(abortController.signal);
    return () => abortController.abort();
  }, [fetchNews, initialNews.length]);

  const resetForm = () =>
    setForm({
      title: '',
      content: '',
      type: 'announcement',
      priority: 'medium',
      isPinned: false,
      expiresAt: '',
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Titel und Inhalt sind erforderlich');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        priority: form.priority,
        is_pinned: form.isPinned,
      };
      if (form.expiresAt) {
        payload.expires_at = new Date(form.expiresAt).toISOString();
      }

      const res = await apiFetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Fehler ${res.status}`);
      }

      toast.success('Nachricht veröffentlicht');
      setComposeOpen(false);
      resetForm();
      await fetchNews();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Veröffentlichen fehlgeschlagen');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Diese Nachricht wirklich löschen?')) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/news/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Fehler ${res.status}`);
      }
      toast.success('Nachricht gelöscht');
      setNews((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    } finally {
      setDeletingId(null);
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

  // Compute cutoff once using useState lazy initializer (avoids Date.now() during render for purity rule)
  const [weekAgoTimestamp] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);

  const filteredNews = news.filter((item) => {
    if (filter === 'pinned' && !item.isPinned) return false;
    if (filter === 'recent') {
      return new Date(item.publishedAt).getTime() >= weekAgoTimestamp;
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
      {/* ── Hero Header ── */}
      <ScrollReveal>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary via-brand-primary/95 to-brand-dark p-6 md:p-8 text-white">
          <div className="absolute inset-0 bg-noise opacity-5" />
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-background/5 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-brand-accent/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white/70 mb-1">Informationen</p>
                <h1 className="text-2xl md:text-3xl font-bold">News & Ankündigungen</h1>
                <p className="text-white/70 mt-2">
                  Bleib auf dem Laufenden über Neuigkeiten und Updates
                </p>
              </div>
              <div className="flex items-center gap-3">
                {canManage && (
                  <Button
                    onClick={() => setComposeOpen(true)}
                    className="bg-background/15 backdrop-blur-sm border-white/20 text-white hover:bg-background/25 gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Neue Nachricht
                  </Button>
                )}
                <div className="hidden sm:flex items-center gap-2 rounded-xl bg-background/10 backdrop-blur-sm px-4 py-2.5">
                  <Newspaper className="h-5 w-5 text-brand-accent" />
                  <span className="text-sm font-medium">
                    <AnimatedCounter value={news.length} /> Nachrichten
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ScrollReveal delay={0}>
          <Card className="group hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Gesamt</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter value={news.length} />
                  </p>
                  <p className="text-xs text-muted-foreground">Nachrichten</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <Bell className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <Card className="group hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Angepinnt</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter value={news.filter((n) => n.isPinned).length} />
                  </p>
                  <p className="text-xs text-muted-foreground">wichtige Nachrichten</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-light text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={160}>
          <Card className="group hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Dringend</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter
                      value={
                        news.filter((n) => n.priority === 'urgent' || n.priority === 'high').length
                      }
                    />
                  </p>
                  <p className="text-xs text-muted-foreground">Priorität hoch+</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={240}>
          <Card className="group hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Diese Woche</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter
                      value={
                        news.filter((n) => new Date(n.publishedAt).getTime() >= weekAgoTimestamp)
                          .length
                      }
                    />
                  </p>
                  <p className="text-xs text-muted-foreground">neue Beiträge</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
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
                <p className="text-muted-foreground">
                  {canManage
                    ? 'Noch keine Nachrichten — verfasse die erste.'
                    : 'Keine Nachrichten gefunden'}
                </p>
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className={`p-2 rounded-lg ${
                          item.isPinned ? 'bg-brand-primary/20' : 'bg-muted'
                        }`}
                      >
                        <Bell className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {item.isPinned && (
                            <Badge variant="default" className="text-xs gap-1">
                              <Pin className="h-3 w-3" />
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
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="text-muted-foreground hover:text-red-600 shrink-0"
                        aria-label={`Nachricht "${item.title}" löschen`}
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground mb-4 whitespace-pre-wrap">{item.content}</p>

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

      {/* Compose Dialog (admin only) — migrated to CenteredModal for
          robust viewport-centering + internal scroll (fixed the
          "modal loads at bottom of viewport" bug). */}
      <CenteredModal
        open={composeOpen}
        onClose={() => !isSubmitting && setComposeOpen(false)}
        ariaLabel="Neue Nachricht verfassen"
        className="max-w-2xl"
      >
        <div className="space-y-1 mb-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            Neue Nachricht verfassen
          </h2>
          <p className="text-sm text-muted-foreground">
            Veröffentliche eine Ankündigung, ein Update oder eine Veranstaltung für deinen Verein.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section 1 — Inhalt */}
          <section className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="news-title">Titel</Label>
              <Input
                id="news-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="z.B. Sommer-Saisonplan veröffentlicht"
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="news-content">Inhalt</Label>
              <Textarea
                id="news-content"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Was möchtest du den Mitgliedern mitteilen?"
                rows={6}
                required
              />
            </div>
          </section>

          {/* Section 2 — Klassifizierung */}
          <section className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="news-type">Typ</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as NewsItem['type'] }))}
                >
                  <SelectTrigger id="news-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {getTypeLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="news-priority">Priorität</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, priority: v as NewsItem['priority'] }))
                  }
                >
                  <SelectTrigger id="news-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {getPriorityLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Section 3 — Sichtbarkeit */}
          <section className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="news-expires">Gültig bis (optional)</Label>
              <Input
                id="news-expires"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isPinned}
                onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-brand-primary focus:ring-brand-primary"
              />
              <Pin className="h-4 w-4 text-muted-foreground" />
              <span>Angepinnt an den Anfang der Liste</span>
            </label>
          </section>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setComposeOpen(false)}
              disabled={isSubmitting}
              className="mt-2 sm:mt-0"
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Veröffentlichen
            </Button>
          </div>
        </form>
      </CenteredModal>
    </div>
  );
}
