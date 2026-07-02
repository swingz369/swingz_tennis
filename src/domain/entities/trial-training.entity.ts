export interface TrialTrainingParticipant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
}

export interface TrialTrainingFeedback {
  rating: number;
  comments: string;
  wouldRecommend: boolean;
}

export interface TrialTraining {
  id: string;
  participant: TrialTrainingParticipant;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  trainer: {
    id: string;
    name: string;
  };
  court: {
    id: string;
    name: string;
  };
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'converted' | 'requested';
  notes?: string;
  feedback?: TrialTrainingFeedback;
  convertedToMemberId?: string;
  createdAt: string;
  updatedAt: string;
  /** Participant opted in to marketing emails (raw checkbox state, not yet DOI-confirmed) */
  marketingConsent?: boolean;
  /**
   * Single-use double opt-in confirmation token. Only populated right after
   * creation so the caller can send the DOI confirmation email — never
   * exposed via API responses.
   */
  marketingConsentToken?: string;
}

export interface CreateTrialTrainingInput {
  participant: Omit<TrialTrainingParticipant, 'id'>;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  trainerId: string;
  courtId: string;
  notes?: string;
  /** Opt-in to occasional marketing emails — requires double opt-in confirmation before any send */
  marketingConsent?: boolean;
}

export interface UpdateTrialTrainingInput {
  status?: TrialTraining['status'];
  notes?: string;
  feedback?: TrialTrainingFeedback;
  convertedToMemberId?: string;
  trainerId?: string;
  trainerName?: string;
  courtId?: string;
  courtName?: string;
}

export interface TrialTrainingStats {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  noShow: number;
  converted: number;
  conversionRate: number;
}
