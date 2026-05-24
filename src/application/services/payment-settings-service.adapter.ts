/**
 * Payment Settings Service Adapter
 *
 * Drizzle-based payment gateway settings operations.
 *
 * Usage:
 * ```typescript
 * import { paymentSettingsService } from '@/application/services/payment-settings-service.adapter';
 *
 * const settings = await paymentSettingsService.getAllPaymentSettings();
 * ```
 */

import type {
  PaymentSettings,
  CreatePaymentSettingsInput,
  UpdatePaymentSettingsInput,
} from '@/domain/entities/payment-settings.entity';
import { PaymentSettingsService } from './payment-settings.service';
import { DrizzlePaymentSettingsRepository } from '@/infrastructure/persistence/repositories/payment-settings.repository';

class PaymentSettingsServiceAdapter {
  private paymentSettingsRepo = new DrizzlePaymentSettingsRepository();

  /**
   * Validate payment settings input
   * Delegates to in-memory service for validation logic
   */
  validatePaymentSettingsInput(input: CreatePaymentSettingsInput): {
    valid: boolean;
    errors: string[];
  } {
    return PaymentSettingsService.validatePaymentSettingsInput(input);
  }

  /**
   * Create new payment settings
   */
  async createPaymentSettings(
    input: CreatePaymentSettingsInput,
    clubId: string = ''
  ): Promise<PaymentSettings> {
    const validation = this.validatePaymentSettingsInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return this.paymentSettingsRepo.create(input, clubId);
  }

  /**
   * Get payment settings by ID
   */
  async getPaymentSettingsById(id: string, clubId: string = ''): Promise<PaymentSettings | null> {
    return this.paymentSettingsRepo.findById(id, clubId);
  }

  /**
   * Get all payment settings
   */
  async getAllPaymentSettings(clubId: string = ''): Promise<PaymentSettings[]> {
    return this.paymentSettingsRepo.findAll(clubId);
  }

  /**
   * Get active payment settings
   */
  async getActivePaymentSettings(clubId: string = ''): Promise<PaymentSettings[]> {
    return this.paymentSettingsRepo.findActive(clubId);
  }

  /**
   * Get default payment settings
   */
  async getDefaultPaymentSettings(clubId: string = ''): Promise<PaymentSettings | null> {
    return this.paymentSettingsRepo.findDefault(clubId);
  }

  /**
   * Get payment settings by gateway
   */
  async getPaymentSettingsByGateway(
    gateway: PaymentSettings['gateway'],
    clubId: string = ''
  ): Promise<PaymentSettings[]> {
    return this.paymentSettingsRepo.findByGateway(gateway, clubId);
  }

  /**
   * Update payment settings
   */
  async updatePaymentSettings(
    id: string,
    input: UpdatePaymentSettingsInput,
    clubId: string = ''
  ): Promise<PaymentSettings | null> {
    return this.paymentSettingsRepo.update(id, input, clubId);
  }

  /**
   * Set payment settings as default
   */
  async setAsDefault(id: string, clubId: string = ''): Promise<PaymentSettings | null> {
    return this.paymentSettingsRepo.setAsDefault(id, clubId);
  }

  /**
   * Delete payment settings
   */
  async deletePaymentSettings(id: string, clubId: string = ''): Promise<boolean> {
    return this.paymentSettingsRepo.delete(id, clubId);
  }

  /**
   * Calculate payment processing fee
   */
  async calculateFee(paymentSettingsId: string, amount: number): Promise<number> {
    return this.paymentSettingsRepo.calculateFee(paymentSettingsId, amount);
  }

  /**
   * Test payment settings connection
   * Note: In-memory service always used for testing as it's not data-dependent
   */
  async testPaymentSettings(id: string): Promise<{ success: boolean; message: string }> {
    return PaymentSettingsService.testPaymentSettings(id);
  }
}

// Export singleton instance
export const paymentSettingsService = new PaymentSettingsServiceAdapter();
