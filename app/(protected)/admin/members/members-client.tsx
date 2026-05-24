'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
import {
  Eye,
  UserCheck,
  UserX,
  Search,
  Download,
  UserPlus,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { exportMembersCSV } from '@/lib/csv-export';
import { csrfHeaders } from '@/lib/csrf-client';
import type { Member } from './member.types';

interface MembersClientProps {
  initialMembers: Member[];
  clubId: string;
}

export function MembersClient({ initialMembers, clubId }: MembersClientProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    role: 'member' as 'member' | 'trainer' | 'admin',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  // Filter members
  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' || (statusFilter === 'active' ? member.is_active : !member.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMembers = filteredMembers.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleTogglePlanning = async (memberId: string, currentValue: boolean) => {
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
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
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
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

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'trainer':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'superadmin':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    try {
      const res = await fetch('/api/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({
          ...inviteForm,
          club_id: clubId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
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

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-brand-primary dark:text-white">
            Mitgliederverwaltung
          </h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Suche nach Name oder E-Mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Rollen</SelectItem>
            <SelectItem value="member">Mitglied</SelectItem>
            <SelectItem value="trainer">Trainer</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="inactive">Inaktiv</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
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

      {/* Members Table */}
      <div className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-2 md:px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Planung
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  E-Mail
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Telefon
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Rolle
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                  Beigetreten
                </th>
                <th className="px-4 md:px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 md:px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    Keine Mitglieder gefunden
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
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
                            <Square className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {member.full_name}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400 text-sm">
                      {member.email}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400 text-sm hidden lg:table-cell">
                      {member.phone || '—'}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeClass(member.role)}`}
                      >
                        {member.role === 'member'
                          ? 'Mitglied'
                          : member.role === 'trainer'
                            ? 'Trainer'
                            : member.role}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          member.is_active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {member.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400 hidden md:table-cell">
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

      {/* Pagination */}
      {filteredMembers.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Zeige</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[80px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span>von {filteredMembers.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={safePage <= 1}
              aria-label="Vorherige Seite"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm text-gray-600 dark:text-gray-400 min-w-[80px] text-center">
              Seite {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={safePage >= totalPages}
              aria-label="Nächste Seite"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {filteredMembers.length > 0
          ? `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filteredMembers.length)} von ${filteredMembers.length}`
          : `0 von ${members.length}`}{' '}
        Mitgliedern
        {(() => {
          const planned = members.filter(
            (m) => m.include_in_planning !== false && m.role === 'member'
          ).length;
          return planned > 0 ? ` · ${planned} für Saisonplanung` : '';
        })()}
      </div>

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
