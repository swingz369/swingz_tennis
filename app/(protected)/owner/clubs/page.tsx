'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Plus, UserPlus, ExternalLink, Search, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PaginationNav } from '@/components/ui/pagination-nav';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { showInviteResult } from '@/lib/invite-feedback';
import { apiFetch } from '@/lib/api-fetch';
import { formatDate } from '@/lib/format';
import { createLogger } from '@/lib/logger';
import type { PaginationMeta } from '@/lib/pagination';
import { PageHeader } from '@/components/ui/page-header';
import { ClubDetailSheet } from './_components/club-detail-sheet';
import { recommendSoloPlan, PLAN_LABELS } from '@/lib/plans';

const log = createLogger('owner-clubs');

interface Club {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  maxMembers: number;
  createdAt?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  pending: 'Wartet auf Freigabe',
  deleted: 'Gelöscht',
};

export default function OwnerClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ── Tabellensteuerung ──
  // Suche, Statusfilter, Sortierung und Seitengrösse laufen alle über die API
  // (siehe app/api/clubs/route.ts). Vorher holte die Seite die ersten 20
  // Vereine und filterte die im Browser: ab Verein 21 fehlten Einträge, ohne
  // dass die Oberfläche das irgendwo gesagt hätte.
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState<'created_at' | 'name'>('created_at');
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  const [newClubOpen, setNewClubOpen] = useState(false);
  const [newClub, setNewClub] = useState({ name: '', city: '' });
  const [creating, setCreating] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteClubId, setInviteClubId] = useState('');
  const [inviteClubName, setInviteClubName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [editingClubId, setEditingClubId] = useState<string | null>(null);

  const [deleteClubId, setDeleteClubId] = useState<string | null>(null);
  const [deleteClubName, setDeleteClubName] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }).toString();

  const refreshClubs = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const r = await apiFetch(`/api/clubs?${query}`, signal ? { signal } : undefined);
        const d = await r.json();
        setClubs(d.clubs ?? []);
        setMeta(d.pagination ?? null);
      } catch (err) {
        // Abbruch beim Tippen (neue Suche löst die alte ab) ist kein Fehler.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        log.error('Vereine konnten nicht geladen werden', err instanceof Error ? err : undefined);
        toast.error('Vereine konnten nicht geladen werden');
      }
    },
    [query]
  );

  const handleActivateClub = async (clubId: string) => {
    setActivating(clubId);
    try {
      const res = await apiFetch(`/api/clubs/${clubId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
      });
      if (!res.ok) {
        toast.error('Fehler beim Freigeben');
        return;
      }
      toast.success('Verein freigegeben');
      setClubs((prev) => prev.map((c) => (c.id === clubId ? { ...c, status: 'active' } : c)));
    } finally {
      setActivating(null);
    }
  };

  const handleDeleteClub = async () => {
    if (!deleteClubId || deleteConfirmText !== deleteClubName) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/clubs/${deleteClubId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(extractErrorMessage(data) || 'Fehler beim Löschen');
        return;
      }
      toast.success('Verein gelöscht — über „Wiederherstellen" rückgängig machbar');
      setClubs((prev) =>
        prev.map((c) => (c.id === deleteClubId ? { ...c, status: 'deleted' } : c))
      );
      setDeleteClubId(null);
      setDeleteConfirmText('');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestoreClub = async (clubId: string) => {
    setRestoring(clubId);
    try {
      const res = await apiFetch(`/api/clubs/${clubId}/restore`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(extractErrorMessage(data) || 'Fehler beim Wiederherstellen');
        return;
      }
      toast.success('Verein wiederhergestellt');
      setClubs((prev) => prev.map((c) => (c.id === clubId ? { ...c, status: 'active' } : c)));
    } finally {
      setRestoring(null);
    }
  };

  // /owner → "Verein anlegen" verlinkt hierher mit ?new=1 — Dialog direkt öffnen
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('new')) setNewClubOpen(true);
  }, []);

  // Ein Effekt für Laden, Suchen, Filtern, Blättern — `query` fasst alle
  // Stellschrauben zusammen. Die Suche wird entprellt, damit nicht jeder
  // Tastendruck eine Abfrage auslöst.
  const isFirstLoad = useRef(true);
  useEffect(() => {
    const controller = new AbortController();
    const delay = isFirstLoad.current ? 0 : 250;
    isFirstLoad.current = false;
    const t = setTimeout(() => {
      refreshClubs(controller.signal).finally(() => setLoading(false));
    }, delay);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [refreshClubs]);

  // Suche/Filter/Seitengrösse ändern die Treffermenge — auf Seite 7 einer
  // dreiseitigen Liste stünde sonst nichts.
  const resetToFirstPage = () => setPage(1);

  const handleCreateClub = async () => {
    if (!newClub.name.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch('/api/clubs', {
        method: 'POST',
        body: JSON.stringify({ name: newClub.name, city: newClub.city || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(extractErrorMessage(data) ?? 'Fehler');
        return;
      }
      toast.success(`Verein "${data.name}" angelegt`);
      setClubs((prev) => [
        { id: data.clubId, name: data.name, status: 'active', memberCount: 0, maxMembers: 100 },
        ...prev,
      ]);
      setNewClubOpen(false);
      setNewClub({ name: '', city: '' });
    } finally {
      setCreating(false);
    }
  };

  const handleInviteAdmin = async () => {
    if (!inviteEmail.trim() || !inviteClubId) return;
    setInviting(true);
    try {
      const res = await apiFetch('/api/owner/invite-admin', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, fullName: inviteName, clubId: inviteClubId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(extractErrorMessage(data) ?? 'Fehler');
        return;
      }
      showInviteResult(data, `Einladung an ${inviteEmail} verschickt`);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alle Vereine"
        actions={[{ label: 'Verein anlegen', icon: Plus, onClick: () => setNewClubOpen(true) }]}
      />

      {/* Steuerleiste: Suche, Statusfilter, Sortierung */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Verein suchen..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetToFirstPage();
            }}
            className="pl-9"
            aria-label="Vereine durchsuchen"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            resetToFirstPage();
          }}
        >
          <SelectTrigger className="w-full sm:w-[200px]" aria-label="Nach Status filtern">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="pending">Wartet auf Freigabe</SelectItem>
            <SelectItem value="deleted">Gelöscht</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(v) => {
            setSort(v as 'created_at' | 'name');
            resetToFirstPage();
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Sortierung">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Neueste zuerst</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border dark:border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Verein</TableHead>
                <TableHead className="text-right">Mitglieder</TableHead>
                <TableHead className="hidden lg:table-cell">Tarif</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Angelegt</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Lade Vereine…
                  </TableCell>
                </TableRow>
              ) : clubs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    {search || statusFilter !== 'all'
                      ? 'Kein Verein passt zu Suche und Filter.'
                      : 'Noch kein Verein angelegt.'}
                  </TableCell>
                </TableRow>
              ) : (
                clubs.map((club) => (
                  <TableRow key={club.id}>
                    <TableCell className="font-medium">{club.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{club.memberCount}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {PLAN_LABELS[recommendSoloPlan(club.memberCount)]}
                    </TableCell>
                    <TableCell>
                      {club.status === 'active' ? (
                        <span className="text-sm text-muted-foreground">Aktiv</span>
                      ) : (
                        <Badge variant={club.status === 'pending' ? 'warning' : 'secondary'}>
                          {STATUS_LABELS[club.status] ?? club.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground tabular-nums">
                      {club.createdAt ? formatDate(club.createdAt) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {club.status === 'deleted' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={restoring === club.id}
                            onClick={() => handleRestoreClub(club.id)}
                          >
                            {restoring === club.id ? '…' : 'Wiederherstellen'}
                          </Button>
                        ) : (
                          <>
                            {club.status === 'pending' && (
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                disabled={activating === club.id}
                                onClick={() => handleActivateClub(club.id)}
                              >
                                {activating === club.id ? '…' : 'Freigeben'}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-xs"
                              onClick={() => {
                                setInviteClubId(club.id);
                                setInviteClubName(club.name);
                                setInviteOpen(true);
                              }}
                            >
                              <UserPlus className="h-3 w-3" /> Admin
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-xs"
                              onClick={() => setEditingClubId(club.id)}
                            >
                              <Pencil className="h-3 w-3" /> Bearbeiten
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" asChild>
                              <Link href={`/api/admin/switch-club-redirect?clubId=${club.id}`}>
                                <ExternalLink className="h-3 w-3" /> Als Admin
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-error-600 hover:bg-error-50 hover:text-error-700 dark:hover:bg-error-900/20"
                              aria-label={`${club.name} löschen`}
                              onClick={() => {
                                setDeleteClubId(club.id);
                                setDeleteClubName(club.name);
                                setDeleteConfirmText('');
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {meta && (
        <PaginationNav
          meta={meta}
          onPageChange={setPage}
          pageSizeOptions={[10, 25, 50, 'all']}
          currentLimit={limit}
          onPageSizeChange={(size) => {
            setLimit(size);
            resetToFirstPage();
          }}
        />
      )}

      {/* Detail-Drawer (Phase 2) */}
      <ClubDetailSheet
        clubId={editingClubId}
        onClose={() => setEditingClubId(null)}
        onSaved={refreshClubs}
      />

      {/* Dialog: Neuer Verein */}
      <Dialog open={newClubOpen} onOpenChange={setNewClubOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Verein anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="clubName">Vereinsname *</Label>
              <Input
                id="clubName"
                value={newClub.name}
                onChange={(e) => setNewClub((p) => ({ ...p, name: e.target.value }))}
                placeholder="TC Musterstadt e.V."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="clubCity">Stadt</Label>
              <Input
                id="clubCity"
                value={newClub.city}
                onChange={(e) => setNewClub((p) => ({ ...p, city: e.target.value }))}
                placeholder="Musterstadt"
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewClubOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateClub} disabled={creating || !newClub.name.trim()}>
              {creating ? 'Anlegen...' : 'Anlegen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Admin einladen */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin einladen — {inviteClubName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="adminName">Name</Label>
              <Input
                id="adminName"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Max Mustermann"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="adminEmail">E-Mail *</Label>
              <Input
                id="adminEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="admin@tc-musterstadt.de"
                className="mt-1.5"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Der Admin erhält eine E-Mail mit einem Einrichtungslink. Nach dem Klick kann er sein
              Passwort setzen und sofort loslegen.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleInviteAdmin} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? 'Sende...' : 'Einladung senden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Verein löschen (Soft-Delete) */}
      <Dialog
        open={!!deleteClubId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteClubId(null);
            setDeleteConfirmText('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verein löschen — {deleteClubName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Alle Mitgliedschaften dieses Vereins werden deaktiviert — niemand kann sich mehr
              anmelden. Der Verein bleibt erhalten und kann jederzeit über „Wiederherstellen"
              reaktiviert werden.
            </p>
            <div>
              <Label htmlFor="deleteConfirm">
                Zur Bestätigung Vereinsnamen eingeben: <strong>{deleteClubName}</strong>
              </Label>
              <Input
                id="deleteConfirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-1.5"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteClubId(null);
                setDeleteConfirmText('');
              }}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteClub}
              disabled={deleting || deleteConfirmText !== deleteClubName}
            >
              {deleting ? 'Löschen...' : 'Verein löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
