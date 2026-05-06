// Export types for use in implementations
export type {
  BillingPeriod,
  TrainerBilling,
  BillingLineItem,
  CreateTrainerBillingInput,
  UpdateTrainerBillingInput,
  BillingSummary,
} from '../entities/billing.entity';

/**
 * Repository interface for billing periods
 */
export interface BillingPeriodRepository {
  /**
   * Create a new billing period
   */
  create(startDate: Date, endDate: Date): Promise<BillingPeriod>;

  /**
   * Find billing period by ID
   */
  findById(id: string): Promise<BillingPeriod | null>;

  /**
   * Get all billing periods
   */
  findAll(): Promise<BillingPeriod[]>;

  /**
   * Get current open billing period
   */
  findCurrent(): Promise<BillingPeriod | null>;

  /**
   * Close a billing period
   */
  close(id: string): Promise<BillingPeriod | null>;

  /**
   * Delete a billing period (soft delete)
   */
  delete(id: string): Promise<void>;
}

/**
 * Repository interface for trainer billings
 */
export interface TrainerBillingRepository {
  /**
   * Create a new trainer billing
   */
  create(input: CreateTrainerBillingInput): Promise<TrainerBilling>;

  /**
   * Find trainer billing by ID
   */
  findById(id: string): Promise<TrainerBilling | null>;

  /**
   * Find trainer billings by billing period
   */
  findByBillingPeriod(billingPeriodId: string): Promise<TrainerBilling[]>;

  /**
   * Find trainer billings by trainer ID
   */
  findByTrainerId(trainerId: string): Promise<TrainerBilling[]>;

  /**
   * Find all trainer billings with optional status filter
   */
  findAll(status?: string): Promise<TrainerBilling[]>;

  /**
   * Update a trainer billing
   */
  update(id: string, input: UpdateTrainerBillingInput): Promise<TrainerBilling | null>;

  /**
   * Mark a trainer billing as paid
   */
  markAsPaid(id: string): Promise<TrainerBilling | null>;

  /**
   * Mark a trainer billing as overdue
   */
  markAsOverdue(id: string): Promise<TrainerBilling | null>;

  /**
   * Calculate billing summary for a period
   */
  calculateSummary(billingPeriodId: string): Promise<BillingSummary>;

  /**
   * Generate unique invoice number
   */
  generateInvoiceNumber(): Promise<string>;

  /**
   * Delete a trainer billing (soft delete)
   */
  delete(id: string): Promise<void>;
}

/**
 * Repository interface for billing line items
 */
export interface BillingLineItemRepository {
  /**
   * Create a new billing line item
   */
  create(
    trainerBillingId: string,
    date: Date,
    description: string,
    hours: number,
    rate: number,
    type: 'training' | 'preparation' | 'meeting' | 'other',
    sessionId?: string
  ): Promise<BillingLineItem>;

  /**
   * Find billing line items by trainer billing ID
   */
  findByTrainerBilling(trainerBillingId: string): Promise<BillingLineItem[]>;

  /**
   * Find all billing line items
   */
  findAll(): Promise<BillingLineItem[]>;

  /**
   * Update a billing line item
   */
  update(id: string, data: Partial<BillingLineItem>): Promise<BillingLineItem | null>;

  /**
   * Delete a billing line item
   */
  delete(id: string): Promise<void>;
}
