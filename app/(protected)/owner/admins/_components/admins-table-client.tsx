'use client';

import { useState, useTransition, type Dispatch, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Power, PowerOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

type OptimisticSetter = Dispatch<SetStateAction<Record<string, boolean>>>;

export interface AdminRow {
  membershipId: string;
  userId: string;
  fullName: string | null;
  email: string;
  club: { id: string; name: string; city: string | null } | null;
  tier: string | null;
  status: string | null;
  isActive: boolean;
}

const tierLabel: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
};

/**
 * Optimistic-State-Helper: entfernt einen Key aus der Map.
 * Wird nach erfolgreichem Server-Refresh (oder bei 409/Error-Pfad) gerufen,
 * damit der Server-Wert beim nächsten Render als Truth übernommen wird.
 */
function optimistic_clear(setter: OptimisticSetter, key: string): void {
  setter((prev) => {
    const next = { ...prev };
    delete next[key];
    return next;
  });
}

/**
 * AdminsTableClient — Toggle pro Admin-Zeile (Soft-Aktivierung/-Deaktivierung).
 *
 * Mutation: PATCH /api/owner/memberships/[id] mit `{ is_active: boolean }`.
 * Die Route setzt `deactivated_at/deactivated_by` automatisch wenn is_active=false,
 * und cleart sie bei Reaktivierung (reversibel).
 *
 * 409-No-Op wird als Info-Toast angezeigt (kein Audit-Log-Noise).
 *
 * Designentscheidung: bewusst nur EIN Toggle pro Row, kein Hard-Delete. Wenn der
 * Verein dauerhaft einen neuen Admin braucht, wird der bisherige deaktiviert und
 * über /owner/clubs ein neuer eingeladen.
 */
export function AdminsTableClient({ rows: initialRows }: { rows: AdminRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const handleToggle = async (row: AdminRow) => {
    if (busyId) return;
    const targetActive = !(optimistic[row.membershipId] ?? row.isActive);
    setOptimistic((prev) => ({ ...prev, [row.membershipId]: targetActive }));
    setBusyId(row.membershipId);
    try {
      const res = await apiFetch(`/api/owner/memberships/${row.membershipId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: targetActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.info('Bereits aktuell — keine Änderung.');
        optimistic_clear(setOptimistic, row.membershipId);
      } else if (!res.ok) {
        toast.error((data as { error?: string }).error ?? 'Fehler beim Umschalten.');
        // Rollback: optimistic loeschen, naechster Render liest row.isActive (Server-Truth).
        optimistic_clear(setOptimistic, row.membershipId);
        return;
      } else {
        toast.success(targetActive ? 'Admin reaktiviert.' : 'Admin deaktiviert.');
        // Trust-Sync nach Server-Refresh: optimistic freigeben.
        optimistic_clear(setOptimistic, row.membershipId);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Netzwerkfehler.');
      setOptimistic((prev) => ({ ...prev, [row.membershipId]: row.isActive }));
    } finally {
      setBusyId(null);
    }
  };

  if (initialRows.length === 0) {
    return (
      <p className="px-5 py-8 text-sm text-center text-muted-foreground">Keine Admins gefunden.</p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {initialRows.map((row) => {
        const effectiveActive = optimistic[row.membershipId] ?? row.isActive;
        const statusActive = effectiveActive && row.status === 'active';
        const busy = busyId === row.membershipId;
        return (
          <div
            key={row.membershipId}
            className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{row.fullName ?? '—'}</p>
              <p className="text-xs text-muted-foreground">{row.email}</p>
              {row.club && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {row.club.name}
                  {row.club.city ? ` · ${row.club.city}` : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <Badge variant="outline" className="text-xs">
                {tierLabel[row.tier ?? 'free'] ?? 'Free'}
              </Badge>
              <Badge variant={statusActive ? 'success' : 'secondary'} className="text-xs">
                {statusActive ? 'Aktiv' : 'Inaktiv'}
              </Badge>
              <Button
                size="sm"
                variant={effectiveActive ? 'outline' : 'default'}
                className="gap-1 text-xs h-7"
                disabled={busy}
                onClick={() => handleToggle(row)}
                title={
                  effectiveActive
                    ? 'Admin deaktivieren (Soft-Toggle, reaktivierbar)'
                    : 'Admin reaktivieren'
                }
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : effectiveActive ? (
                  <PowerOff className="h-3 w-3" />
                ) : (
                  <Power className="h-3 w-3" />
                )}
                {effectiveActive ? 'Deaktivieren' : 'Reaktivieren'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
