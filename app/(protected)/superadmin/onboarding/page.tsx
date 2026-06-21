'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Zap,
  Layout,
  Building2,
  Users,
  PartyPopper,
  ArrowRight,
  Circle,
  Sparkles,
  ArrowLeftRight,
  BarChart3,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

const TOTAL_STEPS = 4;

const STEPS = [
  { label: 'Start', icon: Sparkles },
  { label: 'Plattform-Tour', icon: Layout },
  { label: 'Erster Verein', icon: Building2 },
  { label: 'Fertig', icon: PartyPopper },
];

export default function SuperadminOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 3 – First club
  const [clubForm, setClubForm] = useState({ name: '', city: '' });
  const [createdClubId, setCreatedClubId] = useState<string | null>(null);

  const markSetupComplete = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/users/superadmin-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }, []);

  const goNext = async () => {
    if (step === 4) {
      const ok = await markSetupComplete();
      if (!ok) return;
      router.push('/superadmin');
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

  const handleCreateClub = async () => {
    if (!clubForm.name.trim()) {
      toast.error('Bitte gib einen Vereinsnamen ein');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clubForm.name,
          city: clubForm.city || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Fehler beim Erstellen des Vereins');
        return;
      }
      const data = await res.json();
      setCreatedClubId(data.clubId);
      toast.success('Verein erstellt!');
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToClub = async () => {
    if (!createdClubId) return;
    setLoading(true);
    try {
      // Set the admin club cookie and redirect
      const res = await apiFetch('/api/admin/switch-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId: createdClubId }),
      });
      if (res.ok) {
        const setupOk = await markSetupComplete();
        if (!setupOk) return;
        // Reload to pick up new cookie
        window.location.href = '/admin';
        return;
      }
      toast.error('Fehler beim Wechseln zum Verein');
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
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
                      isCompleted ? 'bg-purple-600' : 'bg-muted'
                    }`}
                  />
                )}
                <div
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                      : isCurrent
                        ? 'bg-purple-600 text-white ring-4 ring-purple-600/20 shadow-lg shadow-purple-600/30 scale-110'
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
                      ? 'text-purple-600 font-semibold'
                      : isCompleted
                        ? 'text-purple-600/70'
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
      case 1:
        return (
          <div className="text-center space-y-8 py-6">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-purple-100 rounded-full">
              <Zap className="w-12 h-12 text-purple-600" />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-foreground">
                Willkommen auf der SwingZ-Plattform!
              </h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                Als{' '}
                <Badge
                  variant="secondary"
                  className="mx-1 bg-purple-100 text-purple-700 border-purple-200"
                >
                  Superadmin
                </Badge>{' '}
                verwaltest du die gesamte Plattform – alle Vereine, Admins und Einstellungen auf
                einen Blick.
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
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 shadow-lg shadow-purple-600/20"
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
              <h2 className="text-2xl font-bold text-foreground">Plattform-Tour</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Hier ist, was du als Superadmin alles tun kannst:
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-purple-200 bg-purple-50/30">
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-sm">Dashboard</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Plattformweite Kennzahlen: Mitglieder, Buchungen, Umsatz aller Vereine auf einen
                    Blick.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-purple-200 bg-purple-50/30">
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-sm">Vereinsübersicht</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Alle Vereine verwalten, Statistiken einsehen und Club-Details bearbeiten.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-purple-200 bg-purple-50/30">
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <Users className="w-4 h-4 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-sm">Club-Verwaltung</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Neue Vereine anlegen, Admins zuweisen und Club-Einstellungen konfigurieren.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-purple-200 bg-purple-50/30">
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <ArrowLeftRight className="w-4 h-4 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-sm">Club-Wechsel</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    In die Admin-Rolle eines beliebigen Vereins schlüpfen, um direkt zu helfen.
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card className="bg-purple-50/50 border-purple-200">
              <CardContent className="pt-4 text-sm text-purple-800">
                <strong>Tipp:</strong> Du kannst jederzeit zwischen deiner Superadmin-Ansicht und
                der Admin-Ansicht einzelner Vereine wechseln.
              </CardContent>
            </Card>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Ersten Verein anlegen</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Erstelle deinen ersten Tennisverein – oder überspringe diesen Schritt.
              </p>
            </div>

            {createdClubId ? (
              <div className="text-center space-y-6 py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Verein &quot;{clubForm.name}&quot; wurde erstellt!
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Möchtest du jetzt als Admin in diesen Verein wechseln und ihn einrichten?
                  </p>
                </div>
                <div className="flex justify-center gap-3">
                  <Button
                    onClick={handleSwitchToClub}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowLeftRight className="mr-2 h-4 w-4" />
                    )}
                    Als Admin einrichten
                  </Button>
                  <Button variant="outline" onClick={skipStep} className="text-muted-foreground">
                    Später
                  </Button>
                </div>
              </div>
            ) : (
              <>
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
                    <Label htmlFor="clubCity">Stadt</Label>
                    <Input
                      id="clubCity"
                      value={clubForm.city}
                      onChange={(e) => setClubForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder="München"
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleCreateClub}
                    disabled={loading || !clubForm.name.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Verein erstellen
                  </Button>
                </div>
              </>
            )}

            <p className="text-xs text-muted-foreground">
              Du kannst diesen Schritt überspringen und später Vereine im Club-Management anlegen.
            </p>
          </div>
        );

      case 4:
        return (
          <div className="text-center space-y-8 py-6">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-purple-100 rounded-full">
              <CheckCircle2 className="w-12 h-12 text-purple-600" />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-foreground">
                Superadmin-Setup abgeschlossen!
              </h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                Du bist bereit, die Plattform zu verwalten. Entdecke jetzt dein Dashboard.
              </p>
            </div>
            <div className="flex justify-center gap-3 text-sm text-muted-foreground">
              {STEPS.slice(1, -1).map((s) => (
                <Badge
                  key={s.label}
                  variant="secondary"
                  className="gap-1.5 px-3 py-1.5 bg-purple-100 border-purple-200"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                  {s.label}
                </Badge>
              ))}
            </div>
            <Button
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 shadow-lg shadow-purple-600/20"
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

  const isOptionalStep = step === 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="border-0 shadow-xl shadow-gray-200/50 ring-1 ring-gray-100">
          <CardHeader className="pb-2">{renderStepper()}</CardHeader>

          <Separator />

          <CardContent className="pt-6">
            <div className="min-h-[340px] flex flex-col">
              <div
                className="flex-1 animate-in fade-in slide-in-from-right-4 duration-300"
                key={step}
              >
                {renderStepContent()}
              </div>
              {/* Navigation */}
              {step > 1 && step < 4 && (
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
                      className="bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/10"
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

        <p className="text-center text-muted-foreground text-xs mt-4">
          Schritt {step} von {TOTAL_STEPS}
        </p>
      </div>
    </div>
  );
}
