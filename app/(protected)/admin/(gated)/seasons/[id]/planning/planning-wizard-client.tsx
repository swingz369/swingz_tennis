/**
 * 4-Schritt Saisonplanung Wizard
 *
 * Schritt 1: Konfigurieren — ReadinessCheck + Saison-Einstellungen + Mitgliederauswahl
 * Schritt 2: Trainer & Verfügbarkeit — Trainerauslastung prüfen, Präferenzen anmahnen
 * Schritt 3: Planen & Bearbeiten — Algorithmus starten → Stundenplan mit Drag & Drop editieren
 * Schritt 4: Abschließen — Konfliktprüfung + Bestätigung + Veröffentlichung
 */
'use client';

import { Component } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Settings,
  LayoutGrid,
  ClipboardCheck,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react';
import { WizardProvider, useWizard } from '@/lib/season-planning/wizard-context';
import { ConfigStep } from './steps/config-step';
import { TrainerScheduleStep } from './steps/trainer-schedule-step';
import { PlanEditStep } from './steps/plan-edit-step';
import { FinalizeStep } from './steps/finalize-step';
import { PageHeader } from '@/components/ui/page-header';

// ============================================
// STEP DEFINITIONS
// ============================================

// ============================================
// ERROR BOUNDARY
// ============================================

class StepErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-error-200 bg-error-50 p-6">
          <div className="flex flex-col items-center text-center gap-3">
            <AlertTriangle className="h-8 w-8 text-error-500" />
            <h3 className="text-lg font-semibold text-error-700">
              Ein unerwarteter Fehler ist aufgetreten
            </h3>
            <p className="text-sm text-error-600 max-w-md">
              {this.state.error?.message || 'Unbekannter Fehler'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Erneut versuchen
            </Button>
          </div>
        </Card>
      );
    }
    return this.props.children;
  }
}

const STEPS = [
  { number: 1, label: 'Konfigurieren', icon: Settings, hint: 'Daten prüfen & einstellen' },
  {
    number: 2,
    label: 'Trainer & Verfügbarkeit',
    icon: Users,
    hint: 'Trainerauslastung prüfen',
  },
  { number: 3, label: 'Planen', icon: LayoutGrid, hint: 'Plan generieren & bearbeiten' },
  {
    number: 4,
    label: 'Abschließen',
    icon: ClipboardCheck,
    hint: 'Konflikte prüfen & bestätigen',
  },
];

// ============================================
// PROPS
// ============================================

interface PlanningWizardClientProps {
  seasonId: string;
  clubId: string;
  seasonName: string;
  seasonType: string;
  seasonYear: number;
  planningStatus: string;
  initialStep?: number;
}

// ============================================
// WIZARD CONTENT (inner component with context)
// ============================================

function WizardContent({
  seasonName,
  seasonType,
  seasonYear,
}: {
  seasonName: string;
  seasonType: string;
  seasonYear: number;
}) {
  const router = useRouter();
  const { state, nextStep, prevStep, goToStep } = useWizard();
  const { currentStep, isProcessing, error } = state;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <ConfigStep />;
      case 2:
        return <TrainerScheduleStep />;
      case 3:
        return <PlanEditStep />;
      case 4:
        return <FinalizeStep />;
      default:
        return <ConfigStep />;
    }
  };

  // scheduleSlots ist auch dann gefüllt, wenn der Plan nach einem Reload aus
  // season_plan_entries wiederhergestellt wurde statt frisch geclustert (siehe
  // PlanEditStep) — clusteringResult allein wäre nach einem Reload immer leer.
  const hasPlan = !!state.clusteringResult || state.scheduleSlots.length > 0;
  const canGoNext =
    currentStep < 4 && !(currentStep === 1 && !state.isReady) && !(currentStep === 3 && !hasPlan);
  const canGoPrev = currentStep > 1;
  const isLast = currentStep === 4;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${seasonType === 'summer' ? '☀️' : '❄️'} ${seasonName}`}
        back={{ href: '/admin/seasons', label: 'Zurück zur Saisonübersicht' }}
        description="Automatische Saisonplanung"
        badge={
          <Badge variant="secondary" className="text-xs">
            {seasonYear}
          </Badge>
        }
      />

      {/* Step Navigation */}
      <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Wizard steps">
        {STEPS.map((step) => {
          const StepIcon = step.icon;
          const isActive = step.number === currentStep;
          const isCompleted = step.number < currentStep;
          const isClickable = step.number <= state.maxReachedStep;

          return (
            <button
              key={step.number}
              onClick={() => isClickable && goToStep(step.number as any)}
              disabled={!isClickable || isProcessing}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                ${
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : isCompleted
                      ? 'bg-success-50 text-success-700'
                      : isClickable
                        ? 'bg-muted text-muted-foreground hover:bg-muted dark:bg-muted dark:text-foreground'
                        : 'bg-muted text-muted-foreground cursor-not-allowed dark:bg-muted/50'
                }
              `}
            >
              {isCompleted ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <StepIcon className={`h-4 w-4 ${isActive ? 'text-white' : ''}`} />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Step Progress Bar */}
      <div className="h-1.5 w-full rounded-full bg-muted dark:bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${(currentStep / 4) * 100}%` }}
        />
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-error-200 bg-error-50 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-error-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-error-700">Fehler</p>
              <p className="text-sm text-error-600 mt-0.5">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Step Content */}
      <div className="min-h-[400px]">
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Berechnung läuft...</p>
          </div>
        ) : (
          <StepErrorBoundary key={currentStep}>{renderStep()}</StepErrorBoundary>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t pt-6">
        <Button variant="outline" onClick={prevStep} disabled={!canGoPrev || isProcessing}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Zurück
        </Button>

        <div className="flex items-center gap-2">
          {!isLast ? (
            <>
              {currentStep === 1 && !state.isReady ? (
                <p className="text-xs text-warning-600 mr-2">
                  Bereitschaftsprüfung nicht bestanden — Schritt 1 muss komplett sein
                </p>
              ) : currentStep === 3 && !hasPlan ? (
                <p className="text-xs text-warning-600 mr-2">
                  Plan muss erst generiert werden — Button in Schritt 3
                </p>
              ) : null}
              <Button onClick={nextStep} disabled={!canGoNext || isProcessing}>
                {currentStep === 1
                  ? 'Zu Trainer & Verfügbarkeit'
                  : currentStep === 2
                    ? 'Zu Planung'
                    : 'Zu Abschluss'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              onClick={() => router.push(`/admin/seasons/${state.seasonId}`)}
              variant="primary"
            >
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Zur Saisonübersicht
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PlanningWizardClient({
  seasonId,
  clubId,
  seasonName,
  seasonType,
  seasonYear,
  initialStep,
}: PlanningWizardClientProps) {
  return (
    <WizardProvider seasonId={seasonId} clubId={clubId} initialStep={initialStep}>
      <WizardContent seasonName={seasonName} seasonType={seasonType} seasonYear={seasonYear} />
    </WizardProvider>
  );
}
