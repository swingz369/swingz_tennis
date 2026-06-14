'use client';

import React, { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
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

function createInitialState(seasonId: string, clubId: string): WizardState {
  return {
    seasonId,
    clubId,
    currentStep: 1 as WizardStep,
    maxReachedStep: 1 as WizardStep,
    isReady: false,
    isProcessing: false,
    error: null,
    selectedMemberIds: [],
    promotedMemberIds: [],
    preferencesResponseRate: 0,
    slotFailureRates: {},
    incompatibleWishPartnerPairs: [],
    trainerUtilization: {},
    planningConfig: {
      groupMaxSize: 6,
      groupMinSize: 3,
      maxNiveauSpanBeginner: 2,
      maxNiveauSpanAdvanced: 2,
      trainerUtilizationMaxPct: 80,
      preferHistoricGroups: true,
      avoidHighFailureSlots: true,
      slotFailureThreshold: 30,
      slotDurationMinutes: 90,
      kidsGroupMaxSize: 6,
      kidsGroupMinSize: 3,
      maxIterations: 1000,
      optimizationGoals: ['minimize_conflicts', 'balance_trainer_load', 'maximize_preferences'],
      allowOverbooking: false,
      preferConsistentTimeslots: true,
      useAI: false,
    },
    clusteringResult: null,
    scheduleSlots: [],
    aiAnalysisText: null,
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
        maxReachedStep: 3 as WizardStep,
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
}: {
  children: ReactNode;
  seasonId: string;
  clubId: string;
}) {
  const [state, dispatch] = useReducer(wizardReducer, createInitialState(seasonId, clubId));

  const goToStep = useCallback((step: WizardStep) => {
    dispatch({ type: 'SET_STEP', step });
  }, []);

  const nextStep = useCallback(() => {
    const next = Math.min(3, state.currentStep + 1) as WizardStep;
    dispatch({ type: 'SET_STEP', step: next });
  }, [state.currentStep]);

  const prevStep = useCallback(() => {
    const prev = Math.max(1, state.currentStep - 1) as WizardStep;
    dispatch({ type: 'SET_STEP', step: prev });
  }, [state.currentStep]);

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
    dispatch({ type: 'SET_PROCESSING', isProcessing: true });
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
        body: JSON.stringify({
          seasonId: state.seasonId,
          acceptedWarnings: state.conflicts
            .filter((c) => c.severity !== 'critical')
            .map((c) => c.id),
          adminNotes: 'Planung bestätigt via Wizard',
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
  }, [state.seasonId, state.conflicts]);

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
