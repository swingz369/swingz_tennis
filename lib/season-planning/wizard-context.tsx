'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-fetch';
import type {
  WizardState,
  WizardStep,
  ClusteringResult,
  ConflictDetectionResult,
  ConfirmPlanResponse,
  SelectMembersResponse,
  PreferencesSummary,
  TrainerAvailabilitySummary,
  ScheduleSlot,
} from '@/lib/season-planning/types';

// ============================================
// INITIAL STATE
// ============================================

function createInitialState(seasonId: string, clubId: string, initialStep?: number): WizardState {
  const step = initialStep && initialStep >= 1 && initialStep <= 4 ? initialStep : 1;
  return {
    seasonId,
    clubId,
    currentStep: Math.min(step, 4) as WizardStep,
    maxReachedStep: Math.min(step, 4) as WizardStep,
    isReady: false,
    isProcessing: false,
    error: null,
    adminNotes: '',
    selectedMemberIds: [],
    promotedMemberIds: [],
    preferencesResponseRate: 0,
    slotFailureRates: {},
    incompatibleWishPartnerPairs: [],
    trainerUtilization: {},
    planningConfig: {
      groupMaxSize: 6,
      groupMinSize: 1,
      maxNiveauLevelSteps: 1,
      trainerUtilizationMaxPct: 100,
      preferHistoricGroups: true,
      avoidHighFailureSlots: true,
      slotFailureThreshold: 30,
      slotDurationMinutes: 60,
      kidsGroupMaxSize: 6,
      kidsGroupMinSize: 1,
      maxIterations: 1000,
      optimizationGoals: ['minimize_conflicts', 'balance_trainer_load', 'maximize_preferences'],
      allowOverbooking: false,
      preferConsistentTimeslots: true,
      includeSunday: false,
    },
    clusteringResult: null,
    scheduleSlots: [],
    holidayWeeks: [],
    bundeslandCode: null,
    conflicts: [],
    isConfirmed: false,
    publishedSessionIds: [],
  };
}

// ============================================
// ACTIONS
// ============================================

type WizardAction =
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_PROCESSING'; isProcessing: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_READY'; isReady: boolean }
  | { type: 'SET_PLANNING_CONFIG'; config: WizardState['planningConfig'] }
  | { type: 'SET_SCHEDULE_SLOTS'; slots: ScheduleSlot[] }
  | {
      type: 'SELECT_MEMBERS';
      memberIds: string[];
      promotedIds: string[];
      response: SelectMembersResponse;
    }
  | { type: 'SET_PREFERENCES_SUMMARY'; summary: PreferencesSummary }
  | { type: 'SET_TRAINER_AVAILABILITY'; summary: TrainerAvailabilitySummary }
  | { type: 'SET_CLUSTERING_RESULT'; result: ClusteringResult }
  | { type: 'SET_CONFLICTS'; conflicts: ConflictDetectionResult[] }
  | { type: 'CONFIRM_PLAN'; response: ConfirmPlanResponse }
  | { type: 'SET_ADMIN_NOTES'; notes: string }
  | { type: 'RESET_WIZARD' };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return {
        ...state,
        currentStep: action.step,
        maxReachedStep: Math.max(state.maxReachedStep, action.step) as WizardStep,
        error: null,
      };

    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.isProcessing };

    case 'SET_ERROR':
      return { ...state, error: action.error, isProcessing: false };

    case 'SET_READY':
      return { ...state, isReady: action.isReady };

    case 'SET_PLANNING_CONFIG':
      return { ...state, planningConfig: { ...state.planningConfig, ...action.config } };

    case 'SET_SCHEDULE_SLOTS':
      return { ...state, scheduleSlots: action.slots };

    case 'SELECT_MEMBERS':
      return {
        ...state,
        selectedMemberIds: action.memberIds,
        promotedMemberIds: action.promotedIds,
        preferencesResponseRate: action.response.selectedCount,
        isProcessing: false,
      };

    case 'SET_PREFERENCES_SUMMARY':
      return {
        ...state,
        preferencesResponseRate: action.summary.responseRate,
        slotFailureRates: Object.fromEntries(
          action.summary.slotFailureWarnings.map((w) => [
            `${w.dayOfWeek}_${w.startTime}`,
            w.failureRate,
          ])
        ),
        incompatibleWishPartnerPairs: action.summary.incompatibleWishPartners.map((p) => ({
          memberA: p.memberA.name,
          memberB: p.memberB.name,
          reason: p.reason,
        })),
        isProcessing: false,
      };

    case 'SET_TRAINER_AVAILABILITY':
      return {
        ...state,
        trainerUtilization: Object.fromEntries(
          action.summary.trainers.map((t) => [
            t.trainerId,
            {
              current: t.currentAssignedHours,
              max: t.effectiveMaxHours,
              pct: Math.round((t.currentAssignedHours / Math.max(1, t.effectiveMaxHours)) * 100),
            },
          ])
        ),
        isProcessing: false,
      };

    case 'SET_CLUSTERING_RESULT':
      return {
        ...state,
        clusteringResult: action.result,
        scheduleSlots: [],
        maxReachedStep: Math.max(state.maxReachedStep, 4) as WizardStep,
        isProcessing: false,
      };

    case 'SET_CONFLICTS':
      return {
        ...state,
        conflicts: action.conflicts,
        isProcessing: false,
      };

    case 'CONFIRM_PLAN':
      return {
        ...state,
        isConfirmed: action.response.success,
        publishedSessionIds: action.response.publishedSessionIds ?? [],
        isProcessing: false,
      };

    case 'SET_ADMIN_NOTES':
      return { ...state, adminNotes: action.notes };

    case 'RESET_WIZARD':
      return createInitialState(state.seasonId, state.clubId);

    default:
      return state;
  }
}

