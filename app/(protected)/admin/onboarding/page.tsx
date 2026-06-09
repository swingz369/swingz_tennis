'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Zap,
  Building2,
  Clock,
  MapPin,
  Euro,
  CalendarRange,
  Users,
  Mail,
  PartyPopper,
  ArrowRight,
  Circle,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Calendar,
  Copy,
  Palette,
  Receipt,
  CalendarDays,
  Plus,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { ModuleSelectionStep } from '@/components/onboarding/module-selection-step';

type ClubData = {
  id: string;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string | null;
  description?: string | null;
  founding_date?: string | null;
};

const TOTAL_STEPS = 12;

const STEPS = [
  { label: 'Start', icon: Sparkles },
  { label: 'Module', icon: Zap },
  { label: 'Verein', icon: Building2 },
  { label: 'Öffnungszeiten', icon: Clock },
  { label: 'Platz', icon: MapPin },
  { label: 'Preise', icon: Euro },
  { label: 'Beiträge', icon: Receipt },
  { label: 'Buchung', icon: CalendarRange },
  { label: 'Einladungen', icon: Users },
  { label: 'E-Mail', icon: Mail },
  { label: 'Saison', icon: CalendarDays },
  { label: 'Fertig', icon: PartyPopper },
];

const DAYS = [
  { key: 'monday', label: 'Montag' },
  { key: 'tuesday', label: 'Dienstag' },
  { key: 'wednesday', label: 'Mittwoch' },
  { key: 'thursday', label: 'Donnerstag' },
  { key: 'friday', label: 'Freitag' },
  { key: 'saturday', label: 'Samstag' },
  { key: 'sunday', label: 'Sonntag' },
] as const;

type OpeningHours = Record<string, { open: string; close: string }>;

const DEFAULT_OPENING_HOURS: OpeningHours = {
  monday: { open: '08:00', close: '22:00' },
  tuesday: { open: '08:00', close: '22:00' },
  wednesday: { open: '08:00', close: '22:00' },
  thursday: { open: '08:00', close: '22:00' },
  friday: { open: '08:00', close: '22:00' },
  saturday: { open: '08:00', close: '22:00' },
  sunday: { open: '08:00', close: '22:00' },
};

interface FeeCategory {
  name: string;
  type: string;
  amount: string;
  billing_cycle: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [club, setClub] = useState<ClubData | null>(null);

  // Step 2 – Module selection (saves into clubs.features on Continue)
  const [modulesSaved, setModulesSaved] = useState(false);

  // Step 3 – Club data
  const [clubForm, setClubForm] = useState({
    name: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    logo_url: '',
    description: '',
    founding_date: '',
  });

  // Step 4 – Opening hours
  const [openingHours, setOpeningHours] = useState<OpeningHours>(DEFAULT_OPENING_HOURS);

  // Step 5 – Court
  const [courtForm, setCourtForm] = useState({
    name: 'Platz 1',
    surface: 'sand',
    hasIndoor: false,
  });

  // Step 6 – Prices & Training duration
  const [priceForm, setPriceForm] = useState({
    default_hourly_rate: '15.00',
    default_session_duration_minutes: '60',
    billing_unit_minutes: '60',
    tax_rate: '0',
  });

  // Step 7 – Booking rules
  const [rulesForm, setRulesForm] = useState({
    max_booking_duration_minutes: 90,
    advance_booking_days: 14,
    max_bookings_per_week: 3,
  });

  // Step 7 – Fee categories (Beiträge)
  const [feeCategoriesSaved, setFeeCategoriesSaved] = useState(false);
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([
    { name: 'Jahresmitgliedschaft', type: 'membership', amount: '240', billing_cycle: 'yearly' },
    { name: 'Training Einzelstunde', type: 'training', amount: '25', billing_cycle: 'one_time' },
  ]);

  // Step 11 – Season creation
  const [seasonForm, setSeasonForm] = useState({
    name: '',
    season_type: 'summer' as 'summer' | 'winter',
    year: new Date().getFullYear(),
    start_date: '',
    end_date: '',
  });
  const [seasonAutoFilled, setSeasonAutoFilled] = useState(false);

  // Auto-fill season name + dates when entering Step 11 for the first time
  useEffect(() => {
    if (step === 11 && !seasonAutoFilled) {
      const yr = seasonForm.year;
      const type = seasonForm.season_type;
      const typeName = type === 'summer' ? 'Sommer' : 'Winter';
      const name = type === 'winter' ? `${typeName} ${yr}/${yr + 1}` : `${typeName} ${yr}`;
      const startDate = type === 'summer' ? `${yr}-04-01` : `${yr}-10-01`;
      const endDate = type === 'summer' ? `${yr}-09-30` : `${yr + 1}-03-31`;
      setSeasonForm((f) => ({ ...f, name, start_date: startDate, end_date: endDate }));
      setSeasonAutoFilled(true);
    }
  }, [step, seasonAutoFilled, seasonForm.year, seasonForm.season_type]);

