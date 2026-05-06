/**
 * Fee Configuration Service Adapter
 *
 * Provides a unified interface for fee configuration operations,
 * switching between in-memory (legacy) and repository pattern (new) based on feature flags.
 *
 * Usage:
 * ```typescript
 * import { feeConfigurationService } from '@/application/services/fee-configuration-service.adapter';
 *
 * const fees = await feeConfigurationService.getAllFeeConfigurations('club-id-123');
 * ```
 */

import type {
  FeeConfiguration,
  CreateFeeConfigurationInput,
  UpdateFeeConfigurationInput,
} from '@/domain/entities/fee-configuration.entity';
import { FeeConfigurationService } from './fee-configuration.service';
import { DrizzleFeeConfigurationRepository } from '@/infrastructure/persistence/repositories/fee-configuration.repository';
import { FeatureFlags } from '@/lib/features/feature-flags';

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
    clubId: string
  ): Promise<FeeConfiguration> {
    // Always validate
    const validation = this.validateFeeConfigurationInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    if (FeatureFlags.USE_FEE_CONFIGURATION_REPOSITORY) {
      return this.feeConfigRepo.create(input, clubId);
    }
    return FeeConfigurationService.createFeeConfiguration(input);
  }

  /**
   * Get fee configuration by ID
   */
  async getFeeConfigurationById(id: string, clubId: string): Promise<FeeConfiguration | null> {
    if (FeatureFlags.USE_FEE_CONFIGURATION_REPOSITORY) {
      return this.feeConfigRepo.findById(id, clubId);
    }
    return FeeConfigurationService.getFeeConfigurationById(id);
  }

  /**
   * Get all fee configurations
   */
  async getAllFeeConfigurations(clubId: string): Promise<FeeConfiguration[]> {
    if (FeatureFlags.USE_FEE_CONFIGURATION_REPOSITORY) {
      return this.feeConfigRepo.findAll(clubId);
    }
    return FeeConfigurationService.getAllFeeConfigurations();
  }

  /**
   * Get active fee configurations
   */
  async getActiveFeeConfigurations(clubId: string, date?: string): Promise<FeeConfiguration[]> {
    if (FeatureFlags.USE_FEE_CONFIGURATION_REPOSITORY) {
      return this.feeConfigRepo.findActive(clubId, date);
    }
    return FeeConfigurationService.getActiveFeeConfigurations();
  }

  /**
   * Get fee configurations by type
   */
  async getFeeConfigurationsByType(
    type: FeeConfiguration['type'],
    clubId: string
  ): Promise<FeeConfiguration[]> {
    if (FeatureFlags.USE_FEE_CONFIGURATION_REPOSITORY) {
      return this.feeConfigRepo.findByType(type, clubId);
    }
    return FeeConfigurationService.getFeeConfigurationsByType(type);
  }

  /**
   * Get fee configurations by billing cycle
   */
  async getFeeConfigurationsByBillingCycle(
    billingCycle: FeeConfiguration['billingCycle'],
    clubId: string
  ): Promise<FeeConfiguration[]> {
    if (FeatureFlags.USE_FEE_CONFIGURATION_REPOSITORY) {
      return this.feeConfigRepo.findByBillingCycle(billingCycle, clubId);
    }
    return FeeConfigurationService.getFeeConfigurationsByBillingCycle(billingCycle);
  }

  /**
   * Calculate applicable fees for a member
   */
  async calculateFeeForMember(
    memberType: string,
    memberAge: number,
    clubId: string,
    trainingGroup?: string
  ): Promise<FeeConfiguration[]> {
    if (FeatureFlags.USE_FEE_CONFIGURATION_REPOSITORY) {
      return this.feeConfigRepo.calculateForMember(memberAge, memberType, clubId, trainingGroup);
    }
    return FeeConfigurationService.calculateFeeForMember(memberType, memberAge, trainingGroup);
  }

  /**
   * Update fee configuration
   */
  async updateFeeConfiguration(
    id: string,
    input: UpdateFeeConfigurationInput,
    clubId: string
  ): Promise<FeeConfiguration | null> {
    if (FeatureFlags.USE_FEE_CONFIGURATION_REPOSITORY) {
      return this.feeConfigRepo.update(id, input, clubId);
    }
    return FeeConfigurationService.updateFeeConfiguration(id, input);
  }

  /**
   * Delete fee configuration
   */
  async deleteFeeConfiguration(id: string, clubId: string): Promise<boolean> {
    if (FeatureFlags.USE_FEE_CONFIGURATION_REPOSITORY) {
      return this.feeConfigRepo.delete(id, clubId);
    }
    return FeeConfigurationService.deleteFeeConfiguration(id);
  }

  /**
   * Deactivate fee configuration (soft delete)
   */
  async deactivateFeeConfiguration(id: string, clubId: string): Promise<FeeConfiguration | null> {
    if (FeatureFlags.USE_FEE_CONFIGURATION_REPOSITORY) {
      return this.feeConfigRepo.deactivate(id, clubId);
    }
    return FeeConfigurationService.updateFeeConfiguration(id, { isActive: false });
  }

  /**
   * Activate fee configuration
   */
  async activateFeeConfiguration(id: string, clubId: string): Promise<FeeConfiguration | null> {
    if (FeatureFlags.USE_FEE_CONFIGURATION_REPOSITORY) {
      return this.feeConfigRepo.activate(id, clubId);
    }
    return FeeConfigurationService.updateFeeConfiguration(id, { isActive: true });
  }
}

// Export singleton instance
export const feeConfigurationService = new FeeConfigurationServiceAdapter();
