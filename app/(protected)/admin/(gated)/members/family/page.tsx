'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Users, RefreshCw, X, Plus, UserPlus } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import { PageHeader } from '@/components/ui/page-header';

const log = createLogger('admin:members:family');

interface FamilyGroup {
  familyGroupId: string;
  members: Array<{
    userId: string;
    fullName: string;
    email: string;
    role: string;
    relationship: string | null;
  }>;
}

interface ClubMember {
  id: string;
  name: string;
  email: string;
}

export default function AdminFamilyPage() {
  const [groups, setGroups] = useState<FamilyGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/link dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogGroupId, setDialogGroupId] = useState<string | null>(null); // null = new group
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/family-accounts');
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      setGroups(data.groups ?? []);
    } catch (err) {
      log.error('Fetch error', err instanceof Error ? err : undefined);
      toast.error('Familienkonten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  const handleRemoveMember = async (familyGroupId: string, userId: string) => {
    try {
      const res = await apiFetch('/api/admin/family-accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyGroupId, userId }),
      });
      if (!res.ok) throw new Error('Fehler');
      toast.success('Mitglied aus Familie entfernt');
      void fetchGroups();
    } catch (err) {
      log.error('Remove error', err instanceof Error ? err : undefined);
      toast.error('Fehler beim Entfernen');
    }
  };

  const alreadyLinkedIds = useMemo(
    () => new Set(groups.flatMap((g) => g.members.map((m) => m.userId))),
    [groups]
  );

  const openDialog = (groupId: string | null) => {
    setDialogGroupId(groupId);
    setSelectedIds(new Set());
    setSearch('');
    setDialogOpen(true);
    if (members.length === 0) {
      setMembersLoading(true);
      apiFetch('/api/members?active=true&limit=200')
        .then((res) => res.json())
        .then((data) => {
          const items: ClubMember[] = (data.members ?? []).map((m: any) => ({
            id: m.userId ?? m.id,
            name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
            email: m.email,
          }));
          setMembers(items);
        })
        .catch(() => toast.error('Mitglieder konnten nicht geladen werden'))
        .finally(() => setMembersLoading(false));
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      // In "add to existing group" mode, hide members already in *this* group.
      !(
        dialogGroupId &&
        groups
          .find((g) => g.familyGroupId === dialogGroupId)
          ?.members.some((gm) => gm.userId === m.id)
      ) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/family-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberIds: Array.from(selectedIds),
          familyGroupId: dialogGroupId ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler');
      }
      toast.success(dialogGroupId ? 'Mitglieder hinzugefügt' : 'Familiengruppe angelegt');
      setDialogOpen(false);
      void fetchGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Familienkonten"
        description="Familiengruppen im Verein anlegen und verwalten"
        actions={[
          { label: 'Aktualisieren', icon: RefreshCw, variant: 'outline', onClick: fetchGroups },
          { label: 'Neue Familiengruppe', icon: Plus, onClick: () => openDialog(null) },
        ]}
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Keine Familiengruppen vorhanden</p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => openDialog(null)}>
              <Plus className="h-4 w-4" />
              Erste Familiengruppe anlegen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.familyGroupId}>
              <CardHeader className="pb-3 flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand-primary" />
                    {group.members.find((m) => m.role === 'parent')?.fullName ??
                      group.members[0]?.fullName ??
                      'Familiengruppe'}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground/60">
                    {group.members.length} Mitglied{group.members.length !== 1 ? 'er' : ''}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => openDialog(group.familyGroupId)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Mitglied hinzufügen
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{m.fullName}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {m.role === 'parent'
                          ? 'Elternteil'
                          : m.role === 'child'
                            ? 'Kind'
                            : 'Mitglied'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-error-500"
                        onClick={() => handleRemoveMember(group.familyGroupId, m.userId)}
                        aria-label={`${m.fullName} aus Familie entfernen`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogGroupId ? 'Mitglieder zur Gruppe hinzufügen' : 'Neue Familiengruppe anlegen'}
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Mitglied suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-72 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
            {membersLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Lade Mitglieder…</p>
            ) : filteredMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Keine Ergebnisse</p>
            ) : (
              filteredMembers.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedIds.has(m.id)}
                    onCheckedChange={() => toggleSelected(m.id)}
                  />
                  <span className="text-sm">
                    {m.name}
                    {alreadyLinkedIds.has(m.id) && !dialogGroupId && (
                      <span className="text-xs text-muted-foreground"> (bereits in Familie)</span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={selectedIds.size === 0 || saving}>
              {saving ? 'Speichern…' : dialogGroupId ? 'Hinzufügen' : 'Gruppe anlegen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
