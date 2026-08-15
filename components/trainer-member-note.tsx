'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

/**
 * TrainerMemberNote
 *
 * Zeigt die eigene Notiz des Trainers für ein Mitglied.
 * Inline-Edit: Klick auf Notiz → Textarea → Speichern / Verwerfen.
 * Badge zeigt an, ob eine Notiz vorhanden ist.
 *
 * Nur für Trainer-Kontext — nicht für Members sichtbar.
 */
import { useState, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { cn } from '@/lib/utils';
import { StickyNote, Pencil, Check, X, Trash2 } from 'lucide-react';

interface Props {
  memberId: string;
  memberName: string;
  className?: string;
}

interface NoteData {
  id: string;
  note: string;
  updated_at: string;
}

export function TrainerMemberNote({ memberId, memberName, className }: Props) {
  const [note, setNote] = useState<NoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchNote = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/trainer/members/${memberId}/notes`);
      if (res.ok) {
        const data = await res.json();
        setNote(data.note ?? null);
      }
    } catch {
      // Stille Fehlerbehandlung — Notiz ist optional
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  const handleEdit = () => {
    setDraft(note?.note ?? '');
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft('');
  };

  const handleSave = async () => {
    if (!draft.trim()) {
      toast.error('Notiz darf nicht leer sein');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/trainer/members/${memberId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: draft.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err) ?? 'Speichern fehlgeschlagen');
      }
      const data = await res.json();
      setNote(data.note);
      setEditing(false);
      setDraft('');
      toast.success('Notiz gespeichert');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/trainer/members/${memberId}/notes`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err) ?? 'Löschen fehlgeschlagen');
      }
      setNote(null);
      setEditing(false);
      setDraft('');
      toast.success('Notiz gelöscht');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Löschen');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  return (
    <Card variant="bordered" className={cn('w-full', className)}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-primary shrink-0" />
            <span className="font-semibold text-sm">Trainer-Notiz</span>
            {!loading && note && (
              <Badge
                variant="warning"
                size="sm"
                className="bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400 border-warning-200 dark:border-warning-800"
              >
                Vorhanden
              </Badge>
            )}
          </div>

          {/* Actions when not editing */}
          {!editing && !loading && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={handleEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
                {note ? 'Bearbeiten' : 'Neue Notiz'}
              </Button>
              {note && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {/* Display mode */}
        {!loading && !editing && (
          <div>
            {note ? (
              <div className="space-y-1">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {note.note}
                </p>
                <p className="text-xs text-muted-foreground">
                  Zuletzt aktualisiert: {formatDate(note.updated_at)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Noch keine Notiz für {memberName} vorhanden.
              </p>
            )}
          </div>
        )}

        {/* Edit mode */}
        {editing && (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Notiz zu ${memberName} (z.B. Verletzung, Technik-Schwerpunkt…)`}
              rows={4}
              maxLength={2000}
              className="resize-none text-sm"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{draft.length}/2000 Zeichen</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  <X className="h-3.5 w-3.5" />
                  Verwerfen
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={handleSave}
                  disabled={saving || !draft.trim()}
                >
                  <Check className="h-3.5 w-3.5" />
                  {saving ? 'Speichern…' : 'Speichern'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
