import type {
  FeeConfiguration,
  CreateFeeConfigurationInput,
  UpdateFeeConfigurationInput,
} from '../entities/fee-configuration.entity';

/**
 * Repository interface for managing fee configurations
 * Provides database operations with multi-tenant isolation and conditional pricing
 */
export interface IFeeConfigurationRepository {
  /**
   * Create a new fee configuration
   * @param input - Fee configuration data
   * @param clubId - Club ID for tenant isolation
   * @returns Created fee configuration with generated ID
   * @throws Error if validation fails
   */
  create(input: CreateFeeConfigurationInput, clubId: string): Promise<FeeConfiguration>;

  /**
   * Find fee configuration by ID
   * @param id - Fee configuration ID
   * @param clubId - Club ID for tenant isolation
   * @returns Fee configuration if found, null otherwise
   */
  findById(id: string, clubId: string): Promise<FeeConfiguration | null>;

  /**
   * Find all fee configurations in a club
   * @param clubId - Club ID for tenant isolation
   * @returns Array of all fee configurations in the club
   */
  findAll(clubId: string): Promise<FeeConfiguration[]>;

  /**
   * Find active fee configurations (currently valid)
   * @param clubId - Club ID for tenant isolation
   * @param date - Optional date to check validity (defaults to today)
   * @returns Array of active fee configurations
   */
  findActive(clubId: string, date?: string): Promise<FeeConfiguration[]>;

  /**
   * Find fee configurations by type
   * @param type - Fee type (membership, training, court, other)
   * @param clubId - Club ID for tenant isolation
   * @returns Array of fee configurations with the specified type
   */
  findByType(type: FeeConfiguration['type'], clubId: string): Promise<FeeConfiguration[]>;

  /**
   * Find fee configurations by billing cycle
   * @param billingCycle - Billing cycle (monthly, quarterly, yearly, one_time)
   * @param clubId - Club ID for tenant isolation
   * @returns Array of fee configurations with the specified billing cycle
   */
  findByBillingCycle(
    billingCycle: FeeConfiguration['billingCycle'],
    clubId: string
  ): Promise<FeeConfiguration[]>;

  /**
   * Calculate applicable fees for a member based on conditions
   * Filters by age, member type, and training group
   * @param memberAge - Member's age
   * @param memberType - Member type (e.g., 'member', 'trial')
   * @param clubId - Club ID for tenant isolation
   * @param trainingGroup - Optional training group
   * @returns Array of applicable fee configurations
   */
  calculateForMember(
    memberAge: number,
    memberType: string,
    clubId: string,
    trainingGroup?: string
  ): Promise<FeeConfiguration[]>;

  /**
   * Update an existing fee configuration
   * @param id - Fee configuration ID
   * @param input - Partial fee configuration data to update
   * @param clubId - Club ID for tenant isolation
   * @returns Updated fee configuration if found, null otherwise
   * @throws Error if validation fails
   */
  update(
    id: string,
    input: UpdateFeeConfigurationInput,
    clubId: string
  ): Promise<FeeConfiguration | null>;

  /**
   * Delete a fee configuration
   * @param id - Fee configuration ID
   * @param clubId - Club ID for tenant isolation
   * @returns true if deleted, false if not found
   */
  delete(id: string, clubId: string): Promise<boolean>;

  /**
   * Deactivate a fee configuration (soft delete)
   * @param id - Fee configuration ID
   * @param clubId - Club ID for tenant isolation
   * @returns Updated fee configuration if found, null otherwise
   */
  deactivate(id: string, clubId: string): Promise<FeeConfiguration | null>;

  /**
   * Activate a fee configuration
   * @param id - Fee configuration ID
   * @param clubId - Club ID for tenant isolation
   * @returns Updated fee configuration if found, null otherwise
   */
  activate(id: string, clubId: string): Promise<FeeConfiguration | null>;
}
