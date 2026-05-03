export interface BillingPeriod {
  id: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'processing' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface TrainerBilling {
  id: string;
  billingPeriodId: string;
  trainerId: string;
  trainerName: string;
  totalHours: number;
  hourlyRate: number;
  totalAmount: number;
  status: 'pending' | 'processed' | 'paid' | 'overdue';
  invoiceId?: string;
  invoiceNumber?: string;
  dueDate?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingLineItem {
  id: string;
  trainerBillingId: string;
  date: string;
  description: string;
  hours: number;
  rate: number;
  amount: number;
  type: 'training' | 'preparation' | 'meeting' | 'other';
  sessionId?: string;
}

export interface CreateTrainerBillingInput {
  billingPeriodId: string;
  trainerId: string;
  trainerName: string;
  totalHours: number;
  hourlyRate: number;
  totalAmount: number;
  dueDate?: string;
  notes?: string;
}

export interface UpdateTrainerBillingInput {
  status?: 'pending' | 'processed' | 'paid' | 'overdue';
  invoiceId?: string;
  invoiceNumber?: string;
  dueDate?: string;
  paidAt?: string;
  notes?: string;
}

export interface BillingSummary {
  billingPeriodId: string;
  totalTrainers: number;
  totalHours: number;
  totalAmount: number;
  pendingAmount: number;
  processedAmount: number;
  paidAmount: number;
  overdueAmount: number;
}
