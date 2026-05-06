/**
 * Billing Service Adapter
 *
 * Provides a unified interface for billing operations, switching between
 * in-memory implementation (legacy) and repository pattern (new) based on feature flags.
 *
 * Usage:
 * ```typescript
 * import { billingService } from '@/application/services/billing-service.adapter';
 *
 * // Works regardless of feature flag state
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
import { BillingService } from './billing.service';
import { DrizzleBillingPeriodRepository } from '@/infrastructure/persistence/repositories/billing-period.repository';
import { DrizzleTrainerBillingRepository } from '@/infrastructure/persistence/repositories/trainer-billing.repository';
import { DrizzleBillingLineItemRepository } from '@/infrastructure/persistence/repositories/billing-line-item.repository';
import { FeatureFlags } from '@/lib/features/feature-flags';

class BillingServiceAdapter {
  private periodRepo = new DrizzleBillingPeriodRepository();
  private billingRepo = new DrizzleTrainerBillingRepository();
  private lineItemRepo = new DrizzleBillingLineItemRepository();

  /**
   * Create a new billing period
   */
  async createBillingPeriod(startDate: string, endDate: string): Promise<BillingPeriod> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.periodRepo.create(new Date(startDate), new Date(endDate));
    }
    return BillingService.createBillingPeriod(startDate, endDate);
  }

  /**
   * Get billing period by ID
   */
  async getBillingPeriodById(id: string): Promise<BillingPeriod | null> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.periodRepo.findById(id);
    }
    return BillingService.getBillingPeriodById(id);
  }

  /**
   * Get all billing periods
   */
  async getAllBillingPeriods(): Promise<BillingPeriod[]> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.periodRepo.findAll();
    }
    return BillingService.getAllBillingPeriods();
  }

  /**
   * Get current billing period
   */
  async getCurrentBillingPeriod(): Promise<BillingPeriod | null> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.periodRepo.findCurrent();
    }
    return BillingService.getCurrentBillingPeriod();
  }

  /**
   * Close billing period
   */
  async closeBillingPeriod(id: string): Promise<BillingPeriod | null> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.periodRepo.close(id);
    }
    return BillingService.closeBillingPeriod(id);
  }

  /**
   * Create trainer billing
   */
  async createTrainerBilling(input: CreateTrainerBillingInput): Promise<TrainerBilling> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.billingRepo.create(input);
    }
    return BillingService.createTrainerBilling(input);
  }

  /**
   * Get trainer billing by ID
   */
  async getTrainerBillingById(id: string): Promise<TrainerBilling | null> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.billingRepo.findById(id);
    }
    return BillingService.getTrainerBillingById(id);
  }

  /**
   * Get trainer billings by billing period
   */
  async getTrainerBillingsByBillingPeriod(billingPeriodId: string): Promise<TrainerBilling[]> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.billingRepo.findByBillingPeriod(billingPeriodId);
    }
    return BillingService.getTrainerBillingsByBillingPeriod(billingPeriodId);
  }

  /**
   * Get trainer billings by trainer ID
   */
  async getTrainerBillingsByTrainerId(trainerId: string): Promise<TrainerBilling[]> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.billingRepo.findByTrainerId(trainerId);
    }
    return BillingService.getTrainerBillingsByTrainerId(trainerId);
  }

  /**
   * Get all trainer billings
   */
  async getAllTrainerBillings(status?: string): Promise<TrainerBilling[]> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.billingRepo.findAll(status);
    }
    return BillingService.getAllTrainerBillings(status);
  }

  /**
   * Update trainer billing
   */
  async updateTrainerBilling(
    id: string,
    input: UpdateTrainerBillingInput
  ): Promise<TrainerBilling | null> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.billingRepo.update(id, input);
    }
    return BillingService.updateTrainerBilling(id, input);
  }

  /**
   * Mark trainer billing as paid
   */
  async markTrainerBillingAsPaid(id: string): Promise<TrainerBilling | null> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.billingRepo.markAsPaid(id);
    }
    return BillingService.markTrainerBillingAsPaid(id);
  }

  /**
   * Mark trainer billing as overdue
   */
  async markTrainerBillingAsOverdue(id: string): Promise<TrainerBilling | null> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.billingRepo.markAsOverdue(id);
    }
    return BillingService.markTrainerBillingAsOverdue(id);
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
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
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
    return BillingService.createBillingLineItem(
      trainerBillingId,
      date,
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
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.lineItemRepo.findByTrainerBilling(trainerBillingId);
    }
    return BillingService.getBillingLineItemsByTrainerBilling(trainerBillingId);
  }

  /**
   * Get all billing line items
   */
  async getAllBillingLineItems(): Promise<BillingLineItem[]> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.lineItemRepo.findAll();
    }
    return BillingService.getAllBillingLineItems();
  }

  /**
   * Calculate billing summary for a billing period
   */
  async calculateBillingSummary(billingPeriodId: string): Promise<BillingSummary> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.billingRepo.calculateSummary(billingPeriodId);
    }
    return BillingService.calculateBillingSummary(billingPeriodId);
  }

  /**
   * Generate invoice number
   */
  async generateInvoiceNumber(): Promise<string> {
    if (FeatureFlags.USE_BILLING_REPOSITORY) {
      return this.billingRepo.generateInvoiceNumber();
    }
    return BillingService.generateInvoiceNumber();
  }

  /**
   * Get feature flag status
   */
  isUsingRepository(): boolean {
    return FeatureFlags.USE_BILLING_REPOSITORY;
  }
}

// Export singleton instance
export const billingService = new BillingServiceAdapter();
