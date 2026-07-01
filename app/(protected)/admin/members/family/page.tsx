'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, RefreshCw, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

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

export default function AdminFamilyPage() {
  const [groups, setGroups] = useState<FamilyGroup[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Familienkonten</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Übersicht aller Familiengruppen im Verein
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchGroups} className="gap-1.5">
          <RefreshCw className="h-4 w-4" />
          Aktualisieren
        </Button>
      </div>

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
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.familyGroupId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-brand-primary" />
                  {group.members.find((m) => m.role === 'parent')?.fullName ??
                    group.members[0]?.fullName ??
                    'Familiengruppe'}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground/60">
                  {group.members.length} Mitglied{group.members.length !== 1 ? 'er' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
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
    </div>
  );
}
