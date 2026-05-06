/**
 * System Settings Service Adapter
 *
 * Provides a unified interface for system settings operations,
 * switching between in-memory (legacy) and repository pattern (new) based on feature flags.
 *
 * Usage:
 * ```typescript
 * import { systemSettingsService } from '@/application/services/system-settings-service.adapter';
 *
 * const settings = await systemSettingsService.getAllSystemSettings('club-id-123');
 * ```
 */

import type {
  SystemSettings,
  CreateSystemSettingsInput,
  UpdateSystemSettingsInput,
} from '@/domain/entities/system-settings.entity';
import { SystemSettingsService } from './system-settings.service';
import { DrizzleSystemSettingsRepository } from '@/infrastructure/persistence/repositories/system-settings.repository';
import { FeatureFlags } from '@/lib/features/feature-flags';

class SystemSettingsServiceAdapter {
  private systemSettingsRepo = new DrizzleSystemSettingsRepository();

  /**
   * Validate system settings input
   * Delegates to in-memory service for validation logic
   */
  validateSystemSettingsInput(input: CreateSystemSettingsInput): {
    valid: boolean;
    errors: string[];
  } {
    return SystemSettingsService.validateSystemSettingsInput(input);
  }

  /**
   * Create a new system setting
   */
  async createSystemSetting(
    input: CreateSystemSettingsInput,
    clubId: string | null = null
  ): Promise<SystemSettings> {
    // Always validate
    const validation = this.validateSystemSettingsInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    if (FeatureFlags.USE_SYSTEM_SETTINGS_REPOSITORY) {
      return this.systemSettingsRepo.create(input, clubId);
    }
    return SystemSettingsService.createSystemSetting(input);
  }

  /**
   * Get system setting by ID
   */
  async getSystemSettingById(id: string): Promise<SystemSettings | null> {
    if (FeatureFlags.USE_SYSTEM_SETTINGS_REPOSITORY) {
      return this.systemSettingsRepo.findById(id);
    }
    return SystemSettingsService.getSystemSettingById(id);
  }

  /**
   * Get system setting by key
   */
  async getSystemSettingByKey(
    key: string,
    clubId: string | null = null
  ): Promise<SystemSettings | null> {
    if (FeatureFlags.USE_SYSTEM_SETTINGS_REPOSITORY) {
      return this.systemSettingsRepo.findByKey(key, clubId);
    }
    return SystemSettingsService.getSystemSettingByKey(key);
  }

  /**
   * Get system setting value by key
   */
  async getSystemSettingValue(key: string, clubId: string | null = null): Promise<string | null> {
    if (FeatureFlags.USE_SYSTEM_SETTINGS_REPOSITORY) {
      return this.systemSettingsRepo.getValue(key, clubId);
    }
    return SystemSettingsService.getSystemSettingValue(key);
  }

  /**
   * Get all system settings
   */
  async getAllSystemSettings(clubId: string | null = null): Promise<SystemSettings[]> {
    if (FeatureFlags.USE_SYSTEM_SETTINGS_REPOSITORY) {
      return this.systemSettingsRepo.findAll(clubId);
    }
    return SystemSettingsService.getAllSystemSettings();
  }

  /**
   * Get system settings by category
   */
  async getSystemSettingsByCategory(
    category: SystemSettings['category'],
    clubId: string | null = null
  ): Promise<SystemSettings[]> {
    if (FeatureFlags.USE_SYSTEM_SETTINGS_REPOSITORY) {
      return this.systemSettingsRepo.findByCategory(category, clubId);
    }
    return SystemSettingsService.getSystemSettingsByCategory(category);
  }

  /**
   * Get public system settings
   */
  async getPublicSystemSettings(clubId: string | null = null): Promise<SystemSettings[]> {
    if (FeatureFlags.USE_SYSTEM_SETTINGS_REPOSITORY) {
      return this.systemSettingsRepo.findPublic(clubId);
    }
    return SystemSettingsService.getPublicSystemSettings();
  }

  /**
   * Get system settings as a key-value object
   */
  async getSystemSettingsAsObject(
    category: SystemSettings['category'] | null = null,
    clubId: string | null = null,
    publicOnly: boolean = false
  ): Promise<Record<string, any>> {
    if (FeatureFlags.USE_SYSTEM_SETTINGS_REPOSITORY) {
      return this.systemSettingsRepo.getAsObject(category, clubId, publicOnly);
    }
    return SystemSettingsService.getSystemSettingsAsObject(category);
  }

  /**
   * Update system setting
   */
  async updateSystemSetting(
    id: string,
    input: UpdateSystemSettingsInput,
    updatedBy: string = 'Admin'
  ): Promise<SystemSettings | null> {
    if (FeatureFlags.USE_SYSTEM_SETTINGS_REPOSITORY) {
      return this.systemSettingsRepo.update(id, input, updatedBy);
    }
    return SystemSettingsService.updateSystemSetting(id, input);
  }

  /**
   * Delete system setting
   */
  async deleteSystemSetting(id: string): Promise<boolean> {
    if (FeatureFlags.USE_SYSTEM_SETTINGS_REPOSITORY) {
      return this.systemSettingsRepo.delete(id);
    }
    return SystemSettingsService.deleteSystemSetting(id);
  }
}

// Export singleton instance
export const systemSettingsService = new SystemSettingsServiceAdapter();
