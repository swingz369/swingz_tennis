'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';
import { formatMemberNumber } from '@/lib/format';

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
  UserPlus,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
  Loader2,
  Users,
  ClipboardCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { showInviteResult } from '@/lib/invite-feedback';
import type { Member } from './member.types';
import type { PaginationMeta } from '@/lib/pagination';
import { PaginationNav } from '@/components/ui/pagination-nav';
import { apiFetch } from '@/lib/api-fetch';
import { createLogger } from '@/lib/logger';
import { PageHeader } from '@/components/ui/page-header';
import { NoMembersBrandedEmptyState, NoSearchResultsEmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { CenteredModal } from '@/components/ui/centered-modal';
import { BulkActionBar } from '@/components/ui/bulk-action-bar';
import { QuickEmailDialog } from '@/components/admin/quick-email-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminApprovals from '@/components/admin-approvals';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const log = createLogger('members-client');

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
  const handlePageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', '1');
    params.set('limit', String(size));
    router.push(`?${params.toString()}`);
  };
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [emailDialogMember, setEmailDialogMember] = useState<Member | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tabs: Mitgliederliste vs. Genehmigungen (Beitrittsanfragen). Der
  // ?tab=approvals-Parameter bleibt erhalten, damit Deep-Links funktionieren.
  const [activeTab, setActiveTab] = useState<'members' | 'approvals'>(
    searchParams.get('tab') === 'approvals' ? 'approvals' : 'members'
  );
  const [approvalCount, setApprovalCount] = useState(0);

  // Sync members when server re-renders with new page data (pagination fix)
  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') ?? '');

  // Sync searchQuery when URL params change (e.g. back/forward navigation)
  useEffect(() => {
    setSearchQuery(searchParams.get('search') ?? '');
  }, [searchParams]);

  // Anzahl offener Beitrittsanfragen für den Badge am Genehmigungen-Tab.
  useEffect(() => {
    const controller = new AbortController();
    apiFetch('/api/admin/approvals/count', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setApprovalCount(data?.count ?? 0))
      .catch((err) => {
        // Der Abbruch beim Unmount ist der Normalfall, kein Fehler: React
        // führt die Cleanup-Funktion bei jedem Verlassen der Seite (und im
        // Strict Mode direkt nach dem ersten Lauf) aus. Das landete bisher als
        // `AbortError` in der Konsole und im Dev-Overlay — gemeldet wurde ein
        // Fehler, passiert ist nichts.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        log.error(
          'Anzahl offener Beitrittsanfragen konnte nicht geladen werden',
          err instanceof Error ? err : undefined
        );
      });
    return () => controller.abort();
  }, []);
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

  // Echte Leere (keine Mitglieder, keine aktiven Filter) → Branded-State mit
  // Einlade-Aktion; sonst Filter-/Such-Empty. Gleiche Trennung wie im Trainer
  // (NoTrainersBrandedEmptyState vs. „Keine Treffer").
  const hasActiveFilters =
    !!searchQuery || roleFilter !== 'all' || statusFilter !== 'all' || planningFilter !== 'all';

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
        throw new Error(extractErrorMessage(err) || 'Failed to update membership');
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
        throw new Error(extractErrorMessage(err) || 'Failed to update membership');
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
        throw new Error(extractErrorMessage(err) || 'Einladung fehlgeschlagen');
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
      showInviteResult(data, 'Mitglied erfolgreich eingeladen');
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
    <div className="pt-4 md:pt-6 space-y-4 md:space-y-6">
      <PageHeader
        title="Mitgliederverwaltung"
        description="Verwalte deine Vereinsmitglieder"
        actions={[
          {
            label: 'Mitglied einladen',
            icon: UserPlus,
            onClick: () => setShowInviteDialog(true),
          },
        ]}
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'members' | 'approvals')}
        className="space-y-4 md:space-y-6"
      >
        <TabsList>
          <TabsTrigger value="members">
            <Users className="h-4 w-4 mr-2" />
            Alle Mitglieder
          </TabsTrigger>
          <TabsTrigger value="approvals">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Genehmigungen
            {approvalCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-2xs font-semibold bg-primary text-white">
                {approvalCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4 md:space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suche nach Name, E-Mail oder Nr...."
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

          {/* Werkzeugleiste: Ansichtsumschalter. (CSV-Import liegt in den
              Vereinseinstellungen.) */}
          <div className="flex justify-end gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
                  title={viewMode === 'table' ? 'Kartenansicht' : 'Tabellenansicht'}
                  aria-label={viewMode === 'table' ? 'Kartenansicht' : 'Tabellenansicht'}
                >
                  {viewMode === 'table' ? (
                    <LayoutGrid className="h-4 w-4" />
                  ) : (
                    <List className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {viewMode === 'table' ? 'Kartenansicht' : 'Tabellenansicht'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Members Table / Grid */}
          {viewMode === 'table' ? (
            <div className="rounded-md border border-border dark:border-white/10 bg-background dark:bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected || (someSelected ? 'indeterminate' : false)}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Alle auswählen"
                      />
                    </TableHead>
                    <TableHead
                      className="text-center"
                      title="Wird das Mitglied bei der Saison-/Stundenplanung berücksichtigt?"
                    >
                      Planung
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">Nr.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead className="hidden lg:table-cell">Telefon</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Beigetreten</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        {hasActiveFilters ? (
                          <NoSearchResultsEmptyState searchTerm={searchQuery || undefined} />
                        ) : (
                          <NoMembersBrandedEmptyState onInvite={() => setShowInviteDialog(true)} />
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="w-10">
                          <Checkbox
                            checked={selectedIds.has(member.id)}
                            onCheckedChange={() => toggleSelect(member.id)}
                            aria-label={`${member.full_name} auswählen`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
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
                                <CheckSquare className="h-4 w-4 text-success-600" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground tabular-nums">
                          {formatMemberNumber(member.member_number)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="font-medium text-foreground dark:text-white">
                            {member.full_name}
                          </span>
                          {member.is_honorary && (
                            <span className="ml-1.5 inline-flex items-center rounded-full bg-warning-100 px-1.5 py-0.5 text-2xs font-medium text-warning-700">
                              Ehren
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                          <button
                            type="button"
                            onClick={() => setEmailDialogMember(member)}
                            className="hover:underline hover:text-foreground"
                            title="E-Mail senden"
                          >
                            {member.email}
                          </button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-sm hidden lg:table-cell">
                          {member.phone || '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <StatusBadge
                            status={member.is_active ? 'active' : 'inactive'}
                            size="sm"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground hidden md:table-cell">
                          {formatDate(member.joined_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <div className="flex justify-end gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Details"
                                  aria-label="Details"
                                  asChild
                                >
                                  <Link href={`/admin/members/${member.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Details</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={member.is_active ? 'Deaktivieren' : 'Aktivieren'}
                                  aria-label={member.is_active ? 'Deaktivieren' : 'Aktivieren'}
                                  onClick={() => handleToggleActive(member.id, member.is_active)}
                                >
                                  {member.is_active ? (
                                    <UserX className="h-4 w-4 text-brand-accent-600" />
                                  ) : (
                                    <UserCheck className="h-4 w-4 text-success-600" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {member.is_active ? 'Deaktivieren' : 'Aktivieren'}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredMembers.length === 0 ? (
                <div className="col-span-full">
                  {hasActiveFilters ? (
                    <NoSearchResultsEmptyState searchTerm={searchQuery || undefined} />
                  ) : (
                    <NoMembersBrandedEmptyState onInvite={() => setShowInviteDialog(true)} />
                  )}
                </div>
              ) : (
                paginatedMembers.map((member) => {
                  const isSelected = selectedIds.has(member.id);
                  return (
                    <Card
                      key={member.id}
                      className={`hover:shadow-md transition-all border-border dark:border-white/10 ${
                        isSelected
                          ? 'ring-2 ring-primary border-primary bg-primary/5 dark:bg-primary/10'
                          : ''
                      }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-semibold truncate">
                              {member.full_name}
                            </CardTitle>
                            <button
                              type="button"
                              onClick={() => setEmailDialogMember(member)}
                              className="text-xs text-muted-foreground dark:text-muted-foreground truncate mt-0.5 hover:underline text-left"
                              title="E-Mail senden"
                            >
                              {member.email}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(member.id)}
                              aria-label={`${member.full_name} auswählen`}
                              className="translate-y-0.5"
                            />
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
                                  <CheckSquare className="h-4 w-4 text-success-600" />
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
                          <StatusBadge
                            status={member.is_active ? 'active' : 'inactive'}
                            size="sm"
                          />
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
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Details"
                                aria-label="Details"
                                asChild
                              >
                                <Link href={`/admin/members/${member.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Details</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title={member.is_active ? 'Deaktivieren' : 'Aktivieren'}
                                aria-label={member.is_active ? 'Deaktivieren' : 'Aktivieren'}
                                onClick={() => handleToggleActive(member.id, member.is_active)}
                              >
                                {member.is_active ? (
                                  <UserX className="h-4 w-4 text-brand-accent-600" />
                                ) : (
                                  <UserCheck className="h-4 w-4 text-success-600" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {member.is_active ? 'Deaktivieren' : 'Aktivieren'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {/* Server-side Pagination */}
          {pagination.totalCount > 0 && (
            <PaginationNav
              meta={pagination}
              buildUrl={buildPageUrl}
              compact
              pageSizeOptions={[10, 25, 50, 'all']}
              currentLimit={pagination.limit}
              onPageSizeChange={handlePageSizeChange}
            />
          )}

          {/* Bulk Selection Action Bar */}
          {selectedIds.size > 0 && (
            <BulkActionBar
              selectionLabel={`${selectedIds.size} Mitglied${selectedIds.size !== 1 ? 'er' : ''} ausgewählt`}
              onClear={() => setSelectedIds(new Set())}
              destructiveLabel={bulkDeactivating ? 'Wird deaktiviert…' : 'Ausgewählte deaktivieren'}
              onDestructive={() => setBulkConfirmOpen(true)}
              destructiveLoading={bulkDeactivating}
              onSelectAll={
                !allSelected && filteredMembers.length > selectedIds.size
                  ? toggleSelectAll
                  : undefined
              }
            />
          )}

          {/* Bulk Deactivate Confirmation Dialog */}
          <CenteredModal
            open={bulkConfirmOpen}
            onClose={() => (bulkDeactivating ? undefined : setBulkConfirmOpen(false))}
            ariaLabel={`${selectedIds.size} Mitglied${selectedIds.size !== 1 ? 'er' : ''} deaktivieren`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {selectedIds.size} Mitglied{selectedIds.size !== 1 ? 'er' : ''} deaktivieren?
              </h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setBulkConfirmOpen(false)}
                    disabled={bulkDeactivating}
                    aria-label="Schließen"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Schließen</TooltipContent>
              </Tooltip>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Folgende Mitglieder werden deaktiviert und verlieren den Zugang zum Vereinsportal:
            </p>
            <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/50 p-2 space-y-1 mt-3">
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
            <p className="text-xs text-muted-foreground mt-3">
              Diese Aktion kann über den Aktivieren-Button rückgängig gemacht werden.
            </p>
            <div className="flex gap-2 justify-end mt-4">
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
                leftIcon={
                  bulkDeactivating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserX className="h-4 w-4" />
                  )
                }
              >
                {selectedIds.size} deaktivieren
              </Button>
            </div>
          </CenteredModal>
        </TabsContent>

        <TabsContent value="approvals">
          <AdminApprovals />
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <CenteredModal
        open={showInviteDialog}
        onClose={() => {
          setShowInviteDialog(false);
          setInviteForm({ email: '', full_name: '', role: 'member' });
        }}
        ariaLabel="Neues Mitglied einladen"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Neues Mitglied einladen</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setShowInviteDialog(false);
                  setInviteForm({ email: '', full_name: '', role: 'member' });
                }}
                aria-label="Schließen"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Schließen</TooltipContent>
          </Tooltip>
        </div>
        <form onSubmit={handleInvite} className="space-y-4 mt-4">
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
      </CenteredModal>

      {emailDialogMember && (
        <QuickEmailDialog
          userId={emailDialogMember.user_id}
          recipientName={emailDialogMember.full_name}
          recipientEmail={emailDialogMember.email}
          open={!!emailDialogMember}
          onOpenChange={(open) => !open && setEmailDialogMember(null)}
        />
      )}
    </div>
  );
}
