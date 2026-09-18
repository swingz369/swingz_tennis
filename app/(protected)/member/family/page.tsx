'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Copy, RefreshCw, Loader2, ShieldCheck, LogIn } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import { useFamilyAccounts } from '@/hooks/use-family-accounts';

const FAMILY_QUERY_KEY = ['family-accounts'];

export default function FamilyPage() {
  const queryClient = useQueryClient();
  const family = useFamilyAccounts();

  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | 'regenerate' | null>(null);

  const refetch = () => queryClient.invalidateQueries({ queryKey: FAMILY_QUERY_KEY });

  async function handleCreate() {
    setBusy('create');
    try {
      const res = await apiFetch('/api/family-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Anlegen');
      toast.success('Familienkonto erstellt');
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Anlegen');
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin() {
    if (!inviteCodeInput.trim()) {
      toast.error('Bitte Einladungscode eingeben');
      return;
    }
    setBusy('join');
    try {
      const res = await apiFetch('/api/family-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCodeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Beitreten');
      toast.success('Familie beigetreten');
      setInviteCodeInput('');
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Beitreten');
    } finally {
      setBusy(null);
    }
  }

  async function handleRegenerate() {
    setBusy('regenerate');
    try {
      const res = await apiFetch('/api/family-accounts', { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Erneuern');
      toast.success('Neuer Einladungscode erstellt');
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Erneuern');
    } finally {
      setBusy(null);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Code kopiert');
    } catch {
      toast.error('Kopieren nicht möglich');
    }
  }

  if (family.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-display text-foreground dark:text-white">
          Familienkonto
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Verwalte die Konten deiner Familie — buche für deine Kinder und behalte die Abrechnung im
          Blick.
        </p>
      </div>

      {family.hasFamily ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Familienmitglieder
              </CardTitle>
              <CardDescription>
                {family.members.length} Mitglieder in deinem Familienkonto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {family.members.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.fullName}
                      {m.isSelf && <span className="text-muted-foreground"> (du)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {m.isMinor ? 'Kind' : 'Erwachsen'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {family.canManageFamily && (
            <Card>
              <CardHeader>
                <CardTitle>Einladungscode</CardTitle>
                <CardDescription>
                  Teile diesen Code mit deinen Familienmitgliedern — sie tragen ihn unter „Familie
                  beitreten“ ein.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {family.inviteCode ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-xl border border-border bg-muted px-3 py-2 font-mono text-sm tracking-widest">
                      {family.inviteCode}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyCode(family.inviteCode!)}
                      title="Code kopieren"
                      aria-label="Einladungscode kopieren"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleRegenerate}
                      disabled={busy === 'regenerate'}
                      className="gap-1.5"
                    >
                      {busy === 'regenerate' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Neu
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      Kein offener Einladungscode vorhanden.
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleRegenerate}
                      disabled={busy === 'regenerate'}
                      className="gap-1.5"
                    >
                      {busy === 'regenerate' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Code erzeugen
                    </Button>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Ein neuer Code macht alle bisherigen offenen Codes ungültig.
                </p>
              </CardContent>
            </Card>
          )}

          {family.isParent && (
            <p className="text-xs text-muted-foreground">
              Du kannst in der Seitenleiste zwischen deinem Konto und den Kinderkonten wechseln, um
              für sie zu buchen.
            </p>
          )}
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Familienkonto erstellen
              </CardTitle>
              <CardDescription>
                Du bist Elternteil und möchtest die Konten deiner Kinder verwalten.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleCreate} disabled={busy === 'create'} className="gap-1.5">
                {busy === 'create' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Familienkonto erstellen
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-5 w-5" />
                Familie beitreten
              </CardTitle>
              <CardDescription>
                Du hast einen Einladungscode von einem Familienmitglied erhalten.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="inviteCode">Einladungscode</Label>
                <Input
                  id="inviteCode"
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value)}
                  placeholder="z.B. FAMABC123"
                  className="font-mono uppercase"
                />
              </div>
              <Button onClick={handleJoin} disabled={busy === 'join'} className="gap-1.5">
                {busy === 'join' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                Beitreten
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
