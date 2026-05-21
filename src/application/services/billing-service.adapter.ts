/**
 * Billing Service Adapter
 *
 * Drizzle-based billing operations.
 *
 * Usage:
 * ```typescript
 * import { billingService } from '@/application/services/billing-service.adapter';
 *
 * const periods = await billingService.getAllBillingPeriods();
 * ```
 */

import type {
  BillingPeriod,
  TrainerBilling,
  BillingLineItem,
  CreateTrainerBillingInput,
  UpdateTrainerBillingInput,
  BillingSummary,
} from '@/domain/entities/billing.entity';

import { DrizzleBillingPeriodRepository } from '@/infrastructure/persistence/repositories/billing-period.repository';
import { DrizzleTrainerBillingRepository } from '@/infrastructure/persistence/repositories/trainer-billing.repository';
import { DrizzleBillingLineItemRepository } from '@/infrastructure/persistence/repositories/billing-line-item.repository';


class BillingServiceAdapter {
  private periodRepo = new DrizzleBillingPeriodRepository();
  private billingRepo = new DrizzleTrainerBillingRepository();
  private lineItemRepo = new DrizzleBillingLineItemRepository();

  /**
   * Create a new billing period
   */
  async createBillingPeriod(startDate: string, endDate: string): Promise<BillingPeriod> {
    return this.periodRepo.create(new Date(startDate), new Date(endDate));
  }

  /**
   * Get billing period by ID
   */
  async getBillingPeriodById(id: string): Promise<BillingPeriod | null> {
    return this.periodRepo.findById(id);
  }

  /**
   * Get all billing periods
   */
  async getAllBillingPeriods(): Promise<BillingPeriod[]> {
    return this.periodRepo.findAll();
  }

  /**
   * Get current billing period
   */
  async getCurrentBillingPeriod(): Promise<BillingPeriod | null> {
    return this.periodRepo.findCurrent();
  }

  /**
   * Close billing period
   */
  async closeBillingPeriod(id: string): Promise<BillingPeriod | null> {
    return this.periodRepo.close(id);
  }

  /**
   * Create trainer billing
   */
  async createTrainerBilling(input: CreateTrainerBillingInput): Promise<TrainerBilling> {
    return this.billingRepo.create(input);
  }

  /**
   * Get trainer billing by ID
   */
  async getTrainerBillingById(id: string): Promise<TrainerBilling | null> {
    return this.billingRepo.findById(id);
  }

  /**
   * Get trainer billings by billing period
   */
  async getTrainerBillingsByBillingPeriod(billingPeriodId: string): Promise<TrainerBilling[]> {
    return this.billingRepo.findByBillingPeriod(billingPeriodId);
  }

  /**
   * Get trainer billings by trainer ID
   */
  async getTrainerBillingsByTrainerId(trainerId: string): Promise<TrainerBilling[]> {
    return this.billingRepo.findByTrainerId(trainerId);
  }

  /**
   * Get all trainer billings
   */
  async getAllTrainerBillings(status?: string): Promise<TrainerBilling[]> {
    return this.billingRepo.findAll(status);
  }

  /**
   * Update trainer billing
   */
  async updateTrainerBilling(
    id: string,
    input: UpdateTrainerBillingInput
  ): Promise<TrainerBilling | null> {
    return this.billingRepo.update(id, input);
  }

  /**
   * Mark trainer billing as paid
   */
  async markTrainerBillingAsPaid(id: string): Promise<TrainerBilling | null> {
    return this.billingRepo.markAsPaid(id);
  }

  /**
   * Mark trainer billing as overdue
   */
  async markTrainerBillingAsOverdue(id: string): Promise<TrainerBilling | null> {
    return this.billingRepo.markAsOverdue(id);
  }

  /**
   * Create billing line item
   */
  async createBillingLineItem(
    trainerBillingId: string,
    date: string,
    description: string,
    hours: number,
    rate: number,
    type: 'training' | 'preparation' | 'meeting' | 'other',
    sessionId?: string
  ): Promise<BillingLineItem> {
    return this.lineItemRepo.create(
      trainerBillingId,
      new Date(date),
      description,
      hours,
      rate,
      type,
      sessionId
    );
  }

  /**
   * Get billing line items by trainer billing ID
   */
  async getBillingLineItemsByTrainerBilling(trainerBillingId: string): Promise<BillingLineItem[]> {
    return this.lineItemRepo.findByTrainerBilling(trainerBillingId);
  }

  /**
   * Get all billing line items
   */
  async getAllBillingLineItems(): Promise<BillingLineItem[]> {
    return this.lineItemRepo.findAll();
  }

  /**
   * Calculate billing summary for a billing period
   */
  async calculateBillingSummary(billingPeriodId: string): Promise<BillingSummary> {
    return this.billingRepo.calculateSummary(billingPeriodId);
  }

  /**
   * Generate invoice number
   */
  async generateInvoiceNumber(): Promise<string> {
    return this.billingRepo.generateInvoiceNumber();
  }


}

// Export singleton instance
export const billingService = new BillingServiceAdapter();
