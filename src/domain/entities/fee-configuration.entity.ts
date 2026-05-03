export interface FeeConfiguration {
  id: string;
  name: string;
  description?: string;
  type: 'membership' | 'training' | 'court' | 'other';
  amount: number;
  currency: string;
  billingCycle: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  isActive: boolean;
  validFrom?: string;
  validUntil?: string;
  conditions?: {
    minAge?: number;
    maxAge?: number;
    memberType?: string[];
    trainingGroup?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeeConfigurationInput {
  name: string;
  description?: string;
  type: 'membership' | 'training' | 'court' | 'other';
  amount: number;
  currency?: string;
  billingCycle: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  validFrom?: string;
  validUntil?: string;
  conditions?: {
    minAge?: number;
    maxAge?: number;
    memberType?: string[];
    trainingGroup?: string[];
  };
}

export interface UpdateFeeConfigurationInput {
  name?: string;
  description?: string;
  type?: 'membership' | 'training' | 'court' | 'other';
  amount?: number;
  currency?: string;
  billingCycle?: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  isActive?: boolean;
  validFrom?: string;
  validUntil?: string;
  conditions?: {
    minAge?: number;
    maxAge?: number;
    memberType?: string[];
    trainingGroup?: string[];
  };
}
