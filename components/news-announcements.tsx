'use client';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { extractErrorMessage } from '@/lib/typed-helpers';

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
import { Bell, Calendar, Clock, Tag, Loader2, Plus, Trash2, Pin, Send } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

import { createLogger } from '@/lib/logger';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const log = createLogger('news-announcements');

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
        log.error('Failed to fetch news:', err);
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
        throw new Error(extractErrorMessage(err) || `Fehler ${res.status}`);
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

  const [confirm, confirmDialog] = useConfirmDialog();

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Nachricht löschen',
      description: 'Diese Nachricht wirklich löschen?',
      confirmLabel: 'Löschen',
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/news/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err) || `Fehler ${res.status}`);
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
        return 'bg-error-100 text-error-700 border-error-200';
      case 'high':
        return 'bg-brand-accent-100 text-brand-accent-700 border-brand-accent-200';
      case 'medium':
        return 'bg-warning-100 text-warning-700 border-warning-200';
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
    <div className="space-y-4">
      {confirmDialog}
      {/* Admin create button */}
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setComposeOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Neue Nachricht
          </Button>
        </div>
      )}

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
                <div className="w-full space-y-3" role="status" aria-label="Wird geladen">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
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
                  item.isPinned ? 'border-primary/30 bg-primary/5' : ''
                } ${expired ? 'opacity-60' : ''}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className={`p-2 rounded-xl ${item.isPinned ? 'bg-primary/20' : 'bg-muted'}`}
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            className="text-muted-foreground hover:text-error-600 shrink-0"
                            aria-label={`Nachricht "${item.title}" löschen`}
                          >
                            {deletingId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{`Nachricht "${item.title}" löschen`}</TooltipContent>
                      </Tooltip>
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
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
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
