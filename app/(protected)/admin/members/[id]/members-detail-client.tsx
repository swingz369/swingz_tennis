'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { toast } from 'sonner';
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Check,
  X,
  Phone,
  MapPin,
  Shield,
  FileText,
  Save,
  Edit,
  AlertCircle,
  Target,
} from 'lucide-react';
import { PreferencesTab } from './preferences-tab';
import type { Member } from '../member.types';
import { apiFetch } from '@/lib/api-fetch';

interface Props {
  initialMember: Member;
  clubId: string;
}

interface BookingData {
  id: string;
  session_start: string | null;
  session_end: string | null;
  trainer_name: string | null;
  booked_at: string | null;
  status: string;
}

export function MembersDetailClient({ initialMember, clubId }: Props) {
  const router = useRouter();
  const [member, setMember] = useState<Member>(initialMember);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    date_of_birth: '',
    bio: '',
    emergency_contact: '',
    emergency_phone: '',
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

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/bookings?memberId=${member.id}&clubId=${clubId}`);
      if (res.ok) {
        const data = await res.json();
        setBookings(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    } finally {
      setLoading(false);
    }
  }, [member.id, clubId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleRoleChange = async (newRole: Member['role']) => {
    try {
      const res = await apiFetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler bei Rollenänderung');
      }

      setMember((prev) => ({ ...prev, role: newRole }));
      toast.success(`Rolle geändert zu ${newRole}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler';
      toast.error(message);
    }
  };

  const handleToggleActive = async () => {
    try {
      const res = await apiFetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !member.is_active }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler');
      }

      setMember((prev) => ({ ...prev, is_active: !prev.is_active }));
      toast.success(`Mitglied ${member.is_active ? 'deaktiviert' : 'aktiviert'}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler';
      toast.error(message);
    }
  };

  const handleSaveProfile = async () => {
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

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Speichern');
      }

      setMember((prev) => ({
        ...prev,
        phone: editForm.phone || null,
        address: editForm.address || null,
        city: editForm.city || null,
        postal_code: editForm.postal_code || null,
        date_of_birth: editForm.date_of_birth || null,
        bio: editForm.bio || null,
        emergency_contact: editForm.emergency_contact || null,
        emergency_phone: editForm.emergency_phone || null,
      }));

      setIsEditing(false);
      toast.success('Profil erfolgreich aktualisiert');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler';
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

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">Mitgliedsdetails</h1>
            <p className="text-muted-foreground text-sm">Verwaltung von {member.full_name}</p>
          </div>
        </div>
        <Button
          variant={isEditing ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            if (isEditing) {
              handleSaveProfile();
            } else {
              setIsEditing(true);
            }
          }}
          className="gap-2"
        >
          {isEditing ? (
            <>
              <Save className="h-4 w-4" />
              Speichern
            </>
          ) : (
            <>
              <Edit className="h-4 w-4" />
              Bearbeiten
            </>
          )}
        </Button>
      </div>

      {isEditing && (
        <div className="flex items-center gap-2 px-4 py-2 bg-brandAccent/5 border border-brandAccent/20 rounded-xl text-sm text-brandAccent">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Bearbeitungsmodus aktiv — Änderungen werden erst nach Klick auf &quot;Speichern&quot;
            übernommen.
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs"
            onClick={() => {
              setIsEditing(false);
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
            }}
          >
            Abbrechen
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Profile Card (left sidebar) ─────────────────────────────────── */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brandPrimary/20 to-brandPrimary/5 flex items-center justify-center shrink-0 shadow-sm">
                <User className="h-8 w-8 text-brandPrimary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg truncate">{member.full_name}</CardTitle>
                <CardDescription className="truncate">{member.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{member.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Beigetreten: {formatDate(member.joined_at)}</span>
            </div>
            {member.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{member.phone}</span>
              </div>
            )}

            <div className="pt-4 space-y-3 border-t border-border dark:border-white/10">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Rolle</Label>
                <Select value={member.role} onValueChange={handleRoleChange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Mitglied</SelectItem>
                    <SelectItem value="trainer">Trainer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Status</Label>
                <Button
                  variant={member.is_active ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleToggleActive}
                >
                  {member.is_active ? (
                    <>
                      <Check className="h-4 w-4 mr-1" /> Aktiv
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-1" /> Inaktiv
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Main Content (right area) ──────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Persönliche Informationen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-brandPrimary" />
                Persönliche Informationen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <div className="font-medium">{member.full_name}</div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">E-Mail</Label>
                  <div className="font-medium">{member.email}</div>
                </div>
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
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

          {/* Adresse */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-brandAccent" />
                Adresse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2 space-y-1.5">
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
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Postleitzahl</Label>
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
                <div className="space-y-1.5">
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

          {/* Notfallkontakt */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-brandAccent" />
                Notfallkontakt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Telefon</Label>
                  {isEditing ? (
                    <Input
                      value={editForm.emergency_phone}
                      onChange={(e) =>
                        setEditForm({ ...editForm, emergency_phone: e.target.value })
                      }
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
                <FileText className="h-4 w-4 text-brandPrimary" />
                Über das Mitglied
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Kurzbeschreibung des Mitglieds..."
                  rows={3}
                  className="resize-none"
                />
              ) : (
                <div className="text-sm text-foreground dark:text-foreground">
                  {member.bio || 'Keine Bio vorhanden'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trainings-Präferenzen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-brandPrimary" />
                Trainings-Präferenzen
              </CardTitle>
              <CardDescription>
                Verfügbarkeiten und Wünsche für die Trainingsplanung
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PreferencesTab userId={member.user_id} clubId={clubId} />
            </CardContent>
          </Card>

          {/* Buchungen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-brandPrimary" />
                Buchungen
              </CardTitle>
              <CardDescription>Alle Trainingsbuchungen dieses Mitglieds</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Laden...</div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Noch keine Buchungen
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum/Uhrzeit</TableHead>
                      <TableHead>Trainer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Gebucht am</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          {b.session_start
                            ? new Date(b.session_start).toLocaleString('de-DE')
                            : '-'}
                        </TableCell>
                        <TableCell>{b.trainer_name || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              b.status === 'confirmed'
                                ? 'bg-green-100 text-green-700'
                                : b.status === 'cancelled'
                                  ? 'bg-red-100 text-red-700'
                                  : b.status === 'no_show'
                                    ? 'bg-muted text-foreground'
                                    : 'bg-yellow-100 text-yellow-700'
                            }
                          >
                            {b.status === 'confirmed'
                              ? 'Bestätigt'
                              : b.status === 'cancelled'
                                ? 'Storniert'
                                : b.status === 'no_show'
                                  ? 'Nicht erschienen'
                                  : 'Ausstehend'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {b.booked_at ? formatDate(b.booked_at) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
