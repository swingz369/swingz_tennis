import type {
  PaymentSettings,
  CreatePaymentSettingsInput,
  UpdatePaymentSettingsInput,
} from '../entities/payment-settings.entity';

/**
 * Repository interface for managing payment gateway settings
 * Provides database operations with multi-tenant isolation and fee calculation
 */
export interface IPaymentSettingsRepository {
  /**
   * Create new payment settings
   * @param input - Payment settings data
   * @param clubId - Club ID for tenant isolation
   * @returns Created payment settings with generated ID
   * @throws Error if validation fails
   */
  create(input: CreatePaymentSettingsInput, clubId: string): Promise<PaymentSettings>;

  /**
   * Find payment settings by ID
   * @param id - Payment settings ID
   * @param clubId - Club ID for tenant isolation
   * @returns Payment settings if found, null otherwise
   */
  findById(id: string, clubId: string): Promise<PaymentSettings | null>;

  /**
   * Find all payment settings in a club
   * @param clubId - Club ID for tenant isolation
   * @returns Array of all payment settings in the club
   */
  findAll(clubId: string): Promise<PaymentSettings[]>;

  /**
   * Find active payment settings
   * @param clubId - Club ID for tenant isolation
   * @returns Array of active payment settings
   */
  findActive(clubId: string): Promise<PaymentSettings[]>;

  /**
   * Find default payment settings for a club
   * @param clubId - Club ID for tenant isolation
   * @returns Default payment settings if found, null otherwise
   */
  findDefault(clubId: string): Promise<PaymentSettings | null>;

  /**
   * Find payment settings by gateway type
   * @param gateway - Gateway type (stripe, paypal, sepa, cash, other)
   * @param clubId - Club ID for tenant isolation
   * @returns Array of payment settings for the specified gateway
   */
  findByGateway(gateway: PaymentSettings['gateway'], clubId: string): Promise<PaymentSettings[]>;

  /**
   * Update existing payment settings
   * @param id - Payment settings ID
   * @param input - Partial payment settings data to update
   * @param clubId - Club ID for tenant isolation
   * @returns Updated payment settings if found, null otherwise
   * @throws Error if validation fails
   */
  update(
    id: string,
    input: UpdatePaymentSettingsInput,
    clubId: string
  ): Promise<PaymentSettings | null>;

  /**
   * Set payment settings as default (unsets other defaults)
   * @param id - Payment settings ID
   * @param clubId - Club ID for tenant isolation
   * @returns Updated payment settings if found, null otherwise
   */
  setAsDefault(id: string, clubId: string): Promise<PaymentSettings | null>;

  /**
   * Delete payment settings
   * @param id - Payment settings ID
   * @param clubId - Club ID for tenant isolation
   * @returns true if deleted, false if not found
   */
  delete(id: string, clubId: string): Promise<boolean>;

  /**
   * Calculate payment processing fee for a given amount
   * @param paymentSettingsId - Payment settings ID
   * @param amount - Payment amount
   * @returns Calculated fee amount
   */
  calculateFee(paymentSettingsId: string, amount: number): Promise<number>;
}
