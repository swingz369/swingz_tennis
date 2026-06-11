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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <XCircle className="h-8 w-8 text-red-400" />
        </div>
        <p className="text-sm text-muted-foreground">{error ?? 'Profil nicht gefunden'}</p>
        <button
          onClick={loadProfile}
          className="text-sm font-medium text-brand-light hover:underline underline-offset-4"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  const statusLabel =
    profile.status === 'active'
      ? 'Aktiv'
      : profile.status === 'inactive'
        ? 'Inaktiv'
        : profile.status === 'on_leave'
          ? 'Urlaub'
          : 'Beendet';

  const statusVariant =
    profile.status === 'active'
      ? 'success'
      : profile.status === 'inactive'
        ? 'secondary'
        : profile.status === 'on_leave'
          ? 'warning'
          : 'error';

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground dark:text-white">Mein Profil</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Deine persönlichen Informationen und Einstellungen
        </p>
      </div>

      {/* ── Profile Info Card ───────────────────────────────────────────── */}
      <Card className="border border-border dark:border-white/10 overflow-hidden">
        <div className="p-5 border-b border-border dark:border-white/10 bg-gradient-to-r from-brandPrimary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brandPrimary/20 to-brandPrimary/5 flex items-center justify-center">
              <User className="h-6 w-6 text-brandPrimary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground dark:text-white">
                {profile.firstName} {profile.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <Badge
              variant={statusVariant as 'success' | 'secondary' | 'warning' | 'error'}
              className="ml-auto"
            >
              {statusLabel}
            </Badge>
          </div>
        </div>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">E-Mail:</span>
              <span className="font-medium">{profile.email}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Telefon:</span>
              <span className="font-medium">{profile.phone || '—'}</span>
            </div>
            {profile.dateOfBirth && (
              <div className="flex items-center gap-2.5">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Geburtsdatum:</span>
                <span className="font-medium">
                  {format(parseISO(profile.dateOfBirth), 'dd. MMMM yyyy', { locale: de })}
                </span>
              </div>
            )}
            {profile.experience && (
              <div className="flex items-center gap-2.5">
                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Erfahrung:</span>
                <span className="font-medium">{profile.experience.years} Jahre</span>
              </div>
            )}
            {profile.languages.length > 0 && (
              <div className="flex items-center gap-2.5 sm:col-span-2">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Sprachen:</span>
                <div className="flex flex-wrap gap-1">
                  {profile.languages.map((lang, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          {profile.bio && (
            <p className="mt-4 pt-4 border-t border-border dark:border-white/10 text-sm text-muted-foreground">
              {profile.bio}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Honorar Card ────────────────────────────────────────────────── */}
      <Card className="border border-border dark:border-white/10 overflow-hidden">
        <CardContent className="p-5">
          <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
            <Euro className="h-4 w-4 text-brandAccent" />
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
                  <span className="font-medium">{profile.contractedHourlyRate.toFixed(2)} €/h</span>
                ) : (
                  <span className="text-muted-foreground">Nicht festgelegt</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
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
                    <CheckCircle2 className="h-4 w-4 text-green-300" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? 'Speichern…' : saved ? 'Gespeichert' : 'Speichern'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Dein Satz für Zusatzstunden außerhalb des Regelvertrags. Du kannst diesen selbst
                anpassen.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Qualifikationen (read-only overview) ────────────────────────── */}
      {profile.qualifications && profile.qualifications.length > 0 && (
        <Card className="border border-border dark:border-white/10 overflow-hidden">
          <CardContent className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4 text-brandPrimary" />
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
      )}
    </div>
  );
}
