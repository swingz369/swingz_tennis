'use client';

import { useState, useEffect, useCallback } from 'react';
import { CenteredModal } from '@/components/ui/centered-modal';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Skeleton } from '@/components/ui/skeleton';
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
  Save,
  Edit,
  AlertCircle,
  Target,
  ChevronRight,
  Euro,
  UserX,
} from 'lucide-react';
import { PreferencesTab } from './preferences-tab';
import { InvoicesTab } from './invoices-tab';
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

interface AbsenceData {
  id: string;
  session_start_time: string | null;
  booked_at: string | null;
}

interface AbsenceSummary {
  noShowCount: number;
  noShows: AbsenceData[];
  lookbackDays: number;
}

export function MembersDetailClient({ initialMember, clubId }: Props) {
  const [member, setMember] = useState<Member>(initialMember);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [absences, setAbsences] = useState<AbsenceSummary | null>(null);
  const [absencesLoading, setAbsencesLoading] = useState(false);
  const [notifyingTrainer, setNotifyingTrainer] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | {
    type: 'deactivate' | 'activate' | 'role';
    newRole?: Member['role'];
  }>(null);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelForm, setCancelForm] = useState({
    cancellation_date: '',
    reason: '',
    send_confirmation: true,
  });
  const [cancelLoading, setCancelLoading] = useState(false);
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
    } catch {
      // stille Fehlerbehandlung
    } finally {
      setLoading(false);
    }
  }, [member.id, clubId]);

  const fetchAbsences = useCallback(async () => {
    setAbsencesLoading(true);
    try {
      const res = await apiFetch(`/api/admin/members/${member.user_id}/absences?clubId=${clubId}`);
      if (res.ok) {
        const data = await res.json();
        setAbsences(data);
      }
    } catch {
      // stille Fehlerbehandlung
    } finally {
      setAbsencesLoading(false);
    }
  }, [member.user_id, clubId]);

  const handleNotifyTrainer = async () => {
    setNotifyingTrainer(true);
    try {
      const res = await apiFetch(`/api/admin/members/${member.user_id}/absences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Benachrichtigung fehlgeschlagen');
      }
      const data = await res.json();
      toast.success(
        data.notifiedTrainers?.length > 0
          ? `${data.notifiedTrainers.length} Trainer benachrichtigt`
          : 'Keine Trainer gefunden'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setNotifyingTrainer(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleRoleChange = async (newRole: Member['role']) => {
    // Require confirmation when promoting to admin
    if (newRole === 'admin' && member.role !== 'admin') {
      setConfirmAction({ type: 'role', newRole });
      return;
    }
    await executeRoleChange(newRole);
  };

  const executeRoleChange = async (newRole: Member['role']) => {
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
    } finally {
      setConfirmAction(null);
    }
  };

  const handleToggleActive = async () => {
    // Require confirmation when deactivating
    if (member.is_active) {
      setConfirmAction({ type: 'deactivate' });
      return;
    }
    await executeToggleActive();
  };

  const executeToggleActive = async () => {
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
    } finally {
      setConfirmAction(null);
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

  const handleCancelMembership = async () => {
    if (!cancelForm.cancellation_date) {
      toast.error('Bitte Kündigungsdatum angeben');
      return;
    }
    setCancelLoading(true);
    try {
      const res = await apiFetch(`/api/members/${member.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancellation_date: cancelForm.cancellation_date,
          reason: cancelForm.reason || undefined,
          send_confirmation: cancelForm.send_confirmation,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Kündigung fehlgeschlagen');
      }
      const d = await res.json();
      toast.success(
        d.deactivated_immediately
          ? 'Mitgliedschaft wurde gekündigt und sofort deaktiviert'
          : `Kündigung zum ${new Date(cancelForm.cancellation_date).toLocaleDateString('de-DE')} vermerkt`
      );
      if (d.deactivated_immediately) {
        setMember((prev) => ({ ...prev, is_active: false }));
      }
      setCancelDialog(false);
      setCancelForm({ cancellation_date: '', reason: '', send_confirmation: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setCancelLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusVariant = (isActive: boolean): 'success' | 'secondary' => {
    return isActive ? 'success' : 'secondary';
  };

  const getStatusLabel = (isActive: boolean) => {
    return isActive ? 'Aktiv' : 'Inaktiv';
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'trainer':
        return 'Trainer';
      case 'superadmin':
        return 'Superadmin';
      default:
        return 'Mitglied';
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in">
      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <nav className="mb-4 flex items-center gap-1.5 text-sm">
        <Link
          href="/admin/members"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-brand-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Mitglieder
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
        <span className="font-medium text-foreground truncate">{member.full_name}</span>
      </nav>

      <div className="bg-background dark:bg-surface-dark rounded-2xl border border-border dark:border-white/10 shadow-sm overflow-hidden animate-in">
        {/* ── Detail Header ────────────────────────────────────────────── */}
        <div className="p-5 border-b border-border dark:border-white/10 bg-gradient-to-r from-brandPrimary/5 to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brandPrimary/20 to-brandPrimary/5 flex items-center justify-center shrink-0">
                <User className="h-6 w-6 text-brandPrimary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-bold text-foreground dark:text-white truncate">
                  {member.full_name}
                </h2>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground truncate">
                  {member.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Badge variant={getStatusVariant(member.is_active)} size="lg">
                {getStatusLabel(member.is_active)}
              </Badge>
              <Badge variant="secondary" size="lg">
                {getRoleLabel(member.role)}
              </Badge>
              {!isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="primary"
                  size="sm"
                  className="gap-1.5"
                >
                  <Edit className="h-4 w-4" />
                  Bearbeiten
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Editing Banner ──────────────────────────────────────────── */}
        {isEditing && (
          <div className="flex items-center gap-2 px-5 py-2 bg-brandAccent/5 border-b border-brandAccent/20 text-sm text-brandAccent">
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

        {/* ── Detail Body ──────────────────────────────────────────────── */}
        <div className="p-5">
          <Tabs defaultValue="profile" className="space-y-5">
            <TabsList className="w-full justify-start bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b rounded-none px-0 gap-6 overflow-x-auto sticky top-0 z-20">
              <TabsTrigger
                value="profile"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Profil
              </TabsTrigger>
              <TabsTrigger
                value="preferences"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Präferenzen
              </TabsTrigger>
              <TabsTrigger
                value="invoices"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Rechnungen
              </TabsTrigger>
              <TabsTrigger
                value="bookings"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Buchungen
              </TabsTrigger>
              <TabsTrigger
                value="fehlzeiten"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
                onClick={fetchAbsences}
              >
                Fehlzeiten
              </TabsTrigger>
            </TabsList>

            {/* ── Profile Tab ──────────────────────────────────────────── */}
            <TabsContent value="profile" className="space-y-6 animate-in">
              {/* Role & Status Management */}
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                    <Shield className="h-4 w-4 text-brandPrimary" />
                    Rolle & Status
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Rolle</Label>
                      <Select value={member.role} onValueChange={handleRoleChange}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Mitglied</SelectItem>
                          <SelectItem value="trainer">Trainer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <div>
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
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Ehrenmitglied</Label>
                      <div>
                        <Button
                          variant={member.is_honorary ? 'default' : 'outline'}
                          size="sm"
                          onClick={async () => {
                            const newVal = !member.is_honorary;
                            const res = await apiFetch(`/api/admin/memberships/${member.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ is_honorary: newVal }),
                            });
                            if (!res.ok) {
                              toast.error('Fehler beim Speichern');
                              return;
                            }
                            setMember((prev) => ({ ...prev, is_honorary: newVal }));
                            toast.success(
                              newVal
                                ? 'Als Ehrenmitglied eingetragen'
                                : 'Ehrenmitglied-Status entfernt'
                            );
                          }}
                        >
                          {member.is_honorary ? '★ Ehrenmitglied' : 'Kein Ehrenmitglied'}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Beigetreten</Label>
                      <div className="font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(member.joined_at)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Personal Information */}
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-brandPrimary" />
                    Persönliche Informationen
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <div className="font-medium">{member.full_name}</div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">E-Mail</Label>
                      <div className="font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {member.email}
                      </div>
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
                        <div className="font-medium flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {member.phone || '—'}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Geburtsdatum</Label>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editForm.date_of_birth}
                          onChange={(e) =>
                            setEditForm({ ...editForm, date_of_birth: e.target.value })
                          }
                        />
                      ) : (
                        <div className="font-medium">
                          {member.date_of_birth ? formatDate(member.date_of_birth) : '—'}
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Bio</Label>
                      {isEditing ? (
                        <Textarea
                          value={editForm.bio}
                          onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                          placeholder="Kurzbeschreibung des Mitglieds..."
                          rows={3}
                          className="resize-none"
                        />
                      ) : (
                        <div className="text-foreground dark:text-foreground text-sm">
                          {member.bio || 'Keine Bio vorhanden'}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Address */}
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4 text-brandAccent" />
                    Adresse
                  </h3>
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
                          onChange={(e) =>
                            setEditForm({ ...editForm, postal_code: e.target.value })
                          }
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

              {/* Emergency Contact */}
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                    <Shield className="h-4 w-4 text-brandAccent" />
                    Notfallkontakt
                  </h3>
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
            </TabsContent>

            {/* ── Preferences Tab ──────────────────────────────────────── */}
            <TabsContent value="preferences" className="space-y-5 animate-in">
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-brandPrimary" />
                    Trainings-Präferenzen
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Verfügbarkeiten und Wünsche für die Trainingsplanung
                  </p>
                  <PreferencesTab userId={member.user_id} clubId={clubId} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Invoices Tab ─────────────────────────────────────────── */}
            <TabsContent value="invoices" className="space-y-5 animate-in">
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2 text-base">
                    <Euro className="h-4 w-4 text-brandPrimary" />
                    Rechnungen
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Alle Rechnungen dieses Mitglieds
                  </p>
                  <InvoicesTab userId={member.user_id} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Fehlzeiten Tab ───────────────────────────────────────── */}
            <TabsContent value="fehlzeiten" className="space-y-5 animate-in">
              <Card variant="bordered">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2 text-base">
                      <UserX className="h-4 w-4 text-destructive" />
                      Unentschuldigte Fehlzeiten (letzte 60 Tage)
                    </h3>
                    {absences && absences.noShowCount >= 3 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNotifyTrainer}
                        disabled={notifyingTrainer}
                        className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/5"
                      >
                        {notifyingTrainer ? 'Sende…' : 'Trainer benachrichtigen'}
                      </Button>
                    )}
                  </div>

                  {absencesLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : absences === null ? (
                    <p className="text-sm text-muted-foreground">
                      Klicke den Tab an um Fehlzeiten zu laden.
                    </p>
                  ) : absences.noShowCount === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Keine unentschuldigten Fehlzeiten in den letzten {absences.lookbackDays}{' '}
                      Tagen.
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 flex items-center gap-2">
                        <Badge variant={absences.noShowCount >= 3 ? 'error' : 'warning'} size="lg">
                          {absences.noShowCount}× nicht erschienen
                        </Badge>
                        {absences.noShowCount >= 3 && (
                          <span className="text-xs text-destructive font-medium">
                            Schwellenwert überschritten
                          </span>
                        )}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Trainingsdatum</TableHead>
                            <TableHead>Gebucht am</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {absences.noShows.map((a) => (
                            <TableRow key={a.id}>
                              <TableCell>
                                {a.session_start_time
                                  ? new Date(a.session_start_time).toLocaleString('de-DE')
                                  : '—'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {a.booked_at ? formatDate(a.booked_at) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Bookings Tab ─────────────────────────────────────────── */}
            <TabsContent value="bookings" className="space-y-5 animate-in">
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2 text-base">
                    <Calendar className="h-4 w-4 text-brandPrimary" />
                    Buchungen
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Alle Trainingsbuchungen dieses Mitglieds
                  </p>
                  {loading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-lg" />
                      ))}
                    </div>
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
                                variant={
                                  b.status === 'confirmed'
                                    ? 'success'
                                    : b.status === 'cancelled'
                                      ? 'error'
                                      : b.status === 'no_show'
                                        ? 'secondary'
                                        : 'warning'
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
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Detail Footer ─────────────────────────────────────────────── */}
        <div className="p-5 bg-muted dark:bg-black/10 border-t border-border dark:border-white/10 flex flex-col sm:flex-row gap-3 items-center justify-between">
          {isEditing ? (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
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
                className="flex-1 sm:flex-initial"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSaveProfile}
                variant="primary"
                className="flex-1 sm:flex-initial"
              >
                <Save className="h-4 w-4 mr-2" />
                Speichern
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 w-full sm:w-auto flex-wrap">
              {member.is_active ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleActive}
                  className="flex-1 sm:flex-initial"
                >
                  Deaktivieren
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleActive}
                  className="flex-1 sm:flex-initial"
                >
                  Aktivieren
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setCancelDialog(true)}
                className="flex-1 sm:flex-initial"
              >
                Mitgliedschaft kündigen
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Cancellation Dialog ──────────────────────────────────────── */}
      <CenteredModal open={cancelDialog} onClose={() => setCancelDialog(false)}>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold">Mitgliedschaft kündigen</h2>
          <p className="text-sm text-muted-foreground">
            Kündige die Mitgliedschaft von <strong>{member.full_name}</strong> formell. Das Mitglied
            wird zum angegebenen Datum deaktiviert.
          </p>
        </div>
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="cancel-date">Kündigungsdatum</Label>
            <Input
              id="cancel-date"
              type="date"
              value={cancelForm.cancellation_date}
              onChange={(e) => setCancelForm({ ...cancelForm, cancellation_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Grund (optional)</Label>
            <Textarea
              id="cancel-reason"
              value={cancelForm.reason}
              onChange={(e) => setCancelForm({ ...cancelForm, reason: e.target.value })}
              placeholder="z.B. Umzug, persönliche Gründe..."
              rows={3}
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={cancelForm.send_confirmation}
              onChange={(e) =>
                setCancelForm({ ...cancelForm, send_confirmation: e.target.checked })
              }
              className="rounded border-border"
            />
            Bestätigungs-E-Mail an Mitglied senden
          </label>
        </div>
        <div className="flex gap-2 pt-4 justify-end">
          <Button variant="outline" onClick={() => setCancelDialog(false)}>
            Abbrechen
          </Button>
          <Button variant="destructive" onClick={handleCancelMembership} disabled={cancelLoading}>
            {cancelLoading ? 'Wird verarbeitet...' : 'Kündigung bestätigen'}
          </Button>
        </div>
      </CenteredModal>

      {/* ── Confirmation Dialog ──────────────────────────────────────── */}
      <CenteredModal open={!!confirmAction} onClose={() => setConfirmAction(null)}>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold">
            {confirmAction?.type === 'deactivate' && 'Mitglied deaktivieren?'}
            {confirmAction?.type === 'role' && 'Rolle auf Admin ändern?'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {confirmAction?.type === 'deactivate' && (
              <>
                Möchtest du <strong>{member.full_name}</strong> wirklich deaktivieren?
                <span className="block mt-1">
                  Das Mitglied verliert den Zugang zum Vereinsportal und kann sich nicht mehr für
                  Trainings anmelden.
                </span>
              </>
            )}
            {confirmAction?.type === 'role' && (
              <>
                Möchtest du <strong>{member.full_name}</strong> wirklich die Rolle{' '}
                <strong>Admin</strong> zuweisen?
                <span className="block mt-1">
                  Admins haben vollen Zugriff auf alle Vereinsverwaltungsfunktionen inkl.
                  Mitgliederverwaltung, Buchhaltung und Einstellungen.
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2 pt-4 justify-end">
          <Button variant="outline" onClick={() => setConfirmAction(null)}>
            Abbrechen
          </Button>
          <Button
            variant={confirmAction?.type === 'deactivate' ? 'destructive' : 'default'}
            onClick={() => {
              if (confirmAction?.type === 'deactivate') executeToggleActive();
              else if (confirmAction?.type === 'role' && confirmAction.newRole)
                executeRoleChange(confirmAction.newRole);
            }}
          >
            {confirmAction?.type === 'deactivate' && 'Deaktivieren'}
            {confirmAction?.type === 'role' && 'Ja, Admin zuweisen'}
          </Button>
        </div>
      </CenteredModal>
    </div>
  );
}
