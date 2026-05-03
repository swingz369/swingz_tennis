export interface HourlyRateTier {
  id: string;
  name: string;
  description?: string;
  baseRate: number;
  trainingTypes: string[];
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrainerHourlyRate {
  id: string;
  trainerId: string;
  trainerName: string;
  baseRate: number;
  overrideRate?: number;
  effectiveRate: number;
  validFrom: string;
  validUntil?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RateHistoryEntry {
  id: string;
  trainerId: string;
  trainerName: string;
  oldRate: number;
  newRate: number;
  changedAt: string;
  changedBy: string;
  reason?: string;
}

export interface CreateHourlyRateTierInput {
  name: string;
  description?: string;
  baseRate: number;
  trainingTypes: string[];
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'professional';
}

export interface UpdateHourlyRateTierInput {
  name?: string;
  description?: string;
  baseRate?: number;
  trainingTypes?: string[];
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  isActive?: boolean;
}

export interface CreateTrainerHourlyRateInput {
  trainerId: string;
  trainerName: string;
  baseRate: number;
  overrideRate?: number;
  validFrom: string;
  validUntil?: string;
  reason?: string;
}

export interface UpdateTrainerHourlyRateInput {
  overrideRate?: number;
  validUntil?: string;
  reason?: string;
}
