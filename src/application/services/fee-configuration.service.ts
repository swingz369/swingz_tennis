import type {
  FeeConfiguration,
  CreateFeeConfigurationInput,
  UpdateFeeConfigurationInput,
} from '../../domain/entities/fee-configuration.entity';

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
  static validateFeeConfigurationInput(input: CreateFeeConfigurationInput): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!input.name || input.name.trim().length < 2) {
      errors.push('Name muss mindestens 2 Zeichen lang sein');
    }

    if (input.amount == null || input.amount < 0) {
      errors.push('Betrag darf nicht negativ sein');
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

    if (
      input.validFrom &&
      input.validUntil &&
      new Date(input.validFrom) > new Date(input.validUntil)
    ) {
      errors.push('Gültig-ab muss vor Gültig-bis liegen');
    }

    if (input.conditions?.minAge && input.conditions.minAge < 0) {
      errors.push('Mindestalter darf nicht negativ sein');
    }

    if (input.conditions?.maxAge && input.conditions.maxAge < 0) {
      errors.push('Höchstalter darf nicht negativ sein');
    }

    if (
      input.conditions?.minAge &&
      input.conditions?.maxAge &&
      input.conditions.minAge > input.conditions.maxAge
    ) {
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
  static async createFeeConfiguration(
    input: CreateFeeConfigurationInput
  ): Promise<FeeConfiguration> {
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
  static async getFeeConfigurationsByType(
    type: FeeConfiguration['type']
  ): Promise<FeeConfiguration[]> {
    return this.feeConfigurations.filter((f) => f.type === type);
  }

  /**
   * Get fee configurations by billing cycle
   */
  static async getFeeConfigurationsByBillingCycle(
    billingCycle: FeeConfiguration['billingCycle']
  ): Promise<FeeConfiguration[]> {
    return this.feeConfigurations.filter((f) => f.billingCycle === billingCycle);
  }

  /**
   * Update fee configuration
   */
  static async updateFeeConfiguration(
    id: string,
    input: UpdateFeeConfigurationInput
  ): Promise<FeeConfiguration | null> {
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

      if (
        config.conditions.trainingGroup &&
        trainingGroup &&
        !config.conditions.trainingGroup.includes(trainingGroup)
      ) {
        return false;
      }

      return true;
    });
  }
}

// NOTE: initializeMockData() removed — API routes now use the DB-backed adapter
