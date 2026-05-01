'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, UserCheck, UserX, Search, Download, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { exportMembersCSV } from '@/lib/csv-export';
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

  const handleToggleActive = async (memberId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
      setMembers((prev) => [...prev, data.member]);
      setShowInviteDialog(false);
      setInviteForm({ email: '', full_name: '', role: 'member' });
      toast.success('Mitglied erfolgreich eingeladen');
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
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500"
        >
          <option value="all">Alle Rollen</option>
          <option value="member">Mitglied</option>
          <option value="trainer">Trainer</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500"
        >
          <option value="all">Alle Status</option>
          <option value="active">Aktiv</option>
          <option value="inactive">Inaktiv</option>
        </select>
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
      <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  E-Mail
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Rolle
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">
                  Beigetreten
                </th>
                <th className="px-4 md:px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 md:px-6 py-8 text-center text-gray-500">
                    Keine Mitglieder gefunden
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{member.full_name}</span>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-gray-600 text-sm">
                      {member.email}
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
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {member.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-gray-600 hidden md:table-cell">
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

      {/* Stats */}
      <div className="text-sm text-gray-500">
        {filteredMembers.length} von {members.length} Mitgliedern angezeigt
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
                  <select
                    id="invite_role"
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        role: e.target.value as 'member' | 'trainer' | 'admin',
                      })
                    }
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500"
                  >
                    <option value="member">Mitglied</option>
                    <option value="trainer">Trainer</option>
                    <option value="admin">Admin</option>
                  </select>
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