  // Step 9 – Invitations
  const [trainerForm, setTrainerForm] = useState({ name: '', email: '' });
  const [memberForm, setMemberForm] = useState({ name: '', email: '' });

  // Step 10 – E-Mail & Language
  const [emailSettings, setEmailSettings] = useState({
    language: 'de',
    email_from_name: '',
    email_from_address: '',
  });

  // Load club data on mount
  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await apiFetch('/api/me');
        if (!meRes.ok) return;
        const me = await meRes.json();
        const clubId = me?.clubId;
        if (!clubId) return;

        const res = await apiFetch(`/api/clubs/${clubId}`);
        if (!res.ok) return;
        const data = await res.json();
        setClub({ id: clubId, ...data });
        setClubForm({
          name: data.name ?? '',
          city: data.city ?? '',
          address: data.address ?? '',
          phone: data.phone ?? '',
          email: data.email ?? '',
          website: data.website ?? '',
          logo_url: data.logo_url ?? '',
          description: data.description ?? '',
          founding_date: data.founding_date ?? '',
        });

        // Pre-fill opening hours from existing data
        if (data.opening_hours && typeof data.opening_hours === 'object') {
          const oh: OpeningHours = { ...DEFAULT_OPENING_HOURS };
          for (const day of DAYS) {
            if (data.opening_hours[day.key]) {
              oh[day.key] = {
                open: data.opening_hours[day.key].open || '08:00',
                close: data.opening_hours[day.key].close || '22:00',
              };
            }
          }
          setOpeningHours(oh);
        }

        // Pre-fill price data
        setPriceForm({
          default_hourly_rate: data.default_hourly_rate?.toString() ?? '15.00',
          default_session_duration_minutes:
            data.default_session_duration_minutes?.toString() ?? '60',
          billing_unit_minutes: data.billing_unit_minutes?.toString() ?? '60',
          tax_rate: data.tax_rate?.toString() ?? '0',
        });

        // Pre-fill email
        setEmailSettings((prev) => ({
          ...prev,
          email_from_name: data.name ?? '',
          email_from_address: data.email ?? '',
        }));

