'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Plus, UserPlus, ExternalLink, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { PageHeader } from '@/components/ui/page-header';

interface Club {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  maxMembers: number;
}

export default function OwnerClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  useEffect(() => {
    apiFetch('/api/clubs')
      .then((r) => r.json())
      .then((d) => setClubs(d.clubs ?? []))
      .catch(() => toast.error('Vereine konnten nicht geladen werden'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clubs.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

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
        toast.error(data.error ?? 'Fehler');
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
        toast.error(data.error ?? 'Fehler');
        return;
      }
      toast.success(`Einladung an ${inviteEmail} verschickt`);
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

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Verein suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Lade Vereine...</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((club) => (
            <Card key={club.id} className="border shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info-50 dark:bg-info-900/20 shrink-0">
                  <Building2 className="h-5 w-5 text-info-600 dark:text-info-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{club.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {club.memberCount} / {club.maxMembers} Mitglieder
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {club.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1 text-xs h-7 bg-warning-500 hover:bg-warning-600"
                      disabled={activating === club.id}
                      onClick={() => handleActivateClub(club.id)}
                    >
                      {activating === club.id ? '...' : 'Freigeben'}
                    </Button>
                  )}
                  {club.status !== 'active' && club.status !== 'pending' && (
                    <Badge variant="secondary">{club.status}</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs h-7"
                    onClick={() => {
                      setInviteClubId(club.id);
                      setInviteClubName(club.name);
                      setInviteOpen(true);
                    }}
                  >
                    <UserPlus className="h-3 w-3" /> Admin einladen
                  </Button>
                  <Link
                    href={`/api/admin/switch-club-redirect?clubId=${club.id}`}
                    className="inline-flex items-center gap-1 text-xs text-info-600 dark:text-info-400 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Als Admin
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Keine Vereine gefunden.
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
    </div>
  );
}
