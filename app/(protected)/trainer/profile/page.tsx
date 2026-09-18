'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  User,
  Euro,
  Lock,
  Save,
  Loader2,
  XCircle,
  CheckCircle2,
  Mail,
  Phone,
  Calendar,
  Globe,
  Briefcase,
  Edit,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { format, parseISO } from 'date-fns';
import { de } from '@/lib/locale';
import type { TrainerProfile as TrainerProfileType } from '@/domain/entities/trainer.entity';

type TrainerProfileData = Pick<
  TrainerProfileType,
  | 'id'
  | 'userId'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'dateOfBirth'
  | 'bio'
  | 'status'
  | 'hourlyRate'
  | 'contractedHourlyRate'
  | 'extraHoursRate'
  | 'languages'
  | 'experience'
  | 'qualifications'
  | 'specializations'
>;

export default function TrainerProfilePage() {
  const [profile, setProfile] = useState<TrainerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<TrainerProfileData>>({});
  const [extraRate, setExtraRate] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Get the trainer's own profile ID via /api/trainer/me
      const meRes = await apiFetch('/api/trainer/me', { signal: AbortSignal.timeout(10_000) });
      if (!meRes.ok) {
        const errData = await meRes.json().catch(() => ({}));
        throw new Error(errData.error ?? 'Trainer-Profil nicht gefunden');
      }
      const meData = await meRes.json();

      // The /api/trainer/me response includes profile info directly.
      // Resolve the profile ID — try multiple response shapes.
      const tp = meData.profile ?? meData.trainerProfile ?? meData;
      const profileId: string = tp.id ?? '';

      if (!profileId) {
        throw new Error('Trainer-Profil-ID nicht gefunden. Bitte wende dich an den Administrator.');
      }

      // Fetch full profile details from the dedicated endpoint
      const detailRes = await apiFetch(`/api/trainer-profiles/${profileId}`);
      if (!detailRes.ok) {
        throw new Error('Fehler beim Laden des Profils');
      }
      const detailData = await detailRes.json();
      const detail = detailData.trainerProfile;

      if (!detail) {
        throw new Error('Profil-Daten nicht verfügbar');
      }

      const profileData: TrainerProfileData = {
        id: detail.id ?? profileId,
        userId: detail.userId ?? tp.userId ?? '',
        firstName: detail.firstName ?? tp.firstName ?? '',
        lastName: detail.lastName ?? tp.lastName ?? '',
        email: detail.email ?? tp.email ?? '',
        phone: detail.phone ?? tp.phone ?? '',
        dateOfBirth: detail.dateOfBirth ?? tp.dateOfBirth ?? '',
        bio: detail.bio ?? tp.bio ?? undefined,
        status: detail.status ?? tp.status ?? 'active',
        hourlyRate: detail.hourlyRate ?? tp.hourlyRate ?? undefined,
        contractedHourlyRate: detail.contractedHourlyRate ?? tp.contractedHourlyRate ?? null,
        extraHoursRate: detail.extraHoursRate ?? tp.extraHoursRate ?? null,
        languages: detail.languages ?? tp.languages ?? [],
        experience: detail.experience ?? tp.experience,
        qualifications: detail.qualifications ?? tp.qualifications,
        specializations: detail.specializations ?? tp.specializations,
      };

      setProfile(profileData);
      setExtraRate(profileData.extraHoursRate != null ? String(profileData.extraHoursRate) : '');
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message);
      } else {
        setError('Unbekannter Fehler');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleEdit = () => {
    if (!profile) return;
    setEditForm({ ...profile });
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/trainer-profiles/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? 'Fehler beim Speichern');
      }
      const data = await res.json();
      const updated = data.trainerProfile;
      if (updated) {
        setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
      }
      setIsEditing(false);
      toast.success('Profil erfolgreich aktualisiert');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRate = async () => {
    if (!profile?.id) return;

    const parsed = extraRate.trim() === '' ? null : parseFloat(extraRate);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      toast.error('Bitte einen gültigen Betrag ≥ 0 eingeben');
      return;
    }

    setSaving(true);
    setSaved(false);
    try {
      const res = await apiFetch(`/api/trainer-profiles/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraHoursRate: parsed }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? 'Fehler beim Speichern');
      }
      const data = await res.json();
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              extraHoursRate: data.trainerProfile?.extraHoursRate ?? parsed,
            }
          : prev
      );
      setSaved(true);
      toast.success('Zusatzstunden-Satz gespeichert');
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const getStatusLabel = (status: TrainerProfileData['status']) => {
    switch (status) {
      case 'active':
        return 'Aktiv';
      case 'inactive':
        return 'Inaktiv';
      case 'on_leave':
        return 'Urlaub';
      case 'terminated':
        return 'Beendet';
    }
  };

  const getStatusVariant = (
    status: TrainerProfileData['status']
  ): 'success' | 'secondary' | 'warning' | 'error' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'secondary';
      case 'on_leave':
        return 'warning';
      case 'terminated':
        return 'error';
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-1.5 text-sm">
          <Skeleton className="h-3.5 w-14 rounded" />
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <div className="bg-background dark:bg-surface-dark rounded-xl border border-border dark:border-white/10 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border dark:border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-7 w-48 rounded" />
                <Skeleton className="h-4 w-56 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-md" />
              </div>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <div className="flex gap-6 border-b pb-3">
              <Skeleton className="h-4 w-12 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <Skeleton className="h-5 w-44 rounded" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-5 w-full rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────
  if (error || !profile) {
    const isNotFound =
      error?.includes('nicht gefunden') ||
      error?.includes('not found') ||
      error?.includes('Profil-ID');
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center">
          {isNotFound ? (
            <User className="h-8 w-8 text-muted-foreground" />
          ) : (
            <XCircle className="h-8 w-8 text-error-400" />
          )}
        </div>
        <div className="space-y-1">
          <p className="font-medium text-sm">
            {isNotFound ? 'Kein Trainer-Profil vorhanden' : 'Profil konnte nicht geladen werden'}
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {isNotFound
              ? 'Dein Trainer-Profil wurde noch nicht angelegt. Bitte wende dich an den Administrator.'
              : (error ?? 'Unbekannter Fehler')}
          </p>
        </div>
        {!isNotFound && (
          <button
            onClick={loadProfile}
            className="text-sm font-medium text-brand-light hover:underline underline-offset-4"
          >
            Erneut versuchen
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in">
      <Breadcrumb
        items={[{ label: `${profile.firstName} ${profile.lastName}` }]}
        className="mb-4"
      />

      <div className="bg-background dark:bg-surface-dark rounded-xl border border-border dark:border-white/10 shadow-sm overflow-hidden animate-in">
        {/* ── Detail Header ────────────────────────────────────────────── */}
        <div className="p-5 border-b border-border dark:border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-bold text-foreground dark:text-white truncate">
                  {profile.firstName} {profile.lastName}
                </h2>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground truncate">
                  {profile.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Badge variant={getStatusVariant(profile.status)} size="lg">
                {getStatusLabel(profile.status)}
              </Badge>
              {!isEditing && (
                <Button onClick={handleEdit} variant="primary" size="sm" className="gap-1.5">
                  <Edit className="h-4 w-4" />
                  Bearbeiten
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Editing Banner ──────────────────────────────────────────── */}
        {isEditing && (
          <div className="flex items-center gap-2 px-5 py-2 bg-brand-accent/5 border-b border-brand-accent/20 text-sm text-brand-accent">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Bearbeitungsmodus aktiv — Änderungen werden erst nach Klick auf &quot;Speichern&quot;
              übernommen.
            </span>
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

        {/* ── Detail Body ──────────────────────────────────────────────── */}
        <div className="p-5">
          <Tabs defaultValue="profile" className="space-y-5">
            <TabsList className="w-full justify-start bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b rounded-none px-0 gap-6 overflow-x-auto sticky top-0 z-20">
              <TabsTrigger
                value="profile"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Profil
              </TabsTrigger>
              <TabsTrigger
                value="rates"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Honorar
              </TabsTrigger>
              {profile.qualifications && profile.qualifications.length > 0 && (
                <TabsTrigger
                  value="qualifications"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
                >
                  Qualifikationen ({profile.qualifications.length})
                </TabsTrigger>
              )}
            </TabsList>

            {/* ── Profile Tab ──────────────────────────────────────────── */}
            <TabsContent value="profile" className="space-y-6 animate-in">
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-primary" />
                    Persönliche Informationen
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Vorname</Label>
                      {isEditing ? (
                        <Input
                          value={editForm.firstName || ''}
                          onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        />
                      ) : (
                        <div className="font-medium">{profile.firstName}</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Nachname</Label>
                      {isEditing ? (
                        <Input
                          value={editForm.lastName || ''}
                          onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        />
                      ) : (
                        <div className="font-medium">{profile.lastName}</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">E-Mail</Label>
                      <div className="font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {profile.email}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Telefon</Label>
                      {isEditing ? (
                        <Input
                          value={editForm.phone || ''}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        />
                      ) : (
                        <div className="font-medium flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {profile.phone || '—'}
                        </div>
                      )}
                    </div>
                    {profile.dateOfBirth && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Geburtsdatum</Label>
                        <div className="font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(parseISO(profile.dateOfBirth), 'dd. MMMM yyyy', { locale: de })}
                        </div>
                      </div>
                    )}
                    {profile.experience && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Erfahrung</Label>
                        <div className="font-medium flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          {profile.experience.years} Jahre
                        </div>
                      </div>
                    )}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Bio</Label>
                      {isEditing ? (
                        <textarea
                          value={editForm.bio || ''}
                          onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                          rows={3}
                          className="w-full rounded-md border border-border dark:border-white/10 bg-background px-3 py-2 text-sm resize-none"
                        />
                      ) : (
                        <div className="text-foreground dark:text-foreground text-sm">
                          {profile.bio || 'Keine Bio vorhanden'}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Languages */}
              {profile.languages.length > 0 && (
                <Card variant="bordered">
                  <CardContent className="p-5">
                    <h3 className="font-semibold mb-4 flex items-center gap-2 text-base">
                      <Globe className="h-4 w-4 text-primary" />
                      Sprachen
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.languages.map((lang, i) => (
                        <Badge key={i} variant="secondary">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Specializations */}
              {profile.specializations && profile.specializations.length > 0 && (
                <Card variant="bordered">
                  <CardContent className="p-5">
                    <h3 className="font-semibold mb-4 flex items-center gap-2 text-base">
                      <Briefcase className="h-4 w-4 text-brand-accent" />
                      Spezialisierungen
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.specializations.map((spec) => (
                        <Badge key={spec.id} variant="secondary">
                          {spec.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Rates Tab ────────────────────────────────────────────── */}
            <TabsContent value="rates" className="space-y-5 animate-in">
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                    <Euro className="h-4 w-4 text-brand-accent" />
                    Honorar
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* contracted_hourly_rate — read-only for trainers */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        Vertragssatz (EUR/h)
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      </Label>
                      <div className="h-12 flex items-center px-3 rounded-xl border border-border dark:border-white/10 bg-muted/30 text-sm">
                        {profile.contractedHourlyRate != null ? (
                          <span className="font-medium">
                            {profile.contractedHourlyRate.toFixed(2)} €/h
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Nicht festgelegt</span>
                        )}
                      </div>
                      <p className="text-2xs text-muted-foreground">
                        Vertraglich vereinbart. Wird von deinem Admin verwaltet.
                      </p>
                    </div>

                    {/* extra_hours_rate — trainer-editable */}
                    <div className="space-y-1.5">
                      <Label htmlFor="extra-rate" className="text-xs text-muted-foreground">
                        Zusatzstunden-Satz (EUR/h)
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="extra-rate"
                          type="number"
                          min={0}
                          step={0.5}
                          value={extraRate}
                          onChange={(e) => {
                            setExtraRate(e.target.value);
                            setSaved(false);
                          }}
                          placeholder="z.B. 50.00"
                          className="h-12 rounded-xl"
                        />
                        <Button
                          onClick={handleSaveRate}
                          disabled={saving}
                          variant="primary"
                          className="h-12 rounded-xl px-5 gap-1.5 shrink-0"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : saved ? (
                            <CheckCircle2 className="h-4 w-4 text-success-300" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          {saving ? 'Speichern…' : saved ? 'Gespeichert' : 'Speichern'}
                        </Button>
                      </div>
                      <p className="text-2xs text-muted-foreground">
                        Dein Satz für Zusatzstunden außerhalb des Regelvertrags. Du kannst diesen
                        selbst anpassen.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Qualifications Tab ───────────────────────────────────── */}
            {profile.qualifications && profile.qualifications.length > 0 && (
              <TabsContent value="qualifications" className="space-y-5 animate-in">
                <Card variant="bordered">
                  <CardContent className="p-5">
                    <h3 className="font-semibold mb-4 flex items-center gap-2 text-base">
                      <Briefcase className="h-4 w-4 text-primary" />
                      Qualifikationen ({profile.qualifications.length})
                    </h3>
                    <div className="space-y-2">
                      {profile.qualifications.map((q) => (
                        <div
                          key={q.id}
                          className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0"
                        >
                          <div>
                            <span className="font-medium">{q.name}</span>
                            <span className="text-muted-foreground ml-2">({q.issuer})</span>
                          </div>
                          <Badge variant={q.verified ? 'success' : 'warning'} size="sm">
                            {q.verified ? 'Verifiziert' : 'Ausstehend'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* ── Detail Footer ─────────────────────────────────────────────── */}
        {isEditing && (
          <div className="p-5 bg-muted dark:bg-black/10 border-t border-border dark:border-white/10 flex flex-col sm:flex-row gap-3 items-center justify-end">
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              className="w-full sm:w-auto"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={saving}
              variant="primary"
              className="w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
