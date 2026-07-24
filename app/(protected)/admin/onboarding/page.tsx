'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  Building2,
  MapPin,
  Users,
  PartyPopper,
  Circle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

type ClubData = { id: string; name: string; city?: string };

const TOTAL_STEPS = 4;

const STEPS = [
  { label: 'Verein', icon: Building2 },
  { label: 'Platz', icon: MapPin },
  { label: 'Einladen', icon: Users },
  { label: 'Fertig', icon: PartyPopper },
];

/* eslint-disable react-hooks/preserve-manual-memoization -- multi-step form, compiler cannot preserve memoization */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [club, setClub] = useState<ClubData | null>(null);

  const [clubForm, setClubForm] = useState({ name: '', city: '' });
  const [courtForm, setCourtForm] = useState({
    name: 'Platz 1',
    surface: 'sand',
    hasIndoor: false,
  });
  const [trainerForm, setTrainerForm] = useState({ name: '', email: '' });

  useEffect(() => {
    apiFetch('/api/me').then(async (r) => {
      if (!r.ok) return;
      const me = await r.json();
      if (!me?.clubId) return;
      const clubRes = await apiFetch(`/api/clubs/${me.clubId}`);
      if (!clubRes.ok) return;
      const data = await clubRes.json();
      setClub({ id: me.clubId, name: data.name ?? '', city: data.city ?? '' });
      setClubForm({ name: data.name ?? '', city: data.city ?? '' });
    });
  }, []);

  const saveClubData = useCallback(async (): Promise<boolean> => {
    if (!club?.id) return false;
    if (!clubForm.name.trim() || !clubForm.city.trim()) {
      toast.error('Vereinsname und Stadt sind erforderlich');
      return false;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clubs/${club.id}/setup`, {
        method: 'PATCH',
        body: JSON.stringify({ name: clubForm.name, city: clubForm.city }),
      });
      if (!res.ok) {
        toast.error((await res.json()).error ?? 'Fehler beim Speichern der Vereinsdaten');
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

  const saveCourtData = useCallback(async (): Promise<boolean> => {
    if (!club?.id || !courtForm.name.trim()) return true;
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
        toast.error((await res.json()).error ?? 'Fehler beim Anlegen des Platzes');
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
        toast.error((await res.json()).error ?? 'Fehler beim Einladen des Trainers');
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

  const goNext = async () => {
    switch (step) {
      case 1: {
        const ok = await saveClubData();
        if (!ok) return;
        break;
      }
      case 2: {
        const ok = await saveCourtData();
        if (!ok) return;
        break;
      }
      case 3: {
        const ok = await saveTrainerInvite();
        if (!ok) return;
        break;
      }
      case 4: {
        const ok = await markSetupComplete();
        if (!ok) return;
        router.push('/admin');
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));
  const skipStep = () => setStep((s) => s + 1);

  const isOptionalStep = step === 2 || step === 3;

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

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Willkommen bei SwingZ!</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Richte deinen Verein in 3 Schritten ein. Alle weiteren Einstellungen kannst du
                danach im Dashboard konfigurieren.
              </p>
            </div>
            <div className="space-y-4">
              <div>
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
                <Label htmlFor="clubCity">Stadt *</Label>
                <Input
                  id="clubCity"
                  value={clubForm.city}
                  onChange={(e) => setClubForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="München"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Ersten Platz anlegen</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Füge deinen ersten Tennisplatz hinzu. Du kannst diesen Schritt auch überspringen.
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

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Ersten Trainer einladen</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Lade deinen ersten Trainer per E-Mail ein. Dieser Schritt ist optional.
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
            <p className="text-xs text-muted-foreground">
              Du kannst später im Dashboard beliebig viele Trainer und Mitglieder per E-Mail
              einladen.
            </p>
          </div>
        );

      case 4:
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-brand-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="border-0 shadow-xl shadow-gray-200/50 ring-1 ring-gray-100">
          <CardHeader className="pb-2">{renderStepper()}</CardHeader>

          <Separator />

          <CardContent className="pt-6">
            <div className="min-h-[380px] flex flex-col">
              <div
                className="flex-1 animate-in fade-in slide-in-from-right-4 duration-300"
                key={step}
              >
                {renderStepContent()}
              </div>

              {step < 4 && (
                <div className="flex items-center justify-between pt-6 mt-6 border-t">
                  {step > 1 ? (
                    <Button
                      variant="ghost"
                      onClick={goBack}
                      disabled={loading}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Zurück
                    </Button>
                  ) : (
                    <div />
                  )}

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
                      {step === 1 ? 'Speichern & Weiter' : 'Weiter'}
                      <ChevronRight className="ml-1 h-4 w-4" />
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
