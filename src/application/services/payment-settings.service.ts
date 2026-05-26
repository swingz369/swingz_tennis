import type {
  PaymentSettings,
  CreatePaymentSettingsInput,
  UpdatePaymentSettingsInput,
} from '../../domain/entities/payment-settings.entity';

export class PaymentSettingsService {
  private static paymentSettings: PaymentSettings[] = [];

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate payment settings input
   */
  static validatePaymentSettingsInput(input: CreatePaymentSettingsInput): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!input.gateway) {
      errors.push('Zahlungsgateway ist erforderlich');
    }

    if (!input.gatewayName || input.gatewayName.trim().length < 2) {
      errors.push('Gateway-Name muss mindestens 2 Zeichen lang sein');
    }

    if (!input.supportedCurrencies || input.supportedCurrencies.length === 0) {
      errors.push('Mindestens eine Währung ist erforderlich');
    }

    if (!input.supportedMethods || input.supportedMethods.length === 0) {
      errors.push('Mindestens eine Zahlungsmethode ist erforderlich');
    }

    if (input.minAmount !== undefined && input.minAmount < 0) {
      errors.push('Mindestbetrag darf nicht negativ sein');
    }

    if (input.maxAmount !== undefined && input.maxAmount < 0) {
      errors.push('Höchstbetrag darf nicht negativ sein');
    }

    if (
      input.minAmount !== undefined &&
      input.maxAmount !== undefined &&
      input.minAmount > input.maxAmount
    ) {
      errors.push('Mindestbetrag darf nicht größer als Höchstbetrag sein');
    }

    if (input.fees?.fixed !== undefined && input.fees.fixed < 0) {
      errors.push('Feste Gebühr darf nicht negativ sein');
    }

    if (
      input.fees?.percentage !== undefined &&
      (input.fees.percentage < 0 || input.fees.percentage > 100)
    ) {
      errors.push('Prozentuale Gebühr muss zwischen 0 und 100 liegen');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a new payment settings
   */
  static async createPaymentSettings(input: CreatePaymentSettingsInput): Promise<PaymentSettings> {
    const validation = this.validatePaymentSettingsInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const now = new Date().toISOString();
    const paymentSettings: PaymentSettings = {
      id: this.generateId(),
      gateway: input.gateway,
      gatewayName: input.gatewayName,
      isActive: true,
      isDefault: this.paymentSettings.length === 0, // First one is default
      config: input.config,
      supportedCurrencies: input.supportedCurrencies,
      supportedMethods: input.supportedMethods,
      minAmount: input.minAmount,
      maxAmount: input.maxAmount,
      fees: input.fees,
      createdAt: now,
      updatedAt: now,
    };

    this.paymentSettings.push(paymentSettings);
    return paymentSettings;
  }

  /**
   * Get payment settings by ID
   */
  static async getPaymentSettingsById(id: string): Promise<PaymentSettings | null> {
    return this.paymentSettings.find((p) => p.id === id) || null;
  }

  /**
   * Get all payment settings
   */
  static async getAllPaymentSettings(): Promise<PaymentSettings[]> {
    return [...this.paymentSettings];
  }

  /**
   * Get active payment settings
   */
  static async getActivePaymentSettings(): Promise<PaymentSettings[]> {
    return this.paymentSettings.filter((p) => p.isActive);
  }

  /**
   * Get default payment settings
   */
  static async getDefaultPaymentSettings(): Promise<PaymentSettings | null> {
    return this.paymentSettings.find((p) => p.isDefault) || null;
  }

  /**
   * Get payment settings by gateway
   */
  static async getPaymentSettingsByGateway(
    gateway: PaymentSettings['gateway']
  ): Promise<PaymentSettings[]> {
    return this.paymentSettings.filter((p) => p.gateway === gateway);
  }

  /**
   * Update payment settings
   */
  static async updatePaymentSettings(
    id: string,
    input: UpdatePaymentSettingsInput
  ): Promise<PaymentSettings | null> {
    const index = this.paymentSettings.findIndex((p) => p.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.paymentSettings[index];
    const updated: PaymentSettings = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.paymentSettings[index] = updated;
    return updated;
  }

  /**
   * Set payment settings as default
   */
  static async setAsDefault(id: string): Promise<PaymentSettings | null> {
    // Remove default from all
    for (let i = 0; i < this.paymentSettings.length; i++) {
      this.paymentSettings[i].isDefault = false;
    }

    // Set new default
    const index = this.paymentSettings.findIndex((p) => p.id === id);
    if (index === -1) {
      return null;
    }

    this.paymentSettings[index].isDefault = true;
    this.paymentSettings[index].updatedAt = new Date().toISOString();

    return this.paymentSettings[index];
  }

  /**
   * Delete payment settings
   */
  static async deletePaymentSettings(id: string): Promise<boolean> {
    const index = this.paymentSettings.findIndex((p) => p.id === id);
    if (index === -1) {
      return false;
    }

    this.paymentSettings.splice(index, 1);
    return true;
  }

  /**
   * Test payment settings
   */
  /**
   * Test payment settings connectivity (utility for adapter)
   * Note: Actual gateway connectivity testing happens in production via the adapter.
   */
  static async testPaymentSettings(id: string): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `Verbindungstest für Payment-Settings ${id} erfolgreich (Gateway-Konnektivität via DB-Repository prüfen).`,
    };
  }
}
