'use client';

import {
  useState,
  useTransition,
  useMemo,
  useEffect,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Power,
  PowerOff,
  Loader2,
  Plus,
  UserPlus,
  Check,
  X as XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

export interface SuperadminClubLink {
  membershipId: string;
  clubId: string;
  clubName: string;
  clubCity: string | null;
}

export interface SuperadminRow {
  membershipId: string;
  userId: string;
  fullName: string | null;
  email: string;
  clubs: SuperadminClubLink[];
  isActive: boolean;
}

export interface ClubOption {
  id: string;
  name: string;
  city: string | null;
}

/**
 * SuperadminsTableClient — Toggle + Vereinszuweisen pro Superadmin.
 *
 * Mutation-Endpunkte (geteilt mit Admins-Tabelle):
 *   PATCH /api/owner/memberships/[id] fuer Single-User-Toggle (is_active)
 *   PATCH /api/owner/memberships/[id] mit `club_ids_assign` fuer Vereins-Hinzufuegen
 *
 * Hinweis: Wir verwenden IMMER die membershipId einer bereits existierenden
 * Superadmin-Row als Anker fuer Toggle/Add. Wenn der Superadmin KEINE aktive
 * Membership mehr hat (alle Vereine entfernt -> is_active=false), wird der
 * Toggle-Button der ersten Zeile weiterhin funktionieren weil wir die
 * Membership-Liste ungecached nach dem Server-Refresh neu lesen.
 *
 * 409 No-Op wird als Info-Toast angezeigt (UI bringt die DB-Wahrheit zurueck).
 */
type OptimisticSetter = Dispatch<SetStateAction<Record<string, boolean>>>;

export function SuperadminsTableClient({
  rows: initialRows,
  availableClubs,
}: {
  rows: SuperadminRow[];
  availableClubs: ClubOption[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<SuperadminRow | null>(null);
  const [, startTransition] = useTransition();

  // Für jede Row wird der "effective" is_active-Status optimisch gehalten.
  const [optimisticActive, setOptimisticActive] = useState<Record<string, boolean>>({});

  const handleToggle = async (row: SuperadminRow) => {
    if (busyId) return;
    const targetActive = !(optimisticActive[row.membershipId] ?? row.isActive);
    setOptimisticActive((prev) => ({ ...prev, [row.membershipId]: targetActive }));
    setBusyId(row.membershipId);
    try {
      const res = await apiFetch(`/api/owner/memberships/${row.membershipId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: targetActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.info('Bereits aktuell.');
        optimistic_clear(setOptimisticActive, row.membershipId);
      } else if (!res.ok) {
        toast.error((data as { error?: string }).error ?? 'Fehler.');
        optimistic_clear(setOptimisticActive, row.membershipId);
        return;
      } else {
        toast.success(targetActive ? 'Superadmin reaktiviert.' : 'Superadmin deaktiviert.');
        optimistic_clear(setOptimisticActive, row.membershipId);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Netzwerkfehler.');
      setOptimisticActive((prev) => ({ ...prev, [row.membershipId]: row.isActive }));
    } finally {
      setBusyId(null);
    }
  };

  const handleAssign = async (row: SuperadminRow, clubIds: string[]) => {
    if (!clubIds.length || busyId) return;
    setBusyId(row.membershipId);
    try {
      const res = await apiFetch(`/api/owner/memberships/${row.membershipId}`, {
        method: 'PATCH',
        body: JSON.stringify({ club_ids_assign: clubIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? 'Vereinszuweisung fehlgeschlagen.');
        return;
      }
      toast.success(
        `${clubIds.length} Verein${clubIds.length !== 1 ? 'e' : ''} zugewiesen — Superadmin hat jetzt ${row.clubs.length + clubIds.length} Verein${row.clubs.length + clubIds.length !== 1 ? 'e' : ''}.`
      );
      setAssignFor(null);
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Netzwerkfehler.');
    } finally {
      setBusyId(null);
    }
  };

  if (initialRows.length === 0) {
    return (
      <p className="px-5 py-8 text-sm text-center text-muted-foreground">
        Keine Superadmins vorhanden.
      </p>
    );
  }

  // Optimistic-State-Helper: entfernt einen Key aus der Map (Trust-Sync nach refresh).
  const optimistic_clear = (setter: OptimisticSetter, key: string): void => {
    setter((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <>
      <div className="divide-y divide-border">
        {initialRows.map((row) => {
          const effectiveActive = optimisticActive[row.membershipId] ?? row.isActive;
          const busy = busyId === row.membershipId;
          return (
            <div
              key={row.membershipId}
              className="flex items-center justify-between px-5 py-3 hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{row.fullName ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{row.email}</p>
                {row.clubs.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                    <Building2 className="h-3 w-3" />
                    {row.clubs
                      .map((c) => `${c.clubName}${c.clubCity ? ` (${c.clubCity})` : ''}`)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <Badge variant="secondary" className="text-xs">
                  {row.clubs.length} Verein{row.clubs.length !== 1 ? 'e' : ''}
                </Badge>
                <Badge variant={effectiveActive ? 'success' : 'secondary'} className="text-xs">
                  {effectiveActive ? 'Aktiv' : 'Inaktiv'}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs h-7"
                  disabled={busy}
                  onClick={() => {
                    setAssignFor(row);
                  }}
                  title="Superadmin weitere Vereine zuweisen"
                >
                  <UserPlus className="h-3 w-3" />
                  Verein zuweisen
                </Button>
                <Button
                  size="sm"
                  variant={effectiveActive ? 'outline' : 'default'}
                  className="gap-1 text-xs h-7"
                  disabled={busy}
                  onClick={() => handleToggle(row)}
                  title={effectiveActive ? 'Superadmin deaktivieren' : 'Superadmin reaktivieren'}
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

      {assignFor && (
        <AssignClubsDialog
          row={assignFor}
          availableClubs={availableClubs}
          alreadyAssignedIds={new Set(assignFor.clubs.map((c) => c.clubId))}
          busy={busyId === assignFor.membershipId}
          onClose={() => setAssignFor(null)}
          onAssign={(ids) => handleAssign(assignFor, ids)}
        />
      )}
    </>
  );
}

function AssignClubsDialog({
  row,
  availableClubs,
  alreadyAssignedIds,
  busy,
  onClose,
  onAssign,
}: {
  row: SuperadminRow;
  availableClubs: ClubOption[];
  alreadyAssignedIds: Set<string>;
  busy: boolean;
  onClose: () => void;
  onAssign: (clubIds: string[]) => void;
}) {
  // Initialauswahl: nur NEUE Vereine (nicht bereits zugewiesene)
  const selectable = useMemo(
    () => availableClubs.filter((c) => !alreadyAssignedIds.has(c.id)),
    [availableClubs, alreadyAssignedIds]
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset bei Schliessen
  useEffect(() => {
    if (!availableClubs.length) setSelected(new Set());
  }, [availableClubs]);

  if (selectable.length === 0) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keine weiteren Vereine verfügbar</DialogTitle>
            <DialogDescription>
              Alle aktiven Vereine sind bereits {row.email} zugewiesen. Lege zuerst einen neuen
              Verein unter /owner/clubs an.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vereine zuweisen — {row.fullName ?? row.email}</DialogTitle>
          <DialogDescription>
            {row.email} wird in den ausgewählten Vereinen als Superadmin aktiv. Die Vereins-Admins
            werden via E-Mail informiert.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 max-h-80 overflow-y-auto -mx-1 px-1">
          {selectable.map((c) => {
            const checked = selected.has(c.id);
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-left transition-colors ${
                  checked
                    ? 'bg-info-50 dark:bg-info-900/20 ring-1 ring-info-300/50'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    checked
                      ? 'bg-info-600 border-info-600 text-white'
                      : 'border-border bg-background'
                  }`}
                >
                  {checked && <Check className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  {c.city && <p className="text-xs text-muted-foreground truncate">{c.city}</p>}
                </div>
              </button>
            );
          })}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            <XIcon className="h-4 w-4 mr-1" />
            Abbrechen
          </Button>
          <Button
            onClick={() => onAssign(Array.from(selected))}
            disabled={busy || selected.size === 0}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            {selected.size > 0
              ? `${selected.size} Verein${selected.size !== 1 ? 'e' : ''} zuweisen`
              : 'Auswählen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
