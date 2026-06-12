'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Eye,
  UserCheck,
  UserX,
  Search,
  Download,
  UserPlus,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { exportMembersCSV } from '@/lib/csv-export';
import type { Member } from './member.types';
import type { PaginationMeta } from '@/lib/pagination';
import { PaginationNav } from '@/components/ui/pagination-nav';
import { apiFetch } from '@/lib/api-fetch';

interface MembersClientProps {
  initialMembers: Member[];
  clubId: string;
  pagination: PaginationMeta;
}

export function MembersClient({ initialMembers, clubId, pagination }: MembersClientProps) {
  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    return `?${params.toString()}`;
  };
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') ?? '');

  // Sync searchQuery when URL params change (e.g. back/forward navigation)
  useEffect(() => {
    setSearchQuery(searchParams.get('search') ?? '');
  }, [searchParams]);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    role: 'member' as 'member' | 'trainer' | 'admin',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [planningFilter, setPlanningFilter] = useState<string>('all'); // 'all' | 'included' | 'excluded'

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeactivating, setBulkDeactivating] = useState(false);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMembers.map((m) => m.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDeactivate = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeactivating(true);
    let successCount = 0;
    let failCount = 0;
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await apiFetch(`/api/members/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_active: false }),
          });
          if (res.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      })
    );
    if (successCount > 0) {
      toast.success(`${successCount} Mitglied${successCount !== 1 ? 'er' : ''} deaktiviert`);
      setMembers((prev) =>
        prev.map((m) => (selectedIds.has(m.id) ? { ...m, is_active: false } : m))
      );
    }
    if (failCount > 0) {
      toast.error(
        `${failCount} Mitglied${failCount !== 1 ? 'er' : ''} konnte${failCount === 1 ? 'te' : 'n'} nicht deaktiviert werden`
      );
    }
    setSelectedIds(new Set());
    setBulkConfirmOpen(false);
    setBulkDeactivating(false);
  };

  // Filter members (client-side for role/status/planning; search is server-side)
  const filteredMembers = members.filter((member) => {
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' || (statusFilter === 'active' ? member.is_active : !member.is_active);
    const matchesPlanning =
      planningFilter === 'all' ||
      (planningFilter === 'included'
        ? member.include_in_planning !== false
        : member.include_in_planning === false);
    return matchesRole && matchesStatus && matchesPlanning;
  });

  // Paginated display (client-side within current page)
  const paginatedMembers = filteredMembers;

  const allSelected =
    filteredMembers.length > 0 && filteredMembers.every((m) => selectedIds.has(m.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const handleTogglePlanning = async (memberId: string, currentValue: boolean) => {
    try {
      const res = await apiFetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ include_in_planning: !currentValue }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update membership');
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, include_in_planning: !currentValue } : m))
      );
      toast.success(
        currentValue
          ? 'Mitglied von Saisonplanung ausgeschlossen'
          : 'Mitglied nimmt an Saisonplanung teil'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Aktion fehlgeschlagen';
      toast.error(message);
    }
  };

  const handleToggleActive = async (memberId: string, currentActive: boolean) => {
    try {
      const res = await apiFetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !currentActive }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update membership');
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, is_active: !currentActive } : m))
      );
      toast.success(`Mitglied ${currentActive ? 'deaktiviert' : 'aktiviert'}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Aktion fehlgeschlagen';
      toast.error(message);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    try {
      const res = await apiFetch('/api/members/invite', {
        method: 'POST',
        body: JSON.stringify({
          ...inviteForm,
          club_id: clubId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Einladung fehlgeschlagen');
      }

      const data = await res.json();

      // Add invited member to list (use data from response or build from form)
      const newMember: Member = data.member ?? {
        id: data.membershipId ?? `temp-${Date.now()}`,
        user_id: data.userId ?? '',
        full_name: inviteForm.full_name || inviteForm.email.split('@')[0],
        email: inviteForm.email,
        role: inviteForm.role as Member['role'],
        is_active: true,
        include_in_planning: true,
        joined_at: new Date().toISOString(),
      };
      setMembers((prev) => [...prev, newMember]);
      setShowInviteDialog(false);
      setInviteForm({ email: '', full_name: '', role: 'member' });
      toast.success(data.message ?? 'Mitglied erfolgreich eingeladen');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Einladung fehlgeschlagen';
      toast.error(message);
    } finally {
      setInviteLoading(false);
    }
  };

  // Note: Role-Änderung wurde aus der Liste entfernt — wird jetzt ausschließlich
  // über die Mitglieder-Detail-Seite (app/(protected)/admin/members/[id]) verwaltet.

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-brand-primary dark:text-white">
            Mitgliederverwaltung
          </h1>
          <p className="text-sm md:text-base text-muted-foreground dark:text-muted-foreground">
            Verwalte deine Vereinsmitglieder
          </p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Mitglied einladen
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suche nach Name oder E-Mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const params = new URLSearchParams(searchParams.toString());
                params.set('page', '1');
                if (searchQuery) {
                  params.set('search', searchQuery);
                } else {
                  params.delete('search');
                }
                router.push(`?${params.toString()}`);
              }
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(v);
            setSelectedIds(new Set());
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Rollen</SelectItem>
            <SelectItem value="member">Mitglied</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setSelectedIds(new Set());
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="inactive">Inaktiv</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={planningFilter}
          onValueChange={(v) => {
            setPlanningFilter(v);
            setSelectedIds(new Set());
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Planung</SelectItem>
            <SelectItem value="included">In Planung</SelectItem>
            <SelectItem value="excluded">Ausgeschlossen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Export + View Toggle */}
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
          title={viewMode === 'table' ? 'Kartenansicht' : 'Tabellenansicht'}
        >
          {viewMode === 'table' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            exportMembersCSV(filteredMembers);
            toast.success('Mitglieder-Export gestartet');
          }}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Members Table / Grid */}
      {viewMode === 'table' ? (
        <div className="rounded-md border border-border dark:border-white/10 bg-background dark:bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted dark:bg-muted">
                <tr>
                  <th className="w-10 px-2 py-3">
                    <Checkbox
                      checked={allSelected || (someSelected ? 'indeterminate' : false)}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Alle auswählen"
                    />
                  </th>
                  <th className="px-2 md:px-3 py-3 text-center text-xs font-semibold text-foreground dark:text-foreground uppercase tracking-wider">
                    Planung
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-foreground dark:text-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-foreground dark:text-foreground uppercase tracking-wider">
                    E-Mail
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-foreground dark:text-foreground uppercase tracking-wider hidden lg:table-cell">
                    Telefon
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-foreground dark:text-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-foreground dark:text-foreground uppercase tracking-wider hidden md:table-cell">
                    Beigetreten
                  </th>
                  <th className="px-4 md:px-6 py-3 text-right text-xs font-semibold text-foreground dark:text-foreground uppercase tracking-wider">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-white/10">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 md:px-6 py-8 text-center text-muted-foreground dark:text-muted-foreground"
                    >
                      Keine Mitglieder gefunden
                    </td>
                  </tr>
                ) : (
                  paginatedMembers.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-muted dark:hover:bg-background/5 transition-colors"
                    >
                      <td className="w-10 px-2 py-4">
                        <Checkbox
                          checked={selectedIds.has(member.id)}
                          onCheckedChange={() => toggleSelect(member.id)}
                          aria-label={`${member.full_name} auswählen`}
                        />
                      </td>
                      <td className="px-2 md:px-3 py-4 text-center">
                        {member.role === 'member' ? (
                          <button
                            onClick={() =>
                              handleTogglePlanning(member.id, member.include_in_planning)
                            }
                            className="hover:scale-110 transition-transform"
                            title={
                              member.include_in_planning
                                ? 'Von Planung ausschließen'
                                : 'In Planung einbeziehen'
                            }
                          >
                            {member.include_in_planning !== false ? (
                              <CheckSquare className="h-4 w-4 text-green-600" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-foreground dark:text-white">
                          {member.full_name}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-muted-foreground dark:text-muted-foreground text-sm">
                        {member.email}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-muted-foreground dark:text-muted-foreground text-sm hidden lg:table-cell">
                        {member.phone || '—'}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(member.id, member.is_active)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors hover:opacity-80 ${
                            member.is_active
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground'
                          }`}
                        >
                          {member.is_active ? 'Aktiv' : 'Inaktiv'}
                        </button>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-muted-foreground dark:text-muted-foreground hidden md:table-cell">
                        {formatDate(member.joined_at)}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" title="Details" asChild>
                            <Link href={`/admin/members/${member.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={member.is_active ? 'Deaktivieren' : 'Aktivieren'}
                            onClick={() => handleToggleActive(member.id, member.is_active)}
                          >
                            {member.is_active ? (
                              <UserX className="h-4 w-4 text-orange-600" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredMembers.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground dark:text-muted-foreground">
              Keine Mitglieder gefunden
            </div>
          ) : (
            paginatedMembers.map((member) => (
              <Card
                key={member.id}
                className="hover:shadow-md transition-shadow border-border dark:border-white/10"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold truncate">
                        {member.full_name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate mt-0.5">
                        {member.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {member.role === 'member' && (
                        <button
                          onClick={() =>
                            handleTogglePlanning(member.id, member.include_in_planning)
                          }
                          className="hover:scale-110 transition-transform"
                          title={
                            member.include_in_planning
                              ? 'Von Planung ausschließen'
                              : 'In Planung einbeziehen'
                          }
                        >
                          {member.include_in_planning !== false ? (
                            <CheckSquare className="h-4 w-4 text-green-600" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(member.id, member.is_active)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors hover:opacity-80 ${
                        member.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground'
                      }`}
                    >
                      {member.is_active ? 'Aktiv' : 'Inaktiv'}
                    </button>
                  </div>
                  {member.phone && (
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                      {member.phone}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                    Beigetreten: {formatDate(member.joined_at)}
                  </p>
                  <div className="flex justify-end gap-1 pt-1 border-t border-border dark:border-white/5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Details" asChild>
                      <Link href={`/admin/members/${member.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={member.is_active ? 'Deaktivieren' : 'Aktivieren'}
                      onClick={() => handleToggleActive(member.id, member.is_active)}
                    >
                      {member.is_active ? (
                        <UserX className="h-4 w-4 text-orange-600" />
                      ) : (
                        <UserCheck className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Server-side Pagination */}
      {pagination.totalCount > 0 && (
        <PaginationNav meta={pagination} buildUrl={buildPageUrl} compact />
      )}

      {/* Stats */}
      <div className="text-sm text-muted-foreground dark:text-muted-foreground">
        {pagination.totalCount > 0 ? `${pagination.totalCount} Mitglieder` : '0 Mitglieder'}
      </div>

      {/* Bulk Selection Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-3 shadow-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} Mitglied{selectedIds.size !== 1 ? 'er' : ''} ausgewählt
          </span>
          <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
            Auswahl aufheben
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setBulkConfirmOpen(true)}>
            <UserX className="h-4 w-4 mr-1.5" />
            Ausgewählte deaktivieren
          </Button>
        </div>
      )}

      {/* Bulk Deactivate Confirmation Dialog */}
      {bulkConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-red-600">
                {selectedIds.size} Mitglied{selectedIds.size !== 1 ? 'er' : ''} deaktivieren?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Folgende Mitglieder werden deaktiviert und verlieren den Zugang zum Vereinsportal:
              </p>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/50 p-2 space-y-1">
                {Array.from(selectedIds).map((id) => {
                  const m = members.find((mem) => mem.id === id);
                  if (!m) return null;
                  return (
                    <div key={id} className="flex items-center justify-between text-xs">
                      <span className="font-medium">{m.full_name}</span>
                      <span className="text-muted-foreground">{m.email}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Diese Aktion kann über den Aktivieren-Button rückgängig gemacht werden.
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setBulkConfirmOpen(false)}
                  disabled={bulkDeactivating}
                >
                  Abbrechen
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDeactivate}
                  disabled={bulkDeactivating}
                >
                  {bulkDeactivating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UserX className="h-4 w-4 mr-2" />
                  )}
                  {selectedIds.size} deaktivieren
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invite Dialog */}
      {showInviteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Neues Mitglied einladen</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <Label htmlFor="invite_name">Name</Label>
                  <Input
                    id="invite_name"
                    value={inviteForm.full_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                    placeholder="Vollständiger Name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="invite_email">E-Mail</Label>
                  <Input
                    id="invite_email"
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="email@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="invite_role">Rolle</Label>
                  <Select
                    value={inviteForm.role}
                    onValueChange={(v) =>
                      setInviteForm({
                        ...inviteForm,
                        role: v as 'member' | 'trainer' | 'admin',
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Mitglied</SelectItem>
                      <SelectItem value="trainer">Trainer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={inviteLoading}>
                    {inviteLoading ? 'Wird gesendet...' : 'Einladen'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowInviteDialog(false);
                      setInviteForm({ email: '', full_name: '', role: 'member' });
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
