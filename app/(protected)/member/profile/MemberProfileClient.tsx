'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Calendar,
  Phone,
  MapPin,
  Shield,
  FileText,
  Save,
  Edit,
  AlertCircle,
  Users,
  Copy,
  Plus,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

interface Member {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  include_in_planning: boolean;
  joined_at: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  date_of_birth: string | null;
  bio: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
}

interface FamilyMember {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  relationship: string;
  isSelf: boolean;
}

interface Props {
  member: Member;
}

export function MemberProfileClient({ member }: Props) {
  const [family, setFamily] = useState<{
    familyGroupId?: string;
    inviteCode?: string | null;
    members: FamilyMember[];
  } | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [familyLoading, setFamilyLoading] = useState(false);

  const reloadFamily = async () => {
    const r = await apiFetch('/api/family-accounts');
    setFamily(await r.json());
  };

  useEffect(() => {
    reloadFamily().catch(() => {});
  }, []);

  const createFamily = async () => {
    setFamilyLoading(true);
    const res = await apiFetch('/api/family-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const d = await res.json();
    if (d.inviteCode) {
      toast.success('Familie erstellt!');
      await reloadFamily();
    } else toast.error(d.error ?? 'Fehler');
    setFamilyLoading(false);
  };

  const joinFamily = async () => {
    if (!inviteCode.trim()) return;
    setFamilyLoading(true);
    const res = await apiFetch('/api/family-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode }),
    });
    const d = await res.json();
    if (d.success) {
      toast.success('Familie beigetreten!');
      setInviteCode('');
      await reloadFamily();
    } else toast.error(d.error ?? 'Fehler');
    setFamilyLoading(false);
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: member.phone || '',
    address: member.address || '',
    city: member.city || '',
    postal_code: member.postal_code || '',
    date_of_birth: member.date_of_birth || '',
    bio: member.bio || '',
    emergency_contact: member.emergency_contact || '',
    emergency_phone: member.emergency_phone || '',
  });

  useEffect(() => {
    setEditForm({
      phone: member.phone || '',
      address: member.address || '',
      city: member.city || '',
      postal_code: member.postal_code || '',
      date_of_birth: member.date_of_birth || '',
      bio: member.bio || '',
      emergency_contact: member.emergency_contact || '',
      emergency_phone: member.emergency_phone || '',
    });
  }, [member]);

  const handleSave = async () => {
    try {
      const res = await apiFetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: editForm.phone || null,
          address: editForm.address || null,
          city: editForm.city || null,
          postalCode: editForm.postal_code || null,
          dateOfBirth: editForm.date_of_birth || null,
          bio: editForm.bio || null,
          emergencyContact: editForm.emergency_contact || null,
          emergencyPhone: editForm.emergency_phone || null,
        }),
      });

      if (!res.ok) throw new Error('Fehler beim Speichern');

      setIsEditing(false);
      toast.success('Profil aktualisiert');
    } catch {
      toast.error('Fehler beim Speichern');
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Mein Profil</h1>
          <p className="text-sm text-muted-foreground">Verwalte deine persönlichen Daten</p>
        </div>
        <Button
          variant={isEditing ? 'default' : 'outline'}
          size="sm"
          onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          className="gap-2"
        >
          {isEditing ? (
            <>
              <Save className="h-4 w-4" /> Speichern
            </>
          ) : (
            <>
              <Edit className="h-4 w-4" /> Bearbeiten
            </>
          )}
        </Button>
      </div>

      {isEditing && (
        <div className="flex items-center gap-2 px-4 py-2 bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 rounded-xl text-sm text-info-700 dark:text-info-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Bearbeitungsmodus aktiv
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs"
            onClick={() => setIsEditing(false)}
          >
            Abbrechen
          </Button>
        </div>
      )}

      <div className="grid gap-6">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-info-50 dark:bg-info-900/20 flex items-center justify-center">
                <User className="h-8 w-8 text-info-600 dark:text-info-400" />
              </div>
              <div>
                <CardTitle>{member.full_name}</CardTitle>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {member.email}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Mitglied seit: {formatDate(member.joined_at)}
            </div>
            {member.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {member.phone}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Persönliche Informationen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Telefon</Label>
                {isEditing ? (
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+49 123 456 7890"
                  />
                ) : (
                  <div className="font-medium">{member.phone || '—'}</div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Geburtsdatum</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={editForm.date_of_birth}
                    onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                  />
                ) : (
                  <div className="font-medium">
                    {member.date_of_birth ? formatDate(member.date_of_birth) : '—'}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Adresse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground">Straße & Hausnummer</Label>
                {isEditing ? (
                  <Input
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    placeholder="Musterstraße 123"
                  />
                ) : (
                  <div className="font-medium">{member.address || '—'}</div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">PLZ</Label>
                {isEditing ? (
                  <Input
                    value={editForm.postal_code}
                    onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
                    placeholder="12345"
                  />
                ) : (
                  <div className="font-medium">{member.postal_code || '—'}</div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Stadt</Label>
                {isEditing ? (
                  <Input
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    placeholder="Musterstadt"
                  />
                ) : (
                  <div className="font-medium">{member.city || '—'}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" /> Notfallkontakt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Name</Label>
                {isEditing ? (
                  <Input
                    value={editForm.emergency_contact}
                    onChange={(e) =>
                      setEditForm({ ...editForm, emergency_contact: e.target.value })
                    }
                    placeholder="Max Mustermann"
                  />
                ) : (
                  <div className="font-medium">{member.emergency_contact || '—'}</div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Telefon</Label>
                {isEditing ? (
                  <Input
                    value={editForm.emergency_phone}
                    onChange={(e) => setEditForm({ ...editForm, emergency_phone: e.target.value })}
                    placeholder="+49 123 456 7890"
                  />
                ) : (
                  <div className="font-medium">{member.emergency_phone || '—'}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Über mich
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                placeholder="Erzähle etwas über dich..."
                rows={3}
              />
            ) : (
              <div className="text-sm text-muted-foreground">{member.bio || 'Noch keine Bio'}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Familienkonto ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-brand-light" />
            Familienkonto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!family?.familyGroupId ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Verknüpfe dein Konto mit Familienmitgliedern (z.B. Kinder).
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="primary" size="sm" onClick={createFamily} disabled={familyLoading}>
                  <Plus className="h-4 w-4 mr-1" /> Familie erstellen
                </Button>
                <div className="flex gap-2 flex-1">
                  <input
                    className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm bg-background"
                    placeholder="Einladungscode eingeben"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={joinFamily}
                    disabled={familyLoading || !inviteCode.trim()}
                  >
                    Beitreten
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {(() => {
                const isParent = family.members.find((m) => m.isSelf)?.role === 'parent';
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Einladungscode:</span>
                    {family.inviteCode ? (
                      <>
                        <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          {family.inviteCode}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(family.inviteCode ?? '');
                            toast.success('Code kopiert');
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : isParent ? (
                      <span className="text-xs text-muted-foreground">Code bereits verwendet</span>
                    ) : null}
                    {isParent && (
                      <button
                        onClick={async () => {
                          setFamilyLoading(true);
                          const res = await apiFetch('/api/family-accounts', { method: 'PUT' });
                          const d = await res.json();
                          if (d.inviteCode) {
                            toast.success('Neuer Code generiert');
                            await reloadFamily();
                          } else toast.error(d.error ?? 'Fehler');
                          setFamilyLoading(false);
                        }}
                        disabled={familyLoading}
                        className="text-xs text-brand-primary hover:underline disabled:opacity-50"
                      >
                        Neuen Code generieren
                      </button>
                    )}
                  </div>
                );
              })()}
              <div className="space-y-2">
                {(family.members ?? []).map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.role === 'parent'
                          ? 'Elternteil'
                          : m.role === 'child'
                            ? 'Kind'
                            : 'Mitglied'}
                        {m.isSelf ? ' (du)' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
