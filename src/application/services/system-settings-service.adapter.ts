/**
 * System Settings Service Adapter
 *
 * Drizzle-based system settings operations.
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
    const validation = this.validateSystemSettingsInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return this.systemSettingsRepo.create(input, clubId);
  }

  /**
   * Get system setting by ID
   */
  async getSystemSettingById(id: string): Promise<SystemSettings | null> {
    return this.systemSettingsRepo.findById(id);
  }

  /**
   * Get system setting by key
   */
  async getSystemSettingByKey(
    key: string,
    clubId: string | null = null
  ): Promise<SystemSettings | null> {
    return this.systemSettingsRepo.findByKey(key, clubId);
  }

  /**
   * Get system setting value by key
   */
  async getSystemSettingValue(key: string, clubId: string | null = null): Promise<string | null> {
    return this.systemSettingsRepo.getValue(key, clubId);
  }

  /**
   * Get all system settings
   */
  async getAllSystemSettings(clubId: string | null = null): Promise<SystemSettings[]> {
    return this.systemSettingsRepo.findAll(clubId);
  }

  /**
   * Get system settings by category
   */
  async getSystemSettingsByCategory(
    category: SystemSettings['category'],
    clubId: string | null = null
  ): Promise<SystemSettings[]> {
    return this.systemSettingsRepo.findByCategory(category, clubId);
  }

  /**
   * Get public system settings
   */
  async getPublicSystemSettings(clubId: string | null = null): Promise<SystemSettings[]> {
    return this.systemSettingsRepo.findPublic(clubId);
  }

  /**
   * Get system settings as a key-value object
   */
  async getSystemSettingsAsObject(
    category: SystemSettings['category'] | null = null,
    clubId: string | null = null,
    publicOnly: boolean = false
  ): Promise<Record<string, any>> {
    return this.systemSettingsRepo.getAsObject(category, clubId, publicOnly);
  }

  /**
   * Update system setting
   */
  async updateSystemSetting(
    id: string,
    input: UpdateSystemSettingsInput,
    updatedBy: string = 'Admin'
  ): Promise<SystemSettings | null> {
    return this.systemSettingsRepo.update(id, input, updatedBy);
  }

  /**
   * Delete system setting
   */
  async deleteSystemSetting(id: string): Promise<boolean> {
    return this.systemSettingsRepo.delete(id);
  }
}

// Export singleton instance
export const systemSettingsService = new SystemSettingsServiceAdapter();
