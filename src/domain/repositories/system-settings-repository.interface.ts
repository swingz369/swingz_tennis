import type {
  SystemSettings,
  CreateSystemSettingsInput,
  UpdateSystemSettingsInput,
} from '../entities/system-settings.entity';

/**
 * Repository interface for managing system settings
 * Provides database operations for global and club-specific configuration
 */
export interface ISystemSettingsRepository {
  /**
   * Create a new system setting
   * @param input - Setting data
   * @param clubId - Optional club ID (NULL for global settings)
   * @returns Created setting with generated ID
   * @throws Error if validation fails or key already exists
   */
  create(input: CreateSystemSettingsInput, clubId: string | null): Promise<SystemSettings>;

  /**
   * Find setting by ID
   * @param id - Setting ID
   * @returns Setting if found, null otherwise
   */
  findById(id: string): Promise<SystemSettings | null>;

  /**
   * Find setting by key
   * @param key - Setting key
   * @param clubId - Optional club ID (NULL for global settings)
   * @returns Setting if found, null otherwise
   */
  findByKey(key: string, clubId: string | null): Promise<SystemSettings | null>;

  /**
   * Get setting value by key
   * @param key - Setting key
   * @param clubId - Optional club ID (NULL for global settings)
   * @returns Setting value if found, null otherwise
   */
  getValue(key: string, clubId: string | null): Promise<string | null>;

  /**
   * Find all settings (global or club-specific)
   * @param clubId - Optional club ID (NULL for global settings)
   * @returns Array of all settings
   */
  findAll(clubId: string | null): Promise<SystemSettings[]>;

  /**
   * Find settings by category
   * @param category - Setting category
   * @param clubId - Optional club ID (NULL for global settings)
   * @returns Array of settings in the category
   */
  findByCategory(
    category: SystemSettings['category'],
    clubId: string | null
  ): Promise<SystemSettings[]>;

  /**
   * Find public settings (visible to all users)
   * @param clubId - Optional club ID (NULL for global settings)
   * @returns Array of public settings
   */
  findPublic(clubId: string | null): Promise<SystemSettings[]>;

  /**
   * Get settings as a key-value object
   * @param category - Optional category filter
   * @param clubId - Optional club ID (NULL for global settings)
   * @param publicOnly - Only include public settings
   * @returns Object with setting keys as properties
   */
  getAsObject(
    category: SystemSettings['category'] | null,
    clubId: string | null,
    publicOnly?: boolean
  ): Promise<Record<string, any>>;

  /**
   * Update an existing setting
   * @param id - Setting ID
   * @param input - Partial setting data to update
   * @param updatedBy - User ID of updater
   * @returns Updated setting if found, null otherwise
   * @throws Error if validation fails
   */
  update(
    id: string,
    input: UpdateSystemSettingsInput,
    updatedBy: string
  ): Promise<SystemSettings | null>;

  /**
   * Delete a setting (only if not required)
   * @param id - Setting ID
   * @returns true if deleted, false if not found
   * @throws Error if setting is required
   */
  delete(id: string): Promise<boolean>;
}
