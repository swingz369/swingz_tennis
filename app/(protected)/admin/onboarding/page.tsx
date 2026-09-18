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
import { BUNDESLAND_NAMES } from '@/lib/season-planning/holidays';
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Building2,
  LayoutGrid,
  PartyPopper,
  Circle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { ModuleSelectionStep } from '@/components/onboarding/module-selection-step';

type ClubData = { id: string; name: string; city?: string };

/**
 * Erstlogin-Wizard des Admins.
 *
 * Bewusst kurz: hier steht nur, was ohne Eingabe gar nicht funktioniert —
 * Vereinsstammdaten (das Bundesland bestimmt die Ferien der Saisonplanung)
 * und die Modulauswahl (bestimmt, was der Verein überhaupt sieht).
 *
 * Plätze, Trainer, Mitglieder, Beitragskategorien und die erste Saison sind
 * Arbeit, keine Blocker. Die stehen als Einrichtungs-Checkliste auf dem
 * Dashboard (`lib/setup-checklist.ts`) und werden dort aus den Daten
 * abgeleitet — ein Wizard, der beim Neuladen wieder bei Null anfängt, wäre
 * dafür der falsche Ort.
 */

const TOTAL_STEPS = 3;

const STEPS = [
  { label: 'Verein', icon: Building2 },
  { label: 'Module', icon: LayoutGrid },
  { label: 'Fertig', icon: PartyPopper },
];

/* eslint-disable react-hooks/preserve-manual-memoization -- multi-step form, compiler cannot preserve memoization */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [club, setClub] = useState<ClubData | null>(null);

  const [clubForm, setClubForm] = useState({ name: '', city: '', bundesland: '' });

  useEffect(() => {
    apiFetch('/api/me').then(async (r) => {
      if (!r.ok) return;
      const me = await r.json();
      if (!me?.clubId) return;
      const clubRes = await apiFetch(`/api/clubs/${me.clubId}`);
      if (!clubRes.ok) return;
      const data = await clubRes.json();
      setClub({ id: me.clubId, name: data.name ?? '', city: data.city ?? '' });
      setClubForm({
        name: data.name ?? '',
        city: data.city ?? '',
        bundesland: data.bundesland ?? '',
      });
    });
  }, []);

  const saveClubData = useCallback(async (): Promise<boolean> => {
    if (!club?.id) return false;
    if (!clubForm.name.trim() || !clubForm.city.trim()) {
      toast.error('Vereinsname und Stadt sind erforderlich');
      return false;
    }
    // Ohne Bundesland kennt die Saisonplanung die Schulferien nicht und legt
    // Trainingstermine mitten in die Weihnachtsferien.
    if (!clubForm.bundesland) {
      toast.error('Bitte das Bundesland wählen — davon hängen die Ferientermine ab');
      return false;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clubs/${club.id}/setup`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: clubForm.name,
          city: clubForm.city,
          bundesland: clubForm.bundesland,
        }),
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
    if (step === 1) {
      const ok = await saveClubData();
      if (!ok) return;
      setStep(2);
    }
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  // Schritt 2 speichert über den eigenen Button der Modulauswahl. Erst danach
  // gilt das Setup als abgeschlossen — schlägt das fehl, bleibt der Admin im
  // Wizard und kann es erneut versuchen, statt in einem halb eingerichteten
  // Verein zu landen.
  const handleModulesSaved = async () => {
    const ok = await markSetupComplete();
    if (ok) setStep(3);
  };

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
                      isCompleted ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
                <div
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : isCurrent
                        ? 'bg-primary text-white ring-4 ring-primary/20 shadow-lg shadow-primary/30 scale-110'
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
                      ? 'text-primary font-semibold'
                      : isCompleted
                        ? 'text-primary/70'
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
                Drei Angaben, dann geht es los. Plätze, Trainer und Mitglieder legst du danach
                direkt im Dashboard an — die Einrichtungs-Checkliste führt dich durch.
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
              <div>
                <Label htmlFor="clubBundesland">Bundesland *</Label>
                <Select
                  value={clubForm.bundesland}
                  onValueChange={(value) => setClubForm((f) => ({ ...f, bundesland: value }))}
                >
                  <SelectTrigger id="clubBundesland" className="mt-1.5">
                    <SelectValue placeholder="Bundesland wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(BUNDESLAND_NAMES).map((bl) => (
                      <SelectItem key={bl} value={bl}>
                        {bl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs mt-1.5">
                  Bestimmt die Schulferien, die die Saisonplanung aussparen soll.
                </p>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Module wählen</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Bestimmt, was dein Verein in der App sieht. Jederzeit änderbar unter Einstellungen →
                Module.
              </p>
            </div>
            {club?.id ? (
              <ModuleSelectionStep
                clubId={club.id}
                continueLabel="Speichern & fertig"
                onSaved={handleModulesSaved}
                // Im Wizard NICHT pro Klick speichern: `onSaved` schaltet hier
                // den Schritt weiter — das würde beim ersten Häkchen passieren.
                autoSave={false}
              />
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="text-center space-y-8 py-6">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-primary/10 rounded-full">
              <CheckCircle2 className="w-12 h-12 text-primary" />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-foreground">Verein angelegt!</h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                Weiter geht es mit den Plätzen — danach Trainer und Mitglieder. Erst wenn die drei
                stehen, lässt sich eine Saison planen. Die Checkliste auf dem Dashboard führt dich
                durch.
              </p>
            </div>
            {/* Direkt in den ersten Schritt statt auf ein Dashboard, auf dem der
                Admin die Checkliste erst suchen muss. */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-white px-8 shadow-lg shadow-primary/20"
                onClick={() => router.push('/admin/courts')}
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Plätze anlegen
              </Button>
              <Button size="lg" variant="ghost" onClick={() => router.push('/admin')}>
                Zum Dashboard
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-gray-50 via-white to-primary/5 flex items-center justify-center p-4">
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

              {step < TOTAL_STEPS && (
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

                  {/* Schritt 2 hat seinen Weiter-Button in der Modulauswahl —
                      sonst stünden zwei Primärbuttons nebeneinander. */}
                  {step === 1 && (
                    <Button
                      onClick={goNext}
                      disabled={loading}
                      className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/10"
                    >
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Speichern & Weiter
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Der letzte Schritt ist nur die Abschlussmeldung — mitgezählt
            widerspräche er dem "zwei Schritte" in der Überschrift. */}
        {step < TOTAL_STEPS && (
          <p className="text-center text-muted-foreground text-xs mt-4">
            Schritt {step} von {TOTAL_STEPS - 1}
          </p>
        )}
      </div>
    </div>
  );
}
