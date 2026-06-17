'use client';

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
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { toast } from 'sonner';
import { useUserMember } from '@/hooks/use-user-data';
import { apiFetch } from '@/lib/api-fetch';
import { ScrollReveal } from '@/components/animations';
import { Breadcrumb } from '@/components/ui/breadcrumb';

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
      console.error('Profile save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="bg-background rounded-2xl border border-border shadow-sm overflow-hidden">
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in">
      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <Breadcrumb items={[{ label: formData.fullName || 'Mein Profil' }]} />

      {/* ── Hero Header ── */}
      <ScrollReveal>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary via-brand-primary/95 to-brand-dark p-6 md:p-8 text-white">
          <div className="absolute inset-0 bg-noise opacity-5" />
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-background/5 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-brand-accent/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <AvatarUpload
                  userName={formData.fullName}
                  avatarUrl={avatarUrl}
                  size="lg"
                  onAvatarChange={handleAvatarChange}
                  editable={false}
                />
                <div>
                  <p className="text-sm font-medium text-white/70 mb-1">Mein Profil</p>
                  <h1 className="text-2xl md:text-3xl font-bold">
                    {formData.fullName || 'Mitglied'}
                  </h1>
                  <p className="text-white/70 mt-1">{formData.email}</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-xl bg-background/10 backdrop-blur-sm px-4 py-2.5">
                <Award className="h-5 w-5 text-brand-accent" />
                <span className="text-sm font-medium">Aktives Mitglied</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      <div className="bg-background dark:bg-surface-dark rounded-2xl border border-border dark:border-white/10 shadow-sm overflow-hidden animate-in">
        {/* ── Detail Header ────────────────────────────────────────────── */}
        <div className="p-5 border-b border-border dark:border-white/10 bg-gradient-to-r from-brandPrimary/5 to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <AvatarUpload
                userName={formData.fullName}
                avatarUrl={avatarUrl}
                size="md"
                onAvatarChange={handleAvatarChange}
              />
              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-bold text-foreground dark:text-white truncate">
                  {formData.fullName || 'Mitglied'}
                </h2>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground truncate">
                  {formData.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Profil
              </TabsTrigger>
              <TabsTrigger
                value="billing"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-brandPrimary data-[state=active]:shadow-none rounded-none px-0 text-sm whitespace-nowrap"
              >
                Zahlungen
              </TabsTrigger>
            </TabsList>

            {/* ── Profile Tab ──────────────────────────────────────────── */}
            <TabsContent value="profile" className="space-y-6 animate-in">
              {/* Personal Information */}
              <Card variant="bordered">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-5 flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-brandPrimary" />
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
                      <p className="text-[11px] text-muted-foreground">
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
                          <Award className="h-4 w-4 text-brand-primary" />
                          <a
                            href={`https://www.tennis.de/vereinsspielbetrieb/spieler/${formData.dtbId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-primary hover:underline"
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
                    <Shield className="h-4 w-4 text-brandAccent" />
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
                    <User className="h-4 w-4 text-brandPrimary" />
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
                    <CreditCard className="h-4 w-4 text-brandAccent" />
                    SEPA-Lastschriftmandat
                  </h3>
                  {hasActiveMandate && mandateInfo ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm font-medium text-green-700">Aktives Mandat</span>
                      </div>
                      {mandateInfo.mandateReference && (
                        <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                          <span className="text-muted-foreground">Mandatsreferenz:</span>
                          <span className="font-mono text-xs">{mandateInfo.mandateReference}</span>
                        </div>
                      )}
                      {mandateInfo.iban && (
                        <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                          <span className="text-muted-foreground">IBAN:</span>
                          <span className="font-mono text-xs">{mandateInfo.iban}</span>
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
                      <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
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

      {/* ── Gefahrenzone ─────────────────────────────────────────────────── */}
      <DeleteAccountSection />
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
      const response = await fetch('/api/user/delete', { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error ?? 'Löschung fehlgeschlagen');
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
