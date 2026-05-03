import {
  SystemSettings,
  CreateSystemSettingsInput,
  UpdateSystemSettingsInput,
} from '../../domain/entities/system-settings.entity';

export class SystemSettingsService {
  private static settings: SystemSettings[] = [];

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return `settings-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate system settings input
   */
  static validateSystemSettingsInput(input: CreateSystemSettingsInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.category) {
      errors.push('Kategorie ist erforderlich');
    }

    if (!input.key || input.key.trim().length === 0) {
      errors.push('Schlüssel ist erforderlich');
    }

    if (!input.value || input.value.trim().length === 0) {
      errors.push('Wert ist erforderlich');
    }

    if (!input.type) {
      errors.push('Typ ist erforderlich');
    }

    // Validate based on type
    if (input.type === 'number') {
      const numValue = parseFloat(input.value);
      if (isNaN(numValue)) {
        errors.push('Wert muss eine Zahl sein');
      }
      if (input.validation?.min !== undefined && numValue < input.validation.min) {
        errors.push(`Wert muss mindestens ${input.validation.min} sein`);
      }
      if (input.validation?.max !== undefined && numValue > input.validation.max) {
        errors.push(`Wert darf maximal ${input.validation.max} sein`);
      }
    }

    if (input.type === 'boolean') {
      if (input.value !== 'true' && input.value !== 'false') {
        errors.push('Wert muss true oder false sein');
      }
    }

    if (input.type === 'json' || input.type === 'array') {
      try {
        JSON.parse(input.value);
      } catch (e) {
        errors.push('Wert muss gültiges JSON sein');
      }
    }

    if (input.validation?.pattern) {
      const regex = new RegExp(input.validation.pattern);
      if (!regex.test(input.value)) {
        errors.push('Wert entspricht nicht dem Muster');
      }
    }

    if (input.validation?.enum && !input.validation.enum.includes(input.value)) {
      errors.push(`Wert muss einer der folgenden sein: ${input.validation.enum.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a new system setting
   */
  static async createSystemSetting(input: CreateSystemSettingsInput): Promise<SystemSettings> {
    const validation = this.validateSystemSettingsInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const now = new Date().toISOString();
    const systemSetting: SystemSettings = {
      id: this.generateId(),
      category: input.category,
      key: input.key,
      value: input.value,
      type: input.type,
      description: input.description,
      isPublic: input.isPublic || false,
      isRequired: input.isRequired || false,
      validation: input.validation,
      updatedAt: now,
      updatedBy: 'System',
    };

    this.settings.push(systemSetting);
    return systemSetting;
  }

  /**
   * Get system setting by ID
   */
  static async getSystemSettingById(id: string): Promise<SystemSettings | null> {
    return this.settings.find((s) => s.id === id) || null;
  }

  /**
   * Get system setting by key
   */
  static async getSystemSettingByKey(key: string): Promise<SystemSettings | null> {
    return this.settings.find((s) => s.key === key) || null;
  }

  /**
   * Get system setting value by key
   */
  static async getSystemSettingValue(key: string): Promise<string | null> {
    const setting = await this.getSystemSettingByKey(key);
    return setting ? setting.value : null;
  }

  /**
   * Get all system settings
   */
  static async getAllSystemSettings(): Promise<SystemSettings[]> {
    return [...this.settings];
  }

  /**
   * Get system settings by category
   */
  static async getSystemSettingsByCategory(category: SystemSettings['category']): Promise<SystemSettings[]> {
    return this.settings.filter((s) => s.category === category);
  }

  /**
   * Get public system settings
   */
  static async getPublicSystemSettings(): Promise<SystemSettings[]> {
    return this.settings.filter((s) => s.isPublic);
  }

  /**
   * Update system setting
   */
  static async updateSystemSetting(id: string, input: UpdateSystemSettingsInput): Promise<SystemSettings | null> {
    const index = this.settings.findIndex((s) => s.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.settings[index];

    // Validate new value if provided
    if (input.value) {
      const validation = this.validateSystemSettingsInput({
        category: existing.category,
        key: existing.key,
        value: input.value,
        type: existing.type,
        description: existing.description,
        isPublic: existing.isPublic,
        isRequired: existing.isRequired,
        validation: existing.validation,
      });

      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
    }

    const updated: SystemSettings = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin',
    };

    this.settings[index] = updated;
    return updated;
  }

  /**
   * Delete system setting
   */
  static async deleteSystemSetting(id: string): Promise<boolean> {
    const index = this.settings.findIndex((s) => s.id === id);
    if (index === -1) {
      return false;
    }

    if (this.settings[index].isRequired) {
      throw new Error('Erforderliche Einstellung kann nicht gelöscht werden');
    }

    this.settings.splice(index, 1);
    return true;
  }

  /**
   * Get system settings as a key-value object
   */
  static async getSystemSettingsAsObject(category?: SystemSettings['category']): Promise<Record<string, any>> {
    let settings = this.settings;

    if (category) {
      settings = settings.filter((s) => s.category === category);
    }

    const result: Record<string, any> = {};

    for (const setting of settings) {
      let value: any = setting.value;

      // Parse based on type
      switch (setting.type) {
        case 'number':
          value = parseFloat(value);
          break;
        case 'boolean':
          value = value === 'true';
          break;
        case 'json':
        case 'array':
          value = JSON.parse(value);
          break;
      }

      result[setting.key] = value;
    }

    return result;
  }

  /**
   * Initialize with mock data (for development)
   */
  static initializeMockData(): void {
    const now = new Date();
    
    this.settings = [
      // General Settings
      {
        id: 'settings-1',
        category: 'general',
        key: 'club_name',
        value: 'SwingZ Tennis Club',
        type: 'string',
        description: 'Name des Tennisclubs',
        isPublic: true,
        isRequired: true,
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
      {
        id: 'settings-2',
        category: 'general',
        key: 'club_address',
        value: 'Tennisstraße 123, 12345 Tennisstadt',
        type: 'string',
        description: 'Adresse des Clubs',
        isPublic: true,
        isRequired: true,
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
      {
        id: 'settings-3',
        category: 'general',
        key: 'club_phone',
        value: '+49 123 456 7890',
        type: 'string',
        description: 'Telefonnummer des Clubs',
        isPublic: true,
        isRequired: true,
        validation: {
          pattern: '^\\+?[0-9\\s\\-]+$',
        },
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
      {
        id: 'settings-4',
        category: 'general',
        key: 'club_email',
        value: 'info@swingz.app',
        type: 'string',
        description: 'E-Mail-Adresse des Clubs',
        isPublic: true,
        isRequired: true,
        validation: {
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        },
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
      {
        id: 'settings-5',
        category: 'general',
        key: 'timezone',
        value: 'Europe/Berlin',
        type: 'string',
        description: 'Zeitzone des Clubs',
        isPublic: false,
        isRequired: true,
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
      {
        id: 'settings-6',
        category: 'general',
        key: 'language',
        value: 'de',
        type: 'string',
        description: 'Standardsprache',
        isPublic: false,
        isRequired: true,
        validation: {
          enum: ['de', 'en'],
        },
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
      // Email Settings
      {
        id: 'settings-7',
        category: 'email',
        key: 'email_provider',
        value: 'resend',
        type: 'string',
        description: 'E-Mail-Provider',
        isPublic: false,
        isRequired: true,
        validation: {
          enum: ['resend', 'sendgrid', 'ses', 'mailgun'],
        },
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
      {
        id: 'settings-8',
        category: 'email',
        key: 'email_from_name',
        value: 'SwingZ Tennis Club',
        type: 'string',
        description: 'Absender-Name für E-Mails',
        isPublic: false,
        isRequired: true,
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
      {
        id: 'settings-9',
        category: 'email',
        key: 'email_from_address',
        value: 'noreply@swingz.app',
        type: 'string',
        description: 'Absender-Adresse für E-Mails',
        isPublic: false,
        isRequired: true,
        validation: {
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        },
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
      // Notification Settings
      {
        id: 'settings-10',
        category: 'notifications',
        key: 'enable_email_notifications',
        value: 'true',
        type: 'boolean',
        description: 'E-Mail-Benachrichtigungen aktivieren',
        isPublic: false,
        isRequired: true,
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
      {
        id: 'settings-11',
        category: 'notifications',
        key: 'enable_push_notifications',
        value: 'true',
        type: 'boolean',
        description: 'Push-Benachrichtigungen aktivieren',
        isPublic: false,
        isRequired: true,
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
      {
        id: 'settings-12',
        category: 'notifications',
        key: 'notification_reminder_hours',
        value: '24',
        type: 'number',
        description: 'Stunden vor Termin für Erinnerung',
        isPublic: false,
        isRequired: true,
        validation: {
          min: 1,
          max: 168,
        },
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
      // Security Settings
      {
        id: 'settings-13',
        category: 'security',
        key: 'session_timeout_minutes',
        value: '60',
        type: 'number',
        description: 'Session-Timeout in Minuten',
        isPublic: false,
        isRequired: true,
        validation: {
          min: 5,
          max: 480,
        },
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
      {
        id: 'settings-14',
        category: 'security',
        key: 'max_login_attempts',
        value: '5',
        type: 'number',
        description: 'Maximale Login-Versuche',
        isPublic: false,
        isRequired: true,
        validation: {
          min: 3,
          max: 10,
        },
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
      {
        id: 'settings-15',
        category: 'security',
        key: 'require_2fa',
        value: 'false',
        type: 'boolean',
        description: 'Zwei-Faktor-Authentifizierung erforderlich',
        isPublic: false,
        isRequired: true,
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'System',
      },
    ];
  }
}

// Initialize mock data
SystemSettingsService.initializeMockData();
