'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  MapPin,
  CalendarRange,
  Users,
  PartyPopper,
  ArrowRight,
  Circle,
  Sparkles,
} from 'lucide-react';

type ClubData = {
  id: string;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
};

const TOTAL_STEPS = 6;

const STEPS = [
  { label: 'Start', icon: Sparkles },
  { label: 'Verein', icon: Building2 },
  { label: 'Platz', icon: MapPin },
  { label: 'Regeln', icon: CalendarRange },
  { label: 'Trainer', icon: Users },
  { label: 'Fertig', icon: PartyPopper },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [club, setClub] = useState<ClubData | null>(null);
  // Step 2 – Club data
  const [clubForm, setClubForm] = useState({
    name: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    website: '',
  });

  // Step 3 – Court
  const [courtForm, setCourtForm] = useState({
    name: 'Platz 1',
    surface: 'sand',
    hasIndoor: false,
  });

  // Step 4 – Booking rules
  const [rulesForm, setRulesForm] = useState({
    max_booking_duration_minutes: 90,
    advance_booking_days: 14,
    max_bookings_per_week: 3,
  });

  // Step 5 – Trainer invite
  const [trainerForm, setTrainerForm] = useState({ name: '', email: '' });

  // Load club data on mount
  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch('/api/me');
        if (!meRes.ok) return;
        const me = await meRes.json();
        const clubId = me?.clubId;
        if (!clubId) return;

        const res = await fetch(`/api/clubs/${clubId}`);
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
        });

        const rulesRes = await fetch('/api/booking-rules');
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

  const saveClubData = useCallback(async () => {
    if (!club?.id) return false;
    setLoading(true);
    try {
      const res = await fetch(`/api/clubs/${club.id}/setup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clubForm),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Fehler beim Speichern der Vereinsdaten');
        return false;
      }
      return true;
    } catch {
      toast.error('Netzwerkfehler');
      return false;
    } finally {
      setLoading(false);
    }
  }, [club?.id, clubForm]);

  const saveCourtData = useCallback(async () => {
    if (!courtForm.name.trim()) return true;
    setLoading(true);
    try {
      const res = await fetch('/api/courts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }, [courtForm]);

  const saveBookingRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/booking-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }, [rulesForm]);

  const saveTrainerInvite = useCallback(async () => {
    if (!trainerForm.email.trim()) return true;
    setLoading(true);
    try {
      const res = await fetch('/api/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const markSetupComplete = useCallback(async () => {
    if (!club?.id) return;
    setLoading(true);
    try {
      await fetch(`/api/clubs/${club.id}/setup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup_completed_at: new Date().toISOString() }),
      });
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, [club?.id]);

  const goNext = async () => {
    if (step === 2) {
      const ok = await saveClubData();
      if (!ok) return;
    } else if (step === 3) {
      const ok = await saveCourtData();
      if (!ok) return;
    } else if (step === 4) {
      const ok = await saveBookingRules();
      if (!ok) return;
    } else if (step === 5) {
      const ok = await saveTrainerInvite();
      if (!ok) return;
    } else if (step === 6) {
      await markSetupComplete();
      router.push('/admin');
      return;
    }
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const skipStep = () => {
    setStep((s) => s + 1);
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
                {/* Connector line (except last) */}
                {stepNum < TOTAL_STEPS && (
                  <div
                    className={`absolute top-5 left-full h-0.5 w-[calc(100%+0.5rem)] -translate-y-1/2 transition-colors duration-500 ${
                      isCompleted ? 'bg-brand-primary' : 'bg-gray-200'
                    }`}
                  />
                )}

                {/* Circle */}
                <div
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
                      : isCurrent
                        ? 'bg-brand-primary text-white ring-4 ring-brand-primary/20 shadow-lg shadow-brand-primary/30 scale-110'
                        : 'bg-white border-2 border-gray-200 text-gray-400'
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

                {/* Label */}
                <span
                  className={`text-xs font-medium whitespace-nowrap hidden sm:block transition-colors duration-300 ${
                    isCurrent
                      ? 'text-brand-primary font-semibold'
                      : isCompleted
                        ? 'text-brand-primary/70'
                        : 'text-gray-400'
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
      case 1:
        return (
          <div className="text-center space-y-8 py-6">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-brand-primary/10 rounded-full">
              <Zap className="w-12 h-12 text-brand-primary" />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-gray-900">Willkommen bei SwingZ!</h2>
              <p className="text-gray-500 text-lg max-w-md mx-auto">
                Richte deinen Verein in wenigen Minuten ein – Schritt für Schritt.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 text-sm text-gray-500">
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

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Vereinsdaten</h2>
              <p className="text-gray-500 text-sm mt-1">
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
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Ersten Platz anlegen</h2>
              <p className="text-gray-500 text-sm mt-1">
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
                        : 'text-gray-600'
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
                        : 'text-gray-600'
                    }
                  >
                    Innen
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Buchungsregeln</h2>
              <p className="text-gray-500 text-sm mt-1">
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
                <p className="text-xs text-gray-400 mt-1.5">Empfohlen: 90 Minuten</p>
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
                <p className="text-xs text-gray-400 mt-1.5">
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

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Ersten Trainer einladen</h2>
              <p className="text-gray-500 text-sm mt-1">
                Lade deinen ersten Trainer per E-Mail ein.
              </p>
            </div>
            <div className="space-y-4">
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
            <p className="text-xs text-gray-400">
              Du kannst diesen Schritt überspringen und Trainer später einladen.
            </p>
          </div>
        );

      case 6:
        return (
          <div className="text-center space-y-8 py-6">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-brand-primary/10 rounded-full">
              <CheckCircle2 className="w-12 h-12 text-brand-primary" />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-gray-900">Einrichtung abgeschlossen!</h2>
              <p className="text-gray-500 text-lg max-w-md mx-auto">
                Dein Verein ist jetzt bereit. Entdecke jetzt dein Dashboard.
              </p>
            </div>
            <div className="flex justify-center gap-3 text-sm text-gray-500">
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

  const isOptionalStep = step === 3 || step === 5;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-brand-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="border-0 shadow-xl shadow-gray-200/50 ring-1 ring-gray-100">
          <CardHeader className="pb-2">{renderStepper()}</CardHeader>

          <Separator />

          <CardContent className="pt-6">
            <div className="min-h-[340px] flex flex-col">
              {' '}
              <div
                className="flex-1 animate-in fade-in slide-in-from-right-4 duration-300"
                key={step}
              >
                {renderStepContent()}
              </div>
              {/* Navigation */}
              {step > 1 && step < 6 && (
                <div className="flex items-center justify-between pt-6 mt-6 border-t">
                  <Button
                    variant="ghost"
                    onClick={goBack}
                    disabled={loading}
                    className="text-gray-500 hover:text-gray-700"
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
                        className="text-gray-500"
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
                      Weiter
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-gray-400 text-xs mt-4">
          Schritt {step} von {TOTAL_STEPS}
        </p>
      </div>
    </div>
  );
}
