'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User,
  Save,
  Shield,
  CreditCard,
  FileText,
  AlertCircle,
  Mail,
  Phone,
  MapPin,
  Edit,
  Award,
  Trash2,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { useUserMember } from '@/hooks/use-user-data';
import { apiFetch } from '@/lib/api-fetch';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { createClient } from '@/lib/supabase/client';

import { createLogger } from '@/lib/logger';

const log = createLogger('member-profile');

export default function MemberProfile() {
  const { data: memberData, isLoading } = useUserMember();
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const handleAvatarChange = useCallback(
    (url: string | null) => {
      setAvatarUrl(url);
      // Refresh server layout to propagate avatar URL to the header
      router.refresh();
    },
    [router]
  );

  const [newEmail, setNewEmail] = useState('');
  const [emailChanging, setEmailChanging] = useState(false);

  // ── 2FA / TOTP ──────────────────────────────────────────────────────────
  type MfaStep = 'idle' | 'enrolling' | 'verifying';
  const [mfaEnrolled, setMfaEnrolled] = useState<{ id: string } | null>(null);
  const [mfaStep, setMfaStep] = useState<MfaStep>('idle');
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  // Load current MFA status once
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp?.find((f) => f.status === 'verified');
      setMfaEnrolled(verified ? { id: verified.id } : null);
    });
  }, []);

  const startEnroll = async () => {
    setMfaLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'SwingZ',
      });
      if (error) throw error;
      setMfaFactorId(data.id);
      setMfaQr(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      setMfaStep('verifying');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '2FA-Einrichtung fehlgeschlagen');
    } finally {
      setMfaLoading(false);
    }
  };

  const verifyTotp = async () => {
    if (!mfaFactorId || totpCode.length !== 6) return;
    setMfaLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: totpCode,
      });
      if (error) throw error;
      setMfaEnrolled({ id: mfaFactorId });
      setMfaStep('idle');
      setMfaQr(null);
      setMfaSecret(null);
      setTotpCode('');
      toast.success('Zwei-Faktor-Authentifizierung aktiviert');
    } catch (_e: unknown) {
      toast.error('Ungültiger Code — bitte erneut versuchen');
    } finally {
      setMfaLoading(false);
    }
  };

  const unenrollMfa = async () => {
    if (!mfaEnrolled) return;
    setMfaLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaEnrolled.id });
      if (error) throw error;
      setMfaEnrolled(null);
      toast.success('Zwei-Faktor-Authentifizierung deaktiviert');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '2FA-Deaktivierung fehlgeschlagen');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      toast.error('Bitte eine gültige E-Mail-Adresse eingeben');
      return;
    }
    setEmailChanging(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      toast.success('Bestätigungslink an neue Adresse gesendet. Bitte E-Mail prüfen.');
      setNewEmail('');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Ändern der E-Mail');
    } finally {
      setEmailChanging(false);
    }
  };

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    bio: '',
    emergencyContact: '',
    emergencyPhone: '',
    dtbId: '',
  });

  // Sync form fields when memberData loads
  useEffect(() => {
    if (memberData) {
      setFormData({
        fullName: memberData.fullName || '',
        email: memberData.email || '',
        phone: memberData.phone || '',
        address: memberData.address || '',
        city: memberData.city || '',
        postalCode: memberData.postalCode || '',
        bio: memberData.bio || '',
        emergencyContact: memberData.emergencyContact || '',
        emergencyPhone: memberData.emergencyPhone || '',
        dtbId: memberData.dtbId || '',
      });
      setAvatarUrl(memberData.avatarUrl || null);
    }
  }, [memberData]);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // SEPA mandate info - fetched from API
  const [hasActiveMandate, setHasActiveMandate] = useState(false);
  const [mandateInfo, setMandateInfo] = useState<{
    mandateReference?: string;
    iban?: string;
    signatureDate?: string;
  } | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    apiFetch('/api/sepa-mandates?active=true', { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        const mandates = data?.mandates || data || [];
        if (Array.isArray(mandates) && mandates.length > 0) {
          const active = mandates[0];
          setHasActiveMandate(true);
          setMandateInfo({
            mandateReference: active.mandateReference || active.mandate_reference,
            iban: active.iban,
            signatureDate: active.signatureDate || active.signature_date,
          });
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await apiFetch('/api/user/member', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Speichern');
      }

      setIsEditing(false);
      toast.success('Profil erfolgreich aktualisiert');
    } catch (error) {
      toast.error('Fehler beim Speichern des Profils');
      log.error('Profile save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="bg-background rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-5 w-40 bg-muted rounded animate-pulse" />
                <div className="h-4 w-48 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="h-10 w-full bg-muted rounded animate-pulse" />
            <div className="h-40 w-full bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <Breadcrumb items={[{ label: formData.fullName || 'Mein Profil' }]} />

      <div className="bg-background dark:bg-surface-dark rounded-xl border border-border dark:border-white/10 shadow-sm overflow-hidden animate-in">
        {/* ── Detail Header ────────────────────────────────────────────── */}
        <div className="p-5 border-b border-border dark:border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <AvatarUpload
                userName={formData.fullName}
                avatarUrl={avatarUrl}
                size="md"
                onAvatarChange={handleAvatarChange}
              />
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold text-foreground dark:text-white truncate">
                  {formData.fullName || 'Mitglied'}
                </h1>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground truncate">
                  {formData.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <StatusBadge status="active" label="Aktives Mitglied" size="sm" />
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
                value="billing"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Zahlungen
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Sicherheit
              </TabsTrigger>
            </TabsList>

            {/* ── Profile Tab ──────────────────────────────────────────── */}
            <TabsContent value="profile" className="space-y-6 animate-in">
              {/* Personal Information */}
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-primary" />
                    Persönliche Informationen
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Vollständiger Name</Label>
                      {isEditing ? (
                        <Input
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleChange}
                          placeholder="Max Mustermann"
                        />
                      ) : (
                        <div className="font-medium">{formData.fullName || '—'}</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">E-Mail</Label>
                      <div className="font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {formData.email}
                      </div>
                      <p className="text-2xs text-muted-foreground">
                        E-Mail kann nicht geändert werden
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Telefon</Label>
                      {isEditing ? (
                        <Input
                          name="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="+49 123 456 7890"
                        />
                      ) : (
                        <div className="font-medium flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {formData.phone || '—'}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Postleitzahl</Label>
                      {isEditing ? (
                        <Input
                          name="postalCode"
                          value={formData.postalCode}
                          onChange={handleChange}
                          placeholder="12345"
                        />
                      ) : (
                        <div className="font-medium">{formData.postalCode || '—'}</div>
                      )}
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Straße und Hausnummer</Label>
                      {isEditing ? (
                        <Input
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          placeholder="Musterstraße 123"
                        />
                      ) : (
                        <div className="font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {formData.address || '—'}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Stadt</Label>
                      {isEditing ? (
                        <Input
                          name="city"
                          value={formData.city}
                          onChange={handleChange}
                          placeholder="Musterstadt"
                        />
                      ) : (
                        <div className="font-medium">{formData.city || '—'}</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">DTB-Spielernummer</Label>
                      {isEditing ? (
                        <Input
                          name="dtbId"
                          value={formData.dtbId}
                          onChange={handleChange}
                          placeholder="z.B. 12345678"
                        />
                      ) : formData.dtbId ? (
                        <div className="font-medium flex items-center gap-2">
                          <Award className="h-4 w-4 text-primary" />
                          <a
                            href={`https://www.tennis.de/vereinsspielbetrieb/spieler/${formData.dtbId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {formData.dtbId}
                          </a>
                          <span className="text-xs text-muted-foreground">(tennis.de)</span>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Nicht gesetzt —{' '}
                          <span className="text-xs">
                            wird für Ligaergebnisse auf tennis.de benötigt
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                    <Shield className="h-4 w-4 text-brand-accent" />
                    Notfallkontakt
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      {isEditing ? (
                        <Input
                          name="emergencyContact"
                          value={formData.emergencyContact}
                          onChange={handleChange}
                          placeholder="Erika Mustermann"
                        />
                      ) : (
                        <div className="font-medium">{formData.emergencyContact || '—'}</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Telefon</Label>
                      {isEditing ? (
                        <Input
                          name="emergencyPhone"
                          type="tel"
                          value={formData.emergencyPhone}
                          onChange={handleChange}
                          placeholder="+49 123 456 7890"
                        />
                      ) : (
                        <div className="font-medium">{formData.emergencyPhone || '—'}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bio */}
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-primary" />
                    Über mich
                  </h3>
                  {isEditing ? (
                    <Textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      placeholder="Erzähle uns etwas über dich und deine Tennisziele..."
                      rows={4}
                      className="resize-none"
                    />
                  ) : (
                    <div className="text-foreground dark:text-foreground text-sm">
                      {formData.bio || 'Keine Bio vorhanden'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Billing Tab ──────────────────────────────────────────── */}
            <TabsContent value="billing" className="space-y-5 animate-in">
              {/* SEPA-Mandat */}
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                    <CreditCard className="h-4 w-4 text-brand-accent" />
                    SEPA-Lastschriftmandat
                  </h3>
                  {hasActiveMandate && mandateInfo ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-success-500" />
                        <span className="text-sm font-medium text-success-700">Aktives Mandat</span>
                      </div>
                      {mandateInfo.mandateReference && (
                        <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                          <span className="text-muted-foreground">Mandatsreferenz:</span>
                          <span className="font-mono text-xs break-all">
                            {mandateInfo.mandateReference}
                          </span>
                        </div>
                      )}
                      {mandateInfo.iban && (
                        <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                          <span className="text-muted-foreground">IBAN:</span>
                          <span className="font-mono text-xs break-all">{mandateInfo.iban}</span>
                        </div>
                      )}
                      {mandateInfo.signatureDate && (
                        <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                          <span className="text-muted-foreground">Unterschrieben am:</span>
                          <span>
                            {new Date(mandateInfo.signatureDate).toLocaleDateString('de-DE')}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 text-sm text-muted-foreground">
                      <AlertCircle className="h-5 w-5 text-warning-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Kein aktives SEPA-Mandat</p>
                        <p className="mt-1">
                          Du hast noch kein SEPA-Lastschriftmandat erteilt. Ein Mandat wird für die
                          automatische Zahlungsabwicklung benötigt.
                        </p>
                        <Button variant="outline" size="sm" className="mt-3 gap-2">
                          <FileText className="h-4 w-4" />
                          Mandat erteilen
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Sicherheit Tab ───────────────────────────────────────── */}
            <TabsContent value="security" className="space-y-5 animate-in">
              {/* E-Mail ändern */}
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                    <Mail className="h-4 w-4 text-primary" />
                    E-Mail-Adresse ändern
                  </h3>
                  <div className="space-y-3 max-w-md">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Aktuelle E-Mail</Label>
                      <div className="text-sm font-medium text-muted-foreground">
                        {formData.email}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-email" className="text-xs text-muted-foreground">
                        Neue E-Mail-Adresse
                      </Label>
                      <Input
                        id="new-email"
                        type="email"
                        placeholder="neue@email.de"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEmailChange()}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Nach der Änderung erhältst du einen Bestätigungslink an die neue Adresse. Die
                      Änderung wird erst nach Bestätigung aktiv.
                    </p>
                    <Button
                      onClick={handleEmailChange}
                      disabled={emailChanging || !newEmail.trim()}
                      variant="primary"
                      className="gap-2"
                    >
                      <Shield className="h-4 w-4" />
                      {emailChanging ? 'Wird gesendet…' : 'Bestätigungslink senden'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 2FA */}
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-2 flex items-center gap-2 text-base">
                    <Shield className="h-4 w-4 text-primary" />
                    Zwei-Faktor-Authentifizierung (2FA)
                  </h3>
                  <p className="text-xs text-muted-foreground mb-5">
                    Schütze dein Konto mit einem TOTP-Code (Google Authenticator, Authy, etc.).
                  </p>

                  {mfaEnrolled ? (
                    <div className="space-y-4 max-w-md">
                      <div className="flex items-center gap-2 text-sm text-success-700 dark:text-success-400">
                        <CheckCircle className="h-4 w-4" />
                        2FA ist aktiv
                      </div>
                      <Button
                        onClick={unenrollMfa}
                        disabled={mfaLoading}
                        variant="outline"
                        className="gap-2 text-error-600 border-error-300 hover:bg-error-50 dark:hover:bg-error-900"
                      >
                        {mfaLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        2FA deaktivieren
                      </Button>
                    </div>
                  ) : mfaStep === 'verifying' ? (
                    <div className="space-y-4 max-w-md">
                      <p className="text-sm font-medium">QR-Code scannen</p>
                      {mfaQr && (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element -- data-URL, next/image nicht kompatibel */}
                          <img
                            src={mfaQr}
                            alt="2FA QR-Code"
                            className="w-40 h-40 rounded-xl border border-border"
                          />
                        </>
                      )}
                      {mfaSecret && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Oder manuell eingeben:</p>
                          <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">
                            {mfaSecret}
                          </code>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label htmlFor="totp-code" className="text-xs text-muted-foreground">
                          6-stelliger Code zur Bestätigung
                        </Label>
                        <Input
                          id="totp-code"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          placeholder="000000"
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                          onKeyDown={(e) => e.key === 'Enter' && verifyTotp()}
                          className="font-mono tracking-widest text-center text-lg w-36"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={verifyTotp}
                          disabled={mfaLoading || totpCode.length !== 6}
                          variant="primary"
                          className="gap-2"
                        >
                          {mfaLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                          Bestätigen
                        </Button>
                        <Button
                          onClick={() => {
                            setMfaStep('idle');
                            setMfaQr(null);
                            setTotpCode('');
                          }}
                          variant="outline"
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 max-w-md">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <XCircle className="h-4 w-4" />
                        2FA ist nicht aktiv
                      </div>
                      <Button
                        onClick={startEnroll}
                        disabled={mfaLoading}
                        variant="primary"
                        className="gap-2"
                      >
                        {mfaLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Shield className="h-4 w-4" />
                        )}
                        2FA einrichten
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
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
              onClick={handleSave}
              disabled={isSaving}
              variant="primary"
              className="w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>
        )}
      </div>

      {/* ── Deine Daten ──────────────────────────────────────────────────── */}
      <DataExportSection />

      {/* ── Gefahrenzone ─────────────────────────────────────────────────── */}
      <DeleteAccountSection />
    </div>
  );
}

/**
 * Selbstauskunft nach Art. 15 DSGVO. Bewusst ein normaler Link statt eines
 * fetch-Downloads: die Route authentifiziert über das Session-Cookie, also
 * reicht die Navigation — und der Browser übernimmt das Speichern.
 */
function DataExportSection() {
  return (
    <div className="mt-8">
      <div className="border rounded-xl overflow-hidden">
        <div className="px-5 py-4 bg-muted/40 border-b">
          <h3 className="text-sm font-semibold">Deine Daten</h3>
        </div>
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Datenauskunft herunterladen</p>
            <p className="text-xs text-muted-foreground mt-1">
              Du erhältst alle personenbezogenen Daten, die dein Verein zu dir gespeichert hat, als
              JSON-Datei (Auskunft nach Art. 15 DSGVO).
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 gap-2">
            <a href="/api/user/export" download>
              <Download className="h-4 w-4" />
              Auskunft herunterladen
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await apiFetch('/api/user/delete', { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(extractErrorMessage(data) ?? 'Löschung fehlgeschlagen');
        setIsDeleting(false);
        return;
      }
      router.push('/login');
    } catch {
      alert('Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="mt-8">
      <div className="border border-destructive/30 dark:border-destructive/20 rounded-xl overflow-hidden">
        <div className="px-5 py-4 bg-destructive/5 dark:bg-destructive/10 border-b border-destructive/20">
          <h3 className="text-sm font-semibold text-destructive">Gefahrenzone</h3>
        </div>
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Konto löschen</p>
            <p className="text-xs text-muted-foreground mt-1">
              Deine persönlichen Daten werden gemäß DSGVO anonymisiert. Buchungs- und
              Abrechnungsdaten bleiben aus gesetzlichen Gründen erhalten.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Konto löschen
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Konto wirklich löschen?"
        description="Diese Aktion ist nicht rückgängig zu machen. Deine persönlichen Daten werden unwiderruflich anonymisiert und dein Konto wird deaktiviert."
        confirmLabel="Ja, Konto löschen"
        cancelLabel="Abbrechen"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
