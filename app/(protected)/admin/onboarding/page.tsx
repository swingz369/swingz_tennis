'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';

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

const STEP_LABELS = [
  'Willkommen',
  'Vereinsdaten',
  'Platz anlegen',
  'Buchungsregeln',
  'Trainer einladen',
  'Fertig',
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
        // Get current user's club via memberships
        const meRes = await fetch('/api/me');
        if (!meRes.ok) return;
        const me = await meRes.json();
        const clubId = me?.clubId;
        if (!clubId) return;

        // Fetch club details
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

        // Load booking rules
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
    if (!courtForm.name.trim()) return true; // skip empty
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
    if (!trainerForm.email.trim()) return true; // skipped
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

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const skipStep = () => setStep((s) => s + 1);

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderProgressBar = () => (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-2">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < step;
          const isCurrent = stepNum === step;
          return (
            <div key={stepNum} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                      ? 'bg-green-600 text-white ring-2 ring-green-300'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : stepNum}
              </div>
              <span
                className={`text-xs hidden sm:block ${
                  isCurrent ? 'text-green-700 font-medium' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-1 bg-gray-200 rounded-full mt-1">
        <div
          className="h-1 bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
        />
      </div>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="text-center space-y-6 py-8">
            <div className="flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mx-auto">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Willkommen bei SwingZ!</h2>
              <p className="text-gray-500 mt-3 text-lg">
                Richte deinen Verein in wenigen Schritten ein
              </p>
              <p className="text-gray-400 mt-2 text-sm">
                Dieser Assistent führt dich durch alle wichtigen Einstellungen.
              </p>
            </div>
            <Button
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white px-8"
              onClick={() => setStep(2)}
            >
              Los geht&apos;s
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
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
                />
              </div>
              <div>
                <Label htmlFor="clubCity">Stadt</Label>
                <Input
                  id="clubCity"
                  value={clubForm.city}
                  onChange={(e) => setClubForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="München"
                />
              </div>
              <div>
                <Label htmlFor="clubAddress">Adresse</Label>
                <Input
                  id="clubAddress"
                  value={clubForm.address}
                  onChange={(e) => setClubForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Musterstraße 1"
                />
              </div>
              <div>
                <Label htmlFor="clubPhone">Telefon</Label>
                <Input
                  id="clubPhone"
                  value={clubForm.phone}
                  onChange={(e) => setClubForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+49 89 123456"
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
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="clubWebsite">Website</Label>
                <Input
                  id="clubWebsite"
                  value={clubForm.website}
                  onChange={(e) => setClubForm((f) => ({ ...f, website: e.target.value }))}
                  placeholder="https://www.verein.de"
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Ersten Platz anlegen</h2>
              <p className="text-gray-500 text-sm mt-1">
                Füge deinen ersten Tennisplatz hinzu. Du kannst weitere Plätze später in der
                Platzverwaltung ergänzen.
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
                />
              </div>
              <div>
                <Label htmlFor="courtSurface">Belag</Label>
                <Select
                  value={courtForm.surface}
                  onValueChange={(v) => setCourtForm((f) => ({ ...f, surface: v }))}
                >
                  <SelectTrigger id="courtSurface">
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
                <div className="flex gap-3 mt-1">
                  <Button
                    type="button"
                    variant={courtForm.hasIndoor ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => setCourtForm((f) => ({ ...f, hasIndoor: false }))}
                    className={
                      !courtForm.hasIndoor
                        ? 'bg-green-600 hover:bg-green-700 text-white'
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
                        ? 'bg-green-600 hover:bg-green-700 text-white'
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
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Buchungsregeln</h2>
              <p className="text-gray-500 text-sm mt-1">
                Lege fest, wie lange Mitglieder Plätze buchen dürfen und wie weit im Voraus.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              Diese Regeln gelten für alle Mitglieder deines Vereins. Du kannst sie jederzeit in den
              Einstellungen anpassen.
            </div>
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
                />
                <p className="text-xs text-gray-400 mt-1">
                  Empfohlen: 90 Minuten (Standard für Tennisspiele)
                </p>
              </div>
              <div>
                <Label htmlFor="advanceDays">Vorasbuchung (Tage)</Label>
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
                />
                <p className="text-xs text-gray-400 mt-1">
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
                />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Ersten Trainer einladen</h2>
              <p className="text-gray-500 text-sm mt-1">
                Lade deinen ersten Trainer ein. Dieser erhält eine E-Mail-Einladung.
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
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Du kannst diesen Schritt überspringen und Trainer später über die Trainerverwaltung
              einladen.
            </p>
          </div>
        );

      case 6:
        return (
          <div className="text-center space-y-6 py-8">
            <div className="flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Einrichtung abgeschlossen!</h2>
              <p className="text-gray-500 mt-3 text-lg">
                Dein Verein ist jetzt bereit. Du kannst das Dashboard erkunden.
              </p>
            </div>
            <Button
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white px-8"
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {renderProgressBar()}

          <div className="min-h-[320px] flex flex-col">
            <div className="flex-1">{renderStep()}</div>

            {/* Navigation buttons */}
            {step > 1 && step < 6 && (
              <div className="flex items-center justify-between pt-6 mt-6 border-t">
                <Button
                  variant="ghost"
                  onClick={goBack}
                  disabled={loading}
                  className="text-gray-500"
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
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Weiter
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-gray-400 text-xs mt-4">
          Schritt {step} von {TOTAL_STEPS}
        </p>
      </div>
    </div>
  );
}