        const rulesRes = await apiFetch('/api/booking-rules');
        if (rulesRes.ok) {
          const rules = await rulesRes.json();
          setRulesForm({
            max_booking_duration_minutes: rules.max_booking_duration_minutes ?? 90,
            advance_booking_days: rules.advance_booking_days ?? 14,
            max_bookings_per_week: rules.max_bookings_per_week ?? 3,
          });
        }
      } catch (err) {
        console.error('Init error:', err);
      }
    };
    init();
  }, []);

  // ── Save Functions ──────────────────────────────────────────────────────

  const saveClubData = useCallback(async (): Promise<boolean> => {
    if (!club?.id) return false;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clubs/${club.id}/setup`, {
        method: 'PATCH',
        body: JSON.stringify(clubForm),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Fehler beim Speichern der Vereinsdaten');
        return false;
      }
      // Sync logo_url to Admin Branding module
      if (clubForm.logo_url.trim()) {
        try {
          await apiFetch('/api/branding', {
            method: 'PUT',
            headers: { 'x-club-id': club.id },
            body: JSON.stringify({
              brand: {
                primaryColor: '#1B4332',
                secondaryColor: '#1e3a5f',
                accentColor: '#FF6B35',
              },
              logos: {
                light: clubForm.logo_url || null,
                dark: clubForm.logo_url || null,
                favicon: null,
              },
              customDomain: null,
            }),
          });
        } catch (e) {
          console.warn('Branding sync failed during onboarding', e);
        }
      }
      return true;
    } catch {
      toast.error('Netzwerkfehler');
      return false;
    } finally {
      setLoading(false);
    }
  }, [club?.id, clubForm]);

  const saveOpeningHours = useCallback(async (): Promise<boolean> => {
    if (!club?.id) return false;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clubs/${club.id}/setup`, {
        method: 'PATCH',
        body: JSON.stringify({ opening_hours: openingHours }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Fehler beim Speichern der Öffnungszeiten');
        return false;
      }
      return true;
    } catch {
      toast.error('Netzwerkfehler');
      return false;
    } finally {
      setLoading(false);
    }
  }, [club?.id, openingHours]);

  const saveCourtData = useCallback(async (): Promise<boolean> => {
    if (!club?.id) return false;
    if (!courtForm.name.trim()) return true;
    setLoading(true);
    try {
      const res = await apiFetch('/api/courts', {
        method: 'POST',
        body: JSON.stringify({
          name: courtForm.name,
          surface: courtForm.surface,
          hasIndoor: courtForm.hasIndoor,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Fehler beim Anlegen des Platzes');
        return false;
      }
      return true;
    } catch {
      toast.error('Netzwerkfehler');
      return false;
    } finally {
      setLoading(false);
    }
  }, [club?.id, courtForm]);

  const savePriceData = useCallback(async (): Promise<boolean> => {
    if (!club?.id) return false;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clubs/${club.id}/setup`, {
        method: 'PATCH',
        body: JSON.stringify({
          default_hourly_rate: parseFloat(priceForm.default_hourly_rate) || 15,
          default_session_duration_minutes:
            parseInt(priceForm.default_session_duration_minutes) || 60,
          billing_unit_minutes: parseInt(priceForm.billing_unit_minutes) || 60,
          tax_rate: parseInt(priceForm.tax_rate) || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Fehler beim Speichern der Preisdaten');
        return false;
      }
      return true;
    } catch {
      toast.error('Netzwerkfehler');
      return false;
    } finally {
      setLoading(false);
    }
  }, [club?.id, priceForm]);

  const saveBookingRules = useCallback(async (): Promise<boolean> => {
    if (!club?.id) return false;
    setLoading(true);
    try {
      const res = await apiFetch('/api/booking-rules', {
        method: 'POST',
        body: JSON.stringify(rulesForm),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Fehler beim Speichern der Buchungsregeln');
        return false;
      }
      return true;
    } catch {
      toast.error('Netzwerkfehler');
      return false;
    } finally {
      setLoading(false);
    }
  }, [club?.id, rulesForm]);

  const saveFeeCategories = useCallback(async (): Promise<boolean> => {
    if (!club?.id || feeCategoriesSaved) return true;
    setLoading(true);
    try {
      let created = 0;
      for (const cat of feeCategories) {
        if (!cat.name.trim() || !cat.amount) continue;
        const res = await apiFetch('/api/admin/fee-categories', {
          method: 'POST',
          body: JSON.stringify({
            club_id: club.id,
            name: cat.name,
            type: cat.type,
            amount: parseFloat(cat.amount),
            billing_cycle: cat.billing_cycle,
            is_active: true,
          }),
        });
        if (res.ok) created++;
      }
      if (created > 0) {
        toast.success(`${created} Beitragskategorie(n) erstellt`);
        setFeeCategoriesSaved(true);
      }
      return true;
    } catch {
      toast.error('Netzwerkfehler');
      return false;
    } finally {
      setLoading(false);
    }
  }, [club?.id, feeCategories, feeCategoriesSaved]);

  const createFirstSeason = useCallback(async (): Promise<boolean> => {
    if (!club?.id || !seasonForm.name.trim()) {
      if (!seasonForm.name.trim()) toast.error('Bitte gib einen Saison-Namen ein');
      return false;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/seasons', {
        method: 'POST',
        body: JSON.stringify({
          club_id: club.id,
          name: seasonForm.name,
          season_type: seasonForm.season_type,
          year: seasonForm.year,
          start_date: seasonForm.start_date,
          end_date: seasonForm.end_date,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Fehler beim Erstellen der Saison');
        return false;
      }
      toast.success('Saison erstellt!');
      return true;
    } catch {
      toast.error('Netzwerkfehler');
      return false;
    } finally {
      setLoading(false);
    }
  }, [club?.id, seasonForm]);

  const saveTrainerInvite = useCallback(async (): Promise<boolean> => {
    if (!trainerForm.email.trim()) return true;
    setLoading(true);
    try {
      const res = await apiFetch('/api/members/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: trainerForm.email,
          full_name: trainerForm.name,
          role: 'trainer',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Fehler beim Einladen des Trainers');
        return false;
      }
      toast.success('Trainer eingeladen');
      return true;
    } catch {
      toast.error('Netzwerkfehler');
      return false;
    } finally {
      setLoading(false);
    }
  }, [trainerForm]);

  const saveMemberInvite = useCallback(async (): Promise<boolean> => {
    if (!memberForm.email.trim()) return true;
    setLoading(true);
    try {
      const res = await apiFetch('/api/members/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: memberForm.email,
          full_name: memberForm.name,
          role: 'member',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        // 409 = already member, not a hard error for onboarding
        if (res.status === 409) {
          toast.error(err.error ?? 'Mitglied bereits im Verein');
          return true; // don't block flow
        }
        toast.error(err.error ?? 'Fehler beim Einladen des Mitglieds');
        return false;
      }
      toast.success('Mitglied eingeladen');
      return true;
    } catch {
      toast.error('Netzwerkfehler');
      return false;
    } finally {
      setLoading(false);
    }
  }, [memberForm]);

  const saveEmailSettings = useCallback(async (): Promise<boolean> => {
    if (!club?.id) return false;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clubs/${club.id}/onboarding-settings`, {
        method: 'POST',
        body: JSON.stringify(emailSettings),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Fehler beim Speichern der E-Mail-Einstellungen');
        return false;
      }
      return true;
    } catch {
      toast.error('Netzwerkfehler');
      return false;
    } finally {
      setLoading(false);
    }
  }, [club?.id, emailSettings]);

  const markSetupComplete = useCallback(async (): Promise<boolean> => {
    if (!club?.id) return false;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clubs/${club.id}/setup`, {
        method: 'PATCH',
        body: JSON.stringify({ setup_completed_at: new Date().toISOString() }),
      });
      if (!res.ok) {
        toast.error('Setup konnte nicht abgeschlossen werden. Bitte versuche es erneut.');
        return false;
      }
      return true;
    } catch {
      toast.error('Netzwerkfehler beim Abschließen des Setups');
      return false;
    } finally {
      setLoading(false);
    }
  }, [club?.id]);

  // ── Navigation ───────────────────────────────────────────────────────────

  const goNext = async () => {
    switch (step) {
      case 2: {
        // Module selection — no API call here, the user saves from within
        // ModuleSelectionStep. We only require that they have saved at least once.
        if (!modulesSaved) {
          toast.error('Bitte speichere deine Modul-Auswahl zuerst');
          return;
        }
        break;
      }
      case 3: {
        const ok = await saveClubData();
        if (!ok) return;
        break;
      }
      case 4: {
        const ok = await saveOpeningHours();
        if (!ok) return;
        break;
      }
      case 5: {
        const ok = await saveCourtData();
        if (!ok) return;
        break;
      }
      case 6: {
        const ok = await savePriceData();
        if (!ok) return;
        break;
      }
      case 7: {
        const ok = await saveFeeCategories();
        if (!ok) return;
        break;
      }
      case 8: {
        const ok = await saveBookingRules();
        if (!ok) return;
        break;
      }
      case 9: {
        const ok1 = await saveTrainerInvite();
        if (!ok1) return;
        const ok2 = await saveMemberInvite();
        if (!ok2) return;
        break;
      }
      case 10: {
        const ok = await saveEmailSettings();
        if (!ok) return;
        break;
      }
      case 11: {
        const ok = await createFirstSeason();
        if (!ok) return;
        break;
      }
      case 12: {
        const ok = await markSetupComplete();
        if (!ok) return;
        router.push('/admin');
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const skipStep = () => {
    setStep((s) => s + 1);
  };

  const applyAllOpeningHours = () => {
    const monday = openingHours.monday;
    const updated: OpeningHours = { ...openingHours };
    for (const day of DAYS) {
      updated[day.key] = { ...monday };
    }
    setOpeningHours(updated);
  };

  // ── Stepper ────────────────────────────────────────────────────────────

  const renderStepper = () => (
    <div className="w-full mb-10">
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < step;
          const isCurrent = stepNum === step;
          const StepIcon = s.icon;

          return (
            <div key={stepNum} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2 relative">
                {stepNum < TOTAL_STEPS && (
                  <div
                    className={`absolute top-5 left-full h-0.5 w-[calc(100%+0.5rem)] -translate-y-1/2 transition-colors duration-500 ${
                      isCompleted ? 'bg-brand-primary' : 'bg-muted'
                    }`}
                  />
                )}
                <div
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
                      : isCurrent
                        ? 'bg-brand-primary text-white ring-4 ring-brand-primary/20 shadow-lg shadow-brand-primary/30 scale-110'
                        : 'bg-background border-2 border-border text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isCurrent ? (
                    <StepIcon className="w-5 h-5" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap hidden sm:block transition-colors duration-300 ${
                    isCurrent
                      ? 'text-brand-primary font-semibold'
                      : isCompleted
                        ? 'text-brand-primary/70'
                        : 'text-muted-foreground'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Step Content ────────────────────────────────────────────────────────

  const renderStepContent = () => {
    switch (step) {
      // Step 1 – Welcome
      case 1:
        return (
          <div className="text-center space-y-8 py-6">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-brand-primary/10 rounded-full">
              <Zap className="w-12 h-12 text-brand-primary" />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-foreground">Willkommen bei SwingZ!</h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                Richte deinen Verein in wenigen Minuten ein – Schritt für Schritt.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
              {STEPS.slice(1, -1).map((s) => (
                <Badge key={s.label} variant="secondary" className="gap-1.5 px-3 py-1.5">
                  <s.icon className="w-3.5 h-3.5" />
                  {s.label}
                </Badge>
              ))}
            </div>
            <Button
              size="lg"
              className="bg-brand-primary hover:bg-brand-primary/90 text-white px-8 shadow-lg shadow-brand-primary/20"
              onClick={() => setStep(2)}
            >
              Los geht&apos;s
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        );

      // Step 2 – Module selection
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Module auswählen</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Wähle die Bereiche aus, die dein Verein nutzen wird. Du kannst dies später in den
                Einstellungen jederzeit ändern.
              </p>
            </div>
            {club?.id && (
              <ModuleSelectionStep
                clubId={club.id}
                showContinue
                onSaved={() => setModulesSaved(true)}
              />
            )}
          </div>
        );

      // Step 3 – Club data
      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Vereinsdaten</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Trage die grundlegenden Informationen deines Vereins ein.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="clubName">Vereinsname *</Label>
                <Input
                  id="clubName"
                  value={clubForm.name}
                  onChange={(e) => setClubForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="TC Beispiel e.V."
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="clubCity">Stadt</Label>
                <Input
                  id="clubCity"
                  value={clubForm.city}
                  onChange={(e) => setClubForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="München"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="clubAddress">Adresse</Label>
                <Input
                  id="clubAddress"
                  value={clubForm.address}
                  onChange={(e) => setClubForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Musterstraße 1"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="clubPhone">Telefon</Label>
                <Input
                  id="clubPhone"
                  value={clubForm.phone}
                  onChange={(e) => setClubForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+49 89 123456"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="clubEmail">E-Mail</Label>
                <Input
                  id="clubEmail"
                  type="email"
                  value={clubForm.email}
                  onChange={(e) => setClubForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="info@verein.de"
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="clubWebsite">Website</Label>
                <Input
                  id="clubWebsite"
                  value={clubForm.website}
                  onChange={(e) => setClubForm((f) => ({ ...f, website: e.target.value }))}
                  placeholder="https://www.verein.de"
                  className="mt-1.5"
                />
              </div>

              {/* Logo URL — syncs with Admin Branding module */}
              <div className="sm:col-span-2">
                <Label htmlFor="clubLogo" className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Logo-URL
                </Label>
                <Input
                  id="clubLogo"
                  value={clubForm.logo_url}
                  onChange={(e) => setClubForm((f) => ({ ...f, logo_url: e.target.value }))}
                  placeholder="https://www.verein.de/logo.png"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL zu deinem Vereinslogo – wird automatisch in die{' '}
                  <span className="inline-flex items-center gap-0.5">
                    <Palette className="w-3 h-3" /> Branding-Einstellungen
                  </span>{' '}
                  übernommen
                </p>
              </div>

              {/* NEW: Description */}
              <div className="sm:col-span-2">
                <Label htmlFor="clubDescription" className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Beschreibung
                </Label>
                <Textarea
                  id="clubDescription"
                  value={clubForm.description}
                  onChange={(e) => setClubForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Kurze Beschreibung deines Vereins..."
                  className="mt-1.5"
                  rows={3}
                />
              </div>

              {/* NEW: Founding date */}
              <div>
                <Label htmlFor="clubFounding" className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Gründungsdatum
                </Label>
                <Input
                  id="clubFounding"
                  type="date"
                  value={clubForm.founding_date}
                  onChange={(e) => setClubForm((f) => ({ ...f, founding_date: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
        );

      // Step 4 – Opening hours
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Öffnungszeiten</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Lege die Öffnungszeiten für jeden Wochentag fest. Du kannst sie später jederzeit
                ändern.
              </p>
            </div>
            <div className="space-y-3">
              {DAYS.map((day) => (
                <div
                  key={day.key}
                  className="grid grid-cols-[100px_1fr_auto_1fr] items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <span className="text-sm font-medium text-foreground">{day.label}</span>
                  <div>
                    <Label className="text-xs text-muted-foreground">Von</Label>
                    <Input
                      type="time"
                      value={openingHours[day.key]?.open ?? '08:00'}
                      onChange={(e) =>
                        setOpeningHours((prev) => ({
                          ...prev,
                          [day.key]: { ...prev[day.key], open: e.target.value },
                        }))
                      }
                      className="mt-0.5 h-9 text-sm"
                    />
                  </div>
                  <span className="text-muted-foreground text-sm pt-4">–</span>
                  <div>
                    <Label className="text-xs text-muted-foreground">Bis</Label>
                    <Input
                      type="time"
                      value={openingHours[day.key]?.close ?? '22:00'}
                      onChange={(e) =>
                        setOpeningHours((prev) => ({
                          ...prev,
                          [day.key]: { ...prev[day.key], close: e.target.value },
                        }))
                      }
                      className="mt-0.5 h-9 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyAllOpeningHours}
              className="gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Mo auf alle Tage übernehmen
            </Button>
          </div>
        );

      // Step 5 – Court
      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Ersten Platz anlegen</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Füge deinen ersten Tennisplatz hinzu. Weitere Plätze kannst du später ergänzen.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="courtName">Platzname</Label>
                <Input
                  id="courtName"
                  value={courtForm.name}
                  onChange={(e) => setCourtForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Platz 1"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="courtSurface">Belag</Label>
                <Select
                  value={courtForm.surface}
                  onValueChange={(v) => setCourtForm((f) => ({ ...f, surface: v }))}
                >
                  <SelectTrigger id="courtSurface" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sand">Sand</SelectItem>
                    <SelectItem value="hard">Hart</SelectItem>
                    <SelectItem value="grass">Rasen</SelectItem>
                    <SelectItem value="artificial">Kunstrasen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Standort</Label>
                <div className="flex gap-3 mt-2">
                  <Button
                    type="button"
                    variant={courtForm.hasIndoor ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => setCourtForm((f) => ({ ...f, hasIndoor: false }))}
                    className={
                      !courtForm.hasIndoor
                        ? 'bg-brand-primary hover:bg-brand-primary/90 text-white'
                        : 'text-muted-foreground'
                    }
                  >
                    Außen
                  </Button>
                  <Button
                    type="button"
                    variant={courtForm.hasIndoor ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCourtForm((f) => ({ ...f, hasIndoor: true }))}
                    className={
                      courtForm.hasIndoor
                        ? 'bg-brand-primary hover:bg-brand-primary/90 text-white'
                        : 'text-muted-foreground'
                    }
                  >
                    Innen
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      // Step 6 – Prices & Training duration
      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Preise & Trainingsdauer</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Lege die Standardpreise und die Trainingsdauer für deinen Verein fest.
              </p>
            </div>
            <Card className="bg-blue-50/50 border-blue-200">
              <CardContent className="pt-4 text-sm text-blue-800">
                Diese Werte kannst du später in den Einstellungen anpassen und für einzelne Trainer
                oder Gruppen überschreiben.
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="hourlyRate">Standard-Stundensatz (€)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  min={0}
                  step={0.5}
                  value={priceForm.default_hourly_rate}
                  onChange={(e) =>
                    setPriceForm((f) => ({ ...f, default_hourly_rate: e.target.value }))
                  }
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">Empfohlen: 15,00 €</p>
              </div>
              <div>
                <Label htmlFor="sessionDuration">Standard-Trainingsdauer (Minuten)</Label>
                <Input
                  id="sessionDuration"
                  type="number"
                  min={15}
                  max={240}
                  step={15}
                  value={priceForm.default_session_duration_minutes}
                  onChange={(e) =>
                    setPriceForm((f) => ({
                      ...f,
                      default_session_duration_minutes: e.target.value,
                    }))
                  }
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">Empfohlen: 60 Minuten</p>
              </div>
              <div>
                <Label htmlFor="billingUnit">Abrechnungseinheit (Minuten)</Label>
                <Input
                  id="billingUnit"
                  type="number"
                  min={15}
                  max={120}
                  step={15}
                  value={priceForm.billing_unit_minutes}
                  onChange={(e) =>
                    setPriceForm((f) => ({ ...f, billing_unit_minutes: e.target.value }))
                  }
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  In welchen Schritten wird abgerechnet? (z.B. 60 = stundenweise)
                </p>
              </div>
              <div>
                <Label htmlFor="taxRate">Umsatzsteuer (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  min={0}
                  max={100}
                  value={priceForm.tax_rate}
                  onChange={(e) => setPriceForm((f) => ({ ...f, tax_rate: e.target.value }))}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  0 = umsatzsteuerbefreit (Kleinunternehmer)
                </p>
              </div>
            </div>
          </div>
        );

      // Step 7 – Fee categories (Beiträge)
      case 7:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Beitragskategorien</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Lege die Mitgliedsbeiträge und Trainingsgebühren fest. Diese werden für die
                automatische Rechnungsstellung bei Genehmigung und Saisonveröffentlichung verwendet.
              </p>
            </div>
            <Card className="bg-green-50/50 border-green-200">
              <CardContent className="pt-4 text-sm text-green-800">
                Wir haben zwei häufige Kategorien vorbereitet. Passe die Beträge an oder füge
                weitere hinzu.
              </CardContent>
            </Card>
            <div className="space-y-4">
              {feeCategories.map((cat, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_120px_100px_120px_36px] gap-2 items-end"
                >
                  <div>
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input
                      value={cat.name}
                      onChange={(e) => {
                        const updated = [...feeCategories];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setFeeCategories(updated);
                      }}
                      placeholder="z.B. Jahresmitgliedschaft"
                      className="mt-0.5"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Typ</Label>
                    <Select
                      value={cat.type}
                      onValueChange={(v) => {
                        const updated = [...feeCategories];
                        updated[idx] = { ...updated[idx], type: v };
                        setFeeCategories(updated);
                      }}
                    >
                      <SelectTrigger className="mt-0.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="membership">Mitglied</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Betrag (€)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={5}
                      value={cat.amount}
                      onChange={(e) => {
                        const updated = [...feeCategories];
                        updated[idx] = { ...updated[idx], amount: e.target.value };
                        setFeeCategories(updated);
                      }}
                      className="mt-0.5"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Zyklus</Label>
                    <Select
                      value={cat.billing_cycle}
                      onValueChange={(v) => {
                        const updated = [...feeCategories];
                        updated[idx] = { ...updated[idx], billing_cycle: v };
                        setFeeCategories(updated);
                      }}
                    >
                      <SelectTrigger className="mt-0.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yearly">Jährlich</SelectItem>
                        <SelectItem value="monthly">Monatlich</SelectItem>
                        <SelectItem value="one_time">Einmalig</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFeeCategories((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={feeCategories.length <= 1}
                    className="mb-0.5"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setFeeCategories((prev) => [
                    ...prev,
                    { name: '', type: 'training', amount: '', billing_cycle: 'one_time' },
                  ])
                }
                className="gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Weitere Kategorie
              </Button>
            </div>
          </div>
        );

      // Step 8 – Booking rules
      case 8:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Buchungsregeln</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Lege fest, wie Mitglieder Plätze buchen können.
              </p>
            </div>
            <Card className="bg-blue-50/50 border-blue-200">
              <CardContent className="pt-4 text-sm text-blue-800">
                Diese Regeln gelten für alle Mitglieder. Du kannst sie jederzeit in den
                Einstellungen anpassen.
              </CardContent>
            </Card>
            <div className="space-y-4">
              <div>
                <Label htmlFor="maxDuration">Max. Buchungsdauer (Minuten)</Label>
                <Input
                  id="maxDuration"
                  type="number"
                  min={30}
                  max={240}
                  step={15}
                  value={rulesForm.max_booking_duration_minutes}
                  onChange={(e) =>
                    setRulesForm((f) => ({
                      ...f,
                      max_booking_duration_minutes: Number(e.target.value),
                    }))
                  }
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">Empfohlen: 90 Minuten</p>
              </div>
              <div>
                <Label htmlFor="advanceDays">Vorausbuchung (Tage)</Label>
                <Input
                  id="advanceDays"
                  type="number"
                  min={1}
                  max={90}
                  value={rulesForm.advance_booking_days}
                  onChange={(e) =>
                    setRulesForm((f) => ({
                      ...f,
                      advance_booking_days: Number(e.target.value),
                    }))
                  }
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Wie viele Tage im Voraus können Mitglieder buchen?
                </p>
              </div>
              <div>
                <Label htmlFor="maxPerWeek">Max. Buchungen pro Woche</Label>
                <Input
                  id="maxPerWeek"
                  type="number"
                  min={1}
                  max={20}
                  value={rulesForm.max_bookings_per_week}
                  onChange={(e) =>
                    setRulesForm((f) => ({
                      ...f,
                      max_bookings_per_week: Number(e.target.value),
                    }))
                  }
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
        );

      // Step 9 – Invitations
      case 9:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Erste Mitglieder einladen</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Lade einen Trainer und ein Mitglied per E-Mail ein. Beides ist optional.
              </p>
            </div>

            {/* Trainer invite */}
            <Card className="border-brand-primary/20">
              <CardHeader className="pb-2">
                <Badge
                  variant="secondary"
                  className="w-fit bg-brand-primary/10 text-brand-primary border-brand-primary/20"
                >
                  Trainer
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="trainerName">Name</Label>
                    <Input
                      id="trainerName"
                      value={trainerForm.name}
                      onChange={(e) => setTrainerForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Max Mustermann"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="trainerEmail">E-Mail</Label>
                    <Input
                      id="trainerEmail"
                      type="email"
                      value={trainerForm.email}
                      onChange={(e) => setTrainerForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="trainer@beispiel.de"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Member invite */}
            <Card className="border-border">
              <CardHeader className="pb-2">
                <Badge variant="secondary" className="w-fit">
                  Mitglied
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="memberName">Name</Label>
                    <Input
                      id="memberName"
                      value={memberForm.name}
                      onChange={(e) => setMemberForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Anna Schmidt"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="memberEmail">E-Mail</Label>
                    <Input
                      id="memberEmail"
                      type="email"
                      value={memberForm.email}
                      onChange={(e) => setMemberForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="mitglied@beispiel.de"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Du kannst später im Dashboard weitere Mitglieder per CSV-Upload oder Einladungslink
              hinzufügen.
            </p>
          </div>
        );

      // Step 10 – E-Mail & Language
      case 10:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">E-Mail & Sprache</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Konfiguriere die Absender-Einstellungen für E-Mails und die bevorzugte Sprache.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="language">Sprache</Label>
                <Select
                  value={emailSettings.language}
                  onValueChange={(v) => setEmailSettings((f) => ({ ...f, language: v }))}
                >
                  <SelectTrigger id="language" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="emailFromName">Absender-Name</Label>
                <Input
                  id="emailFromName"
                  value={emailSettings.email_from_name}
                  onChange={(e) =>
                    setEmailSettings((f) => ({ ...f, email_from_name: e.target.value }))
                  }
                  placeholder="TC Beispiel e.V."
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Dieser Name erscheint als Absender bei automatischen E-Mails.
                </p>
              </div>
              <div>
                <Label htmlFor="emailFromAddress">Absender-E-Mail-Adresse</Label>
                <Input
                  id="emailFromAddress"
                  type="email"
                  value={emailSettings.email_from_address}
                  onChange={(e) =>
                    setEmailSettings((f) => ({ ...f, email_from_address: e.target.value }))
                  }
                  placeholder="noreply@verein.de"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
        );

      // Step 11 – Saison
      case 11:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Erste Saison anlegen</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Erstelle deine erste Trainings-Saison. Danach kannst du im Saisonplanungs-Wizard
                Trainergruppen zuweisen und den Stundenplan erstellen.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="seasonType">Saison-Typ</Label>
                  <Select
                    value={seasonForm.season_type}
                    onValueChange={(v: 'summer' | 'winter') => {
                      setSeasonForm((f) => ({ ...f, season_type: v }));
                      const type = v === 'summer' ? 'Sommer' : 'Winter';
                      const yr = seasonForm.year;
                      const name = v === 'winter' ? `${type} ${yr}/${yr + 1}` : `${type} ${yr}`;
                      setSeasonForm((f) => ({ ...f, season_type: v, name }));
                    }}
                  >
                    <SelectTrigger id="seasonType" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summer">☀️ Sommer</SelectItem>
                      <SelectItem value="winter">❄️ Winter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="seasonYear">Jahr</Label>
                  <Input
                    id="seasonYear"
                    type="number"
                    min={2024}
                    max={2030}
                    value={seasonForm.year}
                    onChange={(e) => {
                      const yr = parseInt(e.target.value);
                      const type = seasonForm.season_type === 'summer' ? 'Sommer' : 'Winter';
                      const name =
                        seasonForm.season_type === 'winter'
                          ? `${type} ${yr}/${yr + 1}`
                          : `${type} ${yr}`;
                      setSeasonForm((f) => ({ ...f, year: yr, name }));
                    }}
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="seasonName">Saison-Name</Label>
                <Input
                  id="seasonName"
                  value={seasonForm.name}
                  onChange={(e) => setSeasonForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="z.B. Sommer 2026"
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="seasonStart">Startdatum</Label>
                  <Input
                    id="seasonStart"
                    type="date"
                    value={seasonForm.start_date}
                    onChange={(e) => setSeasonForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="seasonEnd">Enddatum</Label>
                  <Input
                    id="seasonEnd"
                    type="date"
                    value={seasonForm.end_date}
                    onChange={(e) => setSeasonForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="mt-1.5"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const yr = seasonForm.year;
                  if (seasonForm.season_type === 'summer') {
                    setSeasonForm((f) => ({
                      ...f,
                      start_date: `${yr}-04-01`,
                      end_date: `${yr}-09-30`,
                    }));
                  } else {
                    setSeasonForm((f) => ({
                      ...f,
                      start_date: `${yr}-10-01`,
                      end_date: `${yr + 1}-03-31`,
                    }));
                  }
                }}
                className="gap-1.5"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Standard-Zeitraum einfügen
              </Button>
            </div>
          </div>
        );

      // Step 12 – Complete
      case 12:
        return (
          <div className="text-center space-y-8 py-6">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-brand-primary/10 rounded-full">
              <CheckCircle2 className="w-12 h-12 text-brand-primary" />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-foreground">Einrichtung abgeschlossen!</h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                Dein Verein ist jetzt bereit. Entdecke jetzt dein Dashboard.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
              {STEPS.slice(1, -1).map((s) => (
                <Badge
                  key={s.label}
                  variant="secondary"
                  className="gap-1.5 px-3 py-1.5 bg-brand-primary/10 border-brand-primary/20"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary" />
                  {s.label}
                </Badge>
              ))}
            </div>
            <Button
              size="lg"
              className="bg-brand-primary hover:bg-brand-primary/90 text-white px-8 shadow-lg shadow-brand-primary/20"
              onClick={goNext}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-5 w-5" />
              )}
              Zum Dashboard
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  // Optional steps: Place, Fee categories, Invitations, Email settings, Season
  const isOptionalStep = step === 5 || step === 7 || step === 9 || step === 10 || step === 11;
  // Steps where next triggers save
  const savesOnNext = step >= 3 && step <= 11;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-brand-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="border-0 shadow-xl shadow-gray-200/50 ring-1 ring-gray-100">
          <CardHeader className="pb-2">{renderStepper()}</CardHeader>

          <Separator />

          <CardContent className="pt-6">
            <div className="min-h-[420px] flex flex-col">
              <div
                className="flex-1 animate-in fade-in slide-in-from-right-4 duration-300"
                key={step}
              >
                {renderStepContent()}
              </div>
              {/* Navigation */}
              {step > 1 && step < 12 && (
                <div className="flex items-center justify-between pt-6 mt-6 border-t">
                  <Button
                    variant="ghost"
                    onClick={goBack}
                    disabled={loading}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Zurück
                  </Button>

                  <div className="flex gap-2">
                    {isOptionalStep && (
                      <Button
                        variant="outline"
                        onClick={skipStep}
                        disabled={loading}
                        className="text-muted-foreground"
                      >
                        Überspringen
                      </Button>
                    )}
                    <Button
                      onClick={goNext}
                      disabled={loading}
                      className="bg-brand-primary hover:bg-brand-primary/90 text-white shadow-md shadow-brand-primary/10"
                    >
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {savesOnNext ? (
                        <>
                          Speichern & Weiter
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Weiter
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-muted-foreground text-xs mt-4">
          Schritt {step} von {TOTAL_STEPS}
        </p>
      </div>
    </div>
  );
}
