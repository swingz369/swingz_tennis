import {
  FeeConfiguration,
  CreateFeeConfigurationInput,
  UpdateFeeConfigurationInput,
} from '../entities/fee-configuration.entity';

export class FeeConfigurationService {
  private static feeConfigurations: FeeConfiguration[] = [];

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return `fee-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate fee configuration input
   */
  static validateFeeConfigurationInput(input: CreateFeeConfigurationInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.name || input.name.trim().length < 2) {
      errors.push('Name muss mindestens 2 Zeichen lang sein');
    }

    if (!input.amount || input.amount < 0) {
      errors.push('Betrag muss positiv sein');
    }

    if (!input.type) {
      errors.push('Typ ist erforderlich');
    }

    if (!input.billingCycle) {
      errors.push('Abrechnungszyklus ist erforderlich');
    }

    if (input.validFrom && !this.isValidDate(input.validFrom)) {
      errors.push('Ungültiges Gültig-ab-Datum');
    }

    if (input.validUntil && !this.isValidDate(input.validUntil)) {
      errors.push('Ungültiges Gültig-bis-Datum');
    }

    if (input.validFrom && input.validUntil && new Date(input.validFrom) > new Date(input.validUntil)) {
      errors.push('Gültig-ab muss vor Gültig-bis liegen');
    }

    if (input.conditions?.minAge && input.conditions.minAge < 0) {
      errors.push('Mindestalter darf nicht negativ sein');
    }

    if (input.conditions?.maxAge && input.conditions.maxAge < 0) {
      errors.push('Höchstalter darf nicht negativ sein');
    }

    if (input.conditions?.minAge && input.conditions?.maxAge && input.conditions.minAge > input.conditions.maxAge) {
      errors.push('Mindestalter darf nicht größer als Höchstalter sein');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate date format
   */
  private static isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Create a new fee configuration
   */
  static async createFeeConfiguration(input: CreateFeeConfigurationInput): Promise<FeeConfiguration> {
    const validation = this.validateFeeConfigurationInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const now = new Date().toISOString();
    const feeConfiguration: FeeConfiguration = {
      id: this.generateId(),
      name: input.name,
      description: input.description,
      type: input.type,
      amount: input.amount,
      currency: input.currency || 'EUR',
      billingCycle: input.billingCycle,
      isActive: true,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      conditions: input.conditions,
      createdAt: now,
      updatedAt: now,
    };

    this.feeConfigurations.push(feeConfiguration);
    return feeConfiguration;
  }

  /**
   * Get fee configuration by ID
   */
  static async getFeeConfigurationById(id: string): Promise<FeeConfiguration | null> {
    return this.feeConfigurations.find((f) => f.id === id) || null;
  }

  /**
   * Get all fee configurations
   */
  static async getAllFeeConfigurations(): Promise<FeeConfiguration[]> {
    return [...this.feeConfigurations];
  }

  /**
   * Get active fee configurations
   */
  static async getActiveFeeConfigurations(): Promise<FeeConfiguration[]> {
    const now = new Date();
    return this.feeConfigurations.filter((f) => {
      if (!f.isActive) {
        return false;
      }

      if (f.validFrom && new Date(f.validFrom) > now) {
        return false;
      }

      if (f.validUntil && new Date(f.validUntil) < now) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get fee configurations by type
   */
  static async getFeeConfigurationsByType(type: FeeConfiguration['type']): Promise<FeeConfiguration[]> {
    return this.feeConfigurations.filter((f) => f.type === type);
  }

  /**
   * Get fee configurations by billing cycle
   */
  static async getFeeConfigurationsByBillingCycle(billingCycle: FeeConfiguration['billingCycle']): Promise<FeeConfiguration[]> {
    return this.feeConfigurations.filter((f) => f.billingCycle === billingCycle);
  }

  /**
   * Update fee configuration
   */
  static async updateFeeConfiguration(id: string, input: UpdateFeeConfigurationInput): Promise<FeeConfiguration | null> {
    const index = this.feeConfigurations.findIndex((f) => f.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.feeConfigurations[index];
    const updated: FeeConfiguration = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.feeConfigurations[index] = updated;
    return updated;
  }

  /**
   * Delete fee configuration
   */
  static async deleteFeeConfiguration(id: string): Promise<boolean> {
    const index = this.feeConfigurations.findIndex((f) => f.id === id);
    if (index === -1) {
      return false;
    }

    this.feeConfigurations.splice(index, 1);
    return true;
  }

  /**
   * Calculate fee for a member based on conditions
   */
  static async calculateFeeForMember(
    memberType: string,
    memberAge: number,
    trainingGroup?: string
  ): Promise<FeeConfiguration[]> {
    const activeConfigs = await this.getActiveFeeConfigurations();

    return activeConfigs.filter((config) => {
      if (!config.conditions) {
        return true;
      }

      if (config.conditions.memberType && !config.conditions.memberType.includes(memberType)) {
        return false;
      }

      if (config.conditions.minAge && memberAge < config.conditions.minAge) {
        return false;
      }

      if (config.conditions.maxAge && memberAge > config.conditions.maxAge) {
        return false;
      }

      if (config.conditions.trainingGroup && trainingGroup && !config.conditions.trainingGroup.includes(trainingGroup)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Initialize with mock data (for development)
   */
  static initializeMockData(): void {
    const now = new Date();
    
    this.feeConfigurations = [
      {
        id: 'fee-1',
        name: 'Jahresmitgliedschaft Erwachsene',
        description: 'Vollständige Jahresmitgliedschaft für Erwachsene',
        type: 'membership',
        amount: 480,
        currency: 'EUR',
        billingCycle: 'yearly',
        isActive: true,
        validFrom: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        conditions: {
          minAge: 18,
          maxAge: 65,
          memberType: ['member'],
        },
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'fee-2',
        name: 'Jahresmitgliedschaft Jugendliche',
        description: 'Ermäßigte Jahresmitgliedschaft für Jugendliche',
        type: 'membership',
        amount: 240,
        currency: 'EUR',
        billingCycle: 'yearly',
        isActive: true,
        validFrom: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        conditions: {
          minAge: 12,
          maxAge: 17,
          memberType: ['member'],
        },
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'fee-3',
        name: 'Monatliche Trainingsgebühr',
        description: 'Monatliche Gebühr für Gruppentraining',
        type: 'training',
        amount: 45,
        currency: 'EUR',
        billingCycle: 'monthly',
        isActive: true,
        validFrom: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        conditions: {
          memberType: ['member'],
        },
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'fee-4',
        name: 'Platzreservierung',
        description: 'Gebühr für Platzreservierung',
        type: 'court',
        amount: 10,
        currency: 'EUR',
        billingCycle: 'one_time',
        isActive: true,
        validFrom: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'fee-5',
        name: 'Probetraining',
        description: 'Kostenloses Probetraining',
        type: 'training',
        amount: 0,
        currency: 'EUR',
        billingCycle: 'one_time',
        isActive: true,
        validFrom: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        conditions: {
          memberType: ['trial'],
        },
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
  }
}

// Initialize mock data
FeeConfigurationService.initializeMockData();
