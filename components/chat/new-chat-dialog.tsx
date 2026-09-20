'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CenteredModal } from '@/components/ui/centered-modal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-fetch';
import { extractErrorMessage } from '@/lib/typed-helpers';

interface Person {
  id: string;
  name: string;
  sub: string;
}

type Audience = 'custom' | 'all' | 'trainers';

interface Props {
  open: boolean;
  onClose: () => void;
  clubId: string | null;
  /** Nur Trainer und Verwaltung dürfen Gruppen anlegen. */
  canCreateGroup: boolean;
  /** Vollständige Mitgliederliste (Admin) oder nur Namensverzeichnis (alle anderen). */
  isAdmin: boolean;
  currentUserId?: string;
  onCreated: (conversationId: string) => void;
}

/** Neuer Chat: Direktnachricht an eine Person oder (für Trainer/Verwaltung) eine Gruppe. */
export function NewChatDialog({
  open,
  onClose,
  clubId,
  canCreateGroup,
  isAdmin,
  currentUserId,
  onCreated,
}: Props) {
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState<Audience>('custom');
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !clubId) return;
    setLoading(true);
    apiFetch(
      isAdmin
        ? `/api/members?clubId=${clubId}&limit=100&active=true`
        : `/api/members/directory?clubId=${clubId}`
    )
      .then((res) => res.json())
      .then((data) =>
        setPeople(
          (data.members ?? [])
            .map((m: Record<string, string>) => ({
              id: m.userId ?? m.id,
              name: m.name ?? ([m.firstName, m.lastName].filter(Boolean).join(' ') || m.email),
              sub: m.role ?? '',
            }))
            .filter((p: Person) => p.id !== currentUserId)
        )
      )
      .catch(() => toast.error('Mitgliederliste konnte nicht geladen werden'))
      .finally(() => setLoading(false));
  }, [open, clubId, isAdmin, currentUserId]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
  }, [people, search]);

  const request = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await apiFetch('/api/chat/conversations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(extractErrorMessage(data) || 'Chat konnte nicht angelegt werden');
      onCreated(data.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chat konnte nicht angelegt werden');
    } finally {
      setBusy(false);
    }
  };

  const canSubmitGroup = title.trim() !== '' && (audience !== 'custom' || picked.length > 0);

  return (
    <CenteredModal
      open={open}
      onClose={onClose}
      ariaLabel="Neuer Chat"
      className="w-full max-w-md p-5"
    >
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Neuer Chat</h2>
        {canCreateGroup && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'direct' | 'group')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="direct">Direkt</TabsTrigger>
              <TabsTrigger value="group">Gruppe</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {mode === 'group' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="chat-title">Gruppenname</Label>
              <Input
                id="chat-title"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teilnehmer</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Auswahl</SelectItem>
                  <SelectItem value="all">Alle Mitglieder</SelectItem>
                  <SelectItem value="trainers">Trainer und Verwaltung</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {(mode === 'direct' || audience === 'custom') && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Person suchen…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
              {loading ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : visible.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Keine Treffer</p>
              ) : (
                visible.map((p) =>
                  mode === 'direct' ? (
                    <button
                      key={p.id}
                      type="button"
                      disabled={busy}
                      onClick={() => clubId && request({ kind: 'direct', userId: p.id })}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.sub}</span>
                    </button>
                  ) : (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={picked.includes(p.id)}
                        onCheckedChange={(c) =>
                          setPicked((prev) =>
                            c ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                          )
                        }
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  )
                )
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          {mode === 'group' && (
            <Button
              disabled={busy || !canSubmitGroup}
              onClick={() => request({ kind: 'group', title, audience, userIds: picked })}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gruppe anlegen
            </Button>
          )}
        </div>
      </div>
    </CenteredModal>
  );
}
