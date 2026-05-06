/**
 * Payment Settings Service Adapter
 *
 * Provides a unified interface for payment gateway settings operations,
 * switching between in-memory (legacy) and repository pattern (new) based on feature flags.
 *
 * Usage:
 * ```typescript
 * import { paymentSettingsService } from '@/application/services/payment-settings-service.adapter';
 *
 * const settings = await paymentSettingsService.getAllPaymentSettings('club-id-123');
 * ```
 */

import type {
  PaymentSettings,
  CreatePaymentSettingsInput,
  UpdatePaymentSettingsInput,
} from '@/domain/entities/payment-settings.entity';
import { PaymentSettingsService } from './payment-settings.service';
import { DrizzlePaymentSettingsRepository } from '@/infrastructure/persistence/repositories/payment-settings.repository';
import { FeatureFlags } from '@/lib/features/feature-flags';

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
    clubId: string
  ): Promise<PaymentSettings> {
    // Always validate
    const validation = this.validatePaymentSettingsInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    if (FeatureFlags.USE_PAYMENT_SETTINGS_REPOSITORY) {
      return this.paymentSettingsRepo.create(input, clubId);
    }
    return PaymentSettingsService.createPaymentSettings(input);
  }

  /**
   * Get payment settings by ID
   */
  async getPaymentSettingsById(id: string, clubId: string): Promise<PaymentSettings | null> {
    if (FeatureFlags.USE_PAYMENT_SETTINGS_REPOSITORY) {
      return this.paymentSettingsRepo.findById(id, clubId);
    }
    return PaymentSettingsService.getPaymentSettingsById(id);
  }

  /**
   * Get all payment settings
   */
  async getAllPaymentSettings(clubId: string): Promise<PaymentSettings[]> {
    if (FeatureFlags.USE_PAYMENT_SETTINGS_REPOSITORY) {
      return this.paymentSettingsRepo.findAll(clubId);
    }
    return PaymentSettingsService.getAllPaymentSettings();
  }

  /**
   * Get active payment settings
   */
  async getActivePaymentSettings(clubId: string): Promise<PaymentSettings[]> {
    if (FeatureFlags.USE_PAYMENT_SETTINGS_REPOSITORY) {
      return this.paymentSettingsRepo.findActive(clubId);
    }
    return PaymentSettingsService.getActivePaymentSettings();
  }

  /**
   * Get default payment settings
   */
  async getDefaultPaymentSettings(clubId: string): Promise<PaymentSettings | null> {
    if (FeatureFlags.USE_PAYMENT_SETTINGS_REPOSITORY) {
      return this.paymentSettingsRepo.findDefault(clubId);
    }
    return PaymentSettingsService.getDefaultPaymentSettings();
  }

  /**
   * Get payment settings by gateway
   */
  async getPaymentSettingsByGateway(
    gateway: PaymentSettings['gateway'],
    clubId: string
  ): Promise<PaymentSettings[]> {
    if (FeatureFlags.USE_PAYMENT_SETTINGS_REPOSITORY) {
      return this.paymentSettingsRepo.findByGateway(gateway, clubId);
    }
    return PaymentSettingsService.getPaymentSettingsByGateway(gateway);
  }

  /**
   * Update payment settings
   */
  async updatePaymentSettings(
    id: string,
    input: UpdatePaymentSettingsInput,
    clubId: string
  ): Promise<PaymentSettings | null> {
    if (FeatureFlags.USE_PAYMENT_SETTINGS_REPOSITORY) {
      return this.paymentSettingsRepo.update(id, input, clubId);
    }
    return PaymentSettingsService.updatePaymentSettings(id, input);
  }

  /**
   * Set payment settings as default
   */
  async setAsDefault(id: string, clubId: string): Promise<PaymentSettings | null> {
    if (FeatureFlags.USE_PAYMENT_SETTINGS_REPOSITORY) {
      return this.paymentSettingsRepo.setAsDefault(id, clubId);
    }
    return PaymentSettingsService.setAsDefault(id);
  }

  /**
   * Delete payment settings
   */
  async deletePaymentSettings(id: string, clubId: string): Promise<boolean> {
    if (FeatureFlags.USE_PAYMENT_SETTINGS_REPOSITORY) {
      return this.paymentSettingsRepo.delete(id, clubId);
    }
    return PaymentSettingsService.deletePaymentSettings(id);
  }

  /**
   * Calculate payment processing fee
   */
  async calculateFee(paymentSettingsId: string, amount: number): Promise<number> {
    if (FeatureFlags.USE_PAYMENT_SETTINGS_REPOSITORY) {
      return this.paymentSettingsRepo.calculateFee(paymentSettingsId, amount);
    }

    // Fallback: manual calculation
    const settings = await this.getPaymentSettingsById(paymentSettingsId, ''); // clubId not needed for in-memory
    if (!settings || !settings.fees) return 0;

    const fixedFee = settings.fees.fixed ?? 0;
    const percentageFee = (settings.fees.percentage ?? 0) / 100;
    return fixedFee + amount * percentageFee;
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
