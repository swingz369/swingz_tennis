/**
 * Fee Configuration Service Adapter
 *
 * Drizzle-based fee configuration operations.
 *
 * Usage:
 * ```typescript
 * import { feeConfigurationService } from '@/application/services/fee-configuration-service.adapter';
 *
 * const fees = await feeConfigurationService.getAllFeeConfigurations();
 * ```
 */

import type {
  FeeConfiguration,
  CreateFeeConfigurationInput,
  UpdateFeeConfigurationInput,
} from '@/domain/entities/fee-configuration.entity';
import { FeeConfigurationService } from './fee-configuration.service';
import { DrizzleFeeConfigurationRepository } from '@/infrastructure/persistence/repositories/fee-configuration.repository';

class FeeConfigurationServiceAdapter {
  private feeConfigRepo = new DrizzleFeeConfigurationRepository();

  /**
   * Validate fee configuration input
   * Delegates to in-memory service for validation logic
   */
  validateFeeConfigurationInput(input: CreateFeeConfigurationInput): {
    valid: boolean;
    errors: string[];
  } {
    return FeeConfigurationService.validateFeeConfigurationInput(input);
  }

  /**
   * Create a new fee configuration
   */
  async createFeeConfiguration(
    input: CreateFeeConfigurationInput,
    clubId: string = ''
  ): Promise<FeeConfiguration> {
    const validation = this.validateFeeConfigurationInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return this.feeConfigRepo.create(input, clubId);
  }

  /**
   * Get fee configuration by ID
   */
  async getFeeConfigurationById(id: string, clubId: string = ''): Promise<FeeConfiguration | null> {
    return this.feeConfigRepo.findById(id, clubId);
  }

  /**
   * Get all fee configurations
   */
  async getAllFeeConfigurations(clubId: string = ''): Promise<FeeConfiguration[]> {
    return this.feeConfigRepo.findAll(clubId);
  }

  /**
   * Get active fee configurations
   */
  async getActiveFeeConfigurations(
    clubId: string = '',
    date?: string
  ): Promise<FeeConfiguration[]> {
    return this.feeConfigRepo.findActive(clubId, date);
  }

  /**
   * Get fee configurations by type
   */
  async getFeeConfigurationsByType(
    type: FeeConfiguration['type'],
    clubId: string = ''
  ): Promise<FeeConfiguration[]> {
    return this.feeConfigRepo.findByType(type, clubId);
  }

  /**
   * Get fee configurations by billing cycle
   */
  async getFeeConfigurationsByBillingCycle(
    billingCycle: FeeConfiguration['billingCycle'],
    clubId: string = ''
  ): Promise<FeeConfiguration[]> {
    return this.feeConfigRepo.findByBillingCycle(billingCycle, clubId);
  }

  /**
   * Calculate applicable fees for a member
   */
  async calculateFeeForMember(
    memberType: string,
    memberAge: number,
    clubId: string = '',
    trainingGroup?: string
  ): Promise<FeeConfiguration[]> {
    return this.feeConfigRepo.calculateForMember(memberAge, memberType, clubId, trainingGroup);
  }

  /**
   * Update fee configuration
   */
  async updateFeeConfiguration(
    id: string,
    input: UpdateFeeConfigurationInput,
    clubId: string = ''
  ): Promise<FeeConfiguration | null> {
    return this.feeConfigRepo.update(id, input, clubId);
  }

  /**
   * Delete fee configuration
   */
  async deleteFeeConfiguration(id: string, clubId: string = ''): Promise<boolean> {
    return this.feeConfigRepo.delete(id, clubId);
  }

  /**
   * Deactivate fee configuration (soft delete)
   */
  async deactivateFeeConfiguration(
    id: string,
    clubId: string = ''
  ): Promise<FeeConfiguration | null> {
    return this.feeConfigRepo.deactivate(id, clubId);
  }

  /**
   * Activate fee configuration
   */
  async activateFeeConfiguration(
    id: string,
    clubId: string = ''
  ): Promise<FeeConfiguration | null> {
    return this.feeConfigRepo.activate(id, clubId);
  }
}

// Export singleton instance
export const feeConfigurationService = new FeeConfigurationServiceAdapter();