// ============================================
// CONTEXT
// ============================================

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setMemberIds: (ids: string[]) => void;
  runClustering: (dryRun?: boolean) => Promise<void>;
  detectConflicts: () => Promise<void>;
  confirmPlan: () => Promise<ConfirmPlanResponse>;
  resetWizard: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({
  children,
  seasonId,
  clubId,
  initialStep,
}: {
  children: ReactNode;
  seasonId: string;
  clubId: string;
  initialStep?: number;
}) {
  const [state, dispatch] = useReducer(
    wizardReducer,
    createInitialState(seasonId, clubId, initialStep)
  );

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Browser-Zurück/Vor ändert die URL, nicht den Reducer direkt — hier zurück in
  // den Wizard-State spiegeln, damit die Zurück-Taste einen Schritt zurückgeht
  // statt die Seite zu verlassen.
  useEffect(() => {
    const stepParam = searchParams.get('step');
    const parsed = stepParam ? parseInt(stepParam, 10) : 1;
    const clamped = Math.min(4, Math.max(1, parsed || 1)) as WizardStep;
    if (clamped !== state.currentStep) {
      dispatch({ type: 'SET_STEP', step: clamped });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const pushStepToUrl = useCallback(
    (step: WizardStep) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('step', String(step));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const goToStep = useCallback(
    (step: WizardStep) => {
      dispatch({ type: 'SET_STEP', step });
      pushStepToUrl(step);
    },
    [pushStepToUrl]
  );

  const nextStep = useCallback(() => {
    const next = Math.min(4, state.currentStep + 1) as WizardStep;
    dispatch({ type: 'SET_STEP', step: next });
    pushStepToUrl(next);
  }, [state.currentStep, pushStepToUrl]);

  const prevStep = useCallback(() => {
    const prev = Math.max(1, state.currentStep - 1) as WizardStep;
    dispatch({ type: 'SET_STEP', step: prev });
    pushStepToUrl(prev);
  }, [state.currentStep, pushStepToUrl]);

  const setMemberIds = useCallback((ids: string[]) => {
    dispatch({
      type: 'SELECT_MEMBERS',
      memberIds: ids,
      promotedIds: [],
      response: {
        success: true,
        selectedCount: ids.length,
        promotedMembers: [],
        waitlistCarryovers: [],
      },
    });
  }, []);

  const runClustering = useCallback(
    async (dryRun: boolean = false) => {
      dispatch({ type: 'SET_PROCESSING', isProcessing: true });
      try {
        const res = await apiFetch(`/api/seasons/${state.seasonId}/planning/cluster`, {
          method: 'POST',
          body: JSON.stringify({
            seasonId: state.seasonId,
            config: state.planningConfig,
            dryRun,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Clustering fehlgeschlagen');
        }
        const data = await res.json();
        dispatch({ type: 'SET_CLUSTERING_RESULT', result: data.result });
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : 'Clustering fehlgeschlagen',
        });
      }
    },
    [state.seasonId, state.planningConfig]
  );

  const detectConflicts = useCallback(async () => {
    // ponytail: no SET_PROCESSING — it unmounts FinalizeStep and resets hasRunCheck local state
    try {
      const res = await apiFetch(`/api/seasons/${state.seasonId}/planning/conflicts`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Konfliktprüfung fehlgeschlagen');
      }
      const data = await res.json();
      dispatch({ type: 'SET_CONFLICTS', conflicts: data.conflicts });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Konfliktprüfung fehlgeschlagen',
      });
      throw err;
    }
  }, [state.seasonId]);

  const confirmPlan = useCallback(async (): Promise<ConfirmPlanResponse> => {
    dispatch({ type: 'SET_PROCESSING', isProcessing: true });
    try {
      const res = await apiFetch(`/api/seasons/${state.seasonId}/planning/confirm`, {
        method: 'POST',
        // Kein `acceptedWarnings` mehr: die Freigabe entscheidet der Server
        // anhand der persistierten "gelöst"/"ignoriert"-Einträge, nicht anhand
        // einer Liste, die der Client sich selbst zusammenstellt.
        body: JSON.stringify({
          seasonId: state.seasonId,
          adminNotes: state.adminNotes || 'Planung bestätigt via Wizard',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Bestätigung fehlgeschlagen');
      }
      const data = await res.json();
      dispatch({ type: 'CONFIRM_PLAN', response: data });
      return data;
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Bestätigung fehlgeschlagen',
      });
      throw err;
    }
  }, [state.seasonId, state.adminNotes]);

  const resetWizard = useCallback(() => {
    dispatch({ type: 'RESET_WIZARD' });
  }, []);

  const value: WizardContextValue = {
    state,
    dispatch,
    goToStep,
    nextStep,
    prevStep,
    setMemberIds,
    runClustering,
    detectConflicts,
    confirmPlan,
    resetWizard,
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
