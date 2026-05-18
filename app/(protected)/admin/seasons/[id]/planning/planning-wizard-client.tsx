'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  ArrowLeft,
  Users,
  FileCheck,
  UserCheck,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  ClipboardCheck,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { WizardProvider, useWizard } from '@/lib/season-planning/wizard-context';
import { MemberSelector } from './steps/member-selector';
import { PreferenceSummary } from './steps/preference-summary';
import { TrainerAvailability } from './steps/trainer-availability';
import { ClusteringResult } from './steps/clustering-result';
import { ConflictReview } from './steps/conflict-review';
import { ConfirmationStep } from './steps/confirmation-step';

// ============================================
// STEP DEFINITIONS
// ============================================

const STEPS = [
  { number: 1, label: 'Mitglieder', icon: Users },
  { number: 2, label: 'Präferenzen', icon: FileCheck },
  { number: 3, label: 'Trainer', icon: UserCheck },
  { number: 4, label: 'Clustering', icon: Sparkles },
  { number: 5, label: 'Review', icon: AlertTriangle },
  { number: 6, label: 'Bestätigung', icon: CheckCircle },
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
        return <MemberSelector />;
      case 2:
        return <PreferenceSummary />;
      case 3:
        return <TrainerAvailability />;
      case 4:
        return <ClusteringResult />;
      case 5:
        return <ConflictReview />;
      case 6:
        return <ConfirmationStep />;
      default:
        return <MemberSelector />;
    }
  };

  const canGoNext = currentStep < 6;
  const canGoPrev = currentStep > 1;
  const isLast = currentStep === 6;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin/seasons')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {seasonType === 'summer' ? '☀️' : '❄️'}
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {seasonName}
              </h1>
              <Badge variant="secondary" className="text-xs">
                {seasonYear}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              KI-gestützte Saisonplanung
            </p>
          </div>
        </div>
      </div>

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
                    ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
                    : isCompleted
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                    : isClickable
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                    : 'bg-gray-50 text-gray-400 cursor-not-allowed dark:bg-gray-800/50'
                }
              `}
            >
              {isCompleted ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <StepIcon
                  className={`h-4 w-4 ${
                    isActive ? 'text-white' : ''
                  }`}
                />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Step Progress Bar */}
      <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-primary transition-all duration-500"
          style={{ width: `${(currentStep / 6) * 100}%` }}
        />
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Fehler
              </p>
              <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">
                {error}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Step Content */}
      <div className="min-h-[400px]">
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-brand-primary" />
            <p className="text-sm text-muted-foreground">
              Berechnung läuft...
            </p>
          </div>
        ) : (
          renderStep()
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t pt-6">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={!canGoPrev || isProcessing}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Zurück
        </Button>

        <div className="flex items-center gap-2">
          {!isLast ? (
            <Button onClick={nextStep} disabled={!canGoNext || isProcessing}>
              Weiter
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => router.push('/admin/seasons')}
              variant="brand"
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
}: PlanningWizardClientProps) {
  return (
    <WizardProvider seasonId={seasonId} clubId={clubId}>
      <WizardContent
        seasonName={seasonName}
        seasonType={seasonType}
        seasonYear={seasonYear}
      />
    </WizardProvider>
  );
}
