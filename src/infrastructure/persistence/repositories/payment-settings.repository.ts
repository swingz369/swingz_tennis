import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { paymentSettings } from '../schema';
import type { IPaymentSettingsRepository } from '@/domain/repositories/payment-settings-repository.interface';
import type {
  PaymentSettings,
  CreatePaymentSettingsInput,
  UpdatePaymentSettingsInput,
} from '@/domain/entities/payment-settings.entity';
import { parsePostgresError } from '@/lib/errors/database-errors';

/**
 * Drizzle ORM implementation of the Payment Settings Repository
 * Manages payment gateway configurations with multi-tenant isolation
 */
export class DrizzlePaymentSettingsRepository implements IPaymentSettingsRepository {
  async create(input: CreatePaymentSettingsInput, clubId: string): Promise<PaymentSettings> {
    const now = new Date();

    try {
      // Check if this is the first payment setting for the club
      const existing = await this.findAll(clubId);
      const isFirst = existing.length === 0;

      const result = await db
        .insert(paymentSettings)
        .values({
          club_id: clubId,
          gateway: input.gateway,
          gateway_name: input.gatewayName,
          is_active: true,
          is_default: isFirst, // First one becomes default
          config: input.config,
          supported_currencies: input.supportedCurrencies,
          supported_methods: input.supportedMethods,
          min_amount: input.minAmount?.toString() ?? null,
          max_amount: input.maxAmount?.toString() ?? null,
          fees: input.fees ?? {},
          created_at: now,
          updated_at: now,
        })
        .returning();

      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async findById(id: string, clubId: string): Promise<PaymentSettings | null> {
    const result = await db
      .select()
      .from(paymentSettings)
      .where(and(eq(paymentSettings.id, id), eq(paymentSettings.club_id, clubId)))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findAll(clubId: string): Promise<PaymentSettings[]> {
    const result = await db
      .select()
      .from(paymentSettings)
      .where(eq(paymentSettings.club_id, clubId))
      .orderBy(desc(paymentSettings.is_default), desc(paymentSettings.created_at));

    return result.map((row) => this.mapToDomain(row));
  }

  async findActive(clubId: string): Promise<PaymentSettings[]> {
    const result = await db
      .select()
      .from(paymentSettings)
      .where(and(eq(paymentSettings.club_id, clubId), eq(paymentSettings.is_active, true)))
      .orderBy(desc(paymentSettings.is_default), desc(paymentSettings.created_at));

    return result.map((row) => this.mapToDomain(row));
  }

  async findDefault(clubId: string): Promise<PaymentSettings | null> {
    const result = await db
      .select()
      .from(paymentSettings)
      .where(and(eq(paymentSettings.club_id, clubId), eq(paymentSettings.is_default, true)))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByGateway(
    gateway: PaymentSettings['gateway'],
    clubId: string
  ): Promise<PaymentSettings[]> {
    const result = await db
      .select()
      .from(paymentSettings)
      .where(and(eq(paymentSettings.gateway, gateway), eq(paymentSettings.club_id, clubId)))
      .orderBy(desc(paymentSettings.is_default), desc(paymentSettings.created_at));

    return result.map((row) => this.mapToDomain(row));
  }

  async update(
    id: string,
    input: UpdatePaymentSettingsInput,
    clubId: string
  ): Promise<PaymentSettings | null> {
    const now = new Date();

    try {
      const updateData: any = {
        updated_at: now,
      };

      if (input.gatewayName !== undefined) updateData.gateway_name = input.gatewayName;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      if (input.isDefault !== undefined) updateData.is_default = input.isDefault;
      if (input.config !== undefined) updateData.config = input.config;
      if (input.supportedCurrencies !== undefined)
        updateData.supported_currencies = input.supportedCurrencies;
      if (input.supportedMethods !== undefined)
        updateData.supported_methods = input.supportedMethods;
      if (input.minAmount !== undefined)
        updateData.min_amount = input.minAmount?.toString() ?? null;
      if (input.maxAmount !== undefined)
        updateData.max_amount = input.maxAmount?.toString() ?? null;
      if (input.fees !== undefined) updateData.fees = input.fees;

      const result = await db
        .update(paymentSettings)
        .set(updateData)
        .where(and(eq(paymentSettings.id, id), eq(paymentSettings.club_id, clubId)))
        .returning();

      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async setAsDefault(id: string, clubId: string): Promise<PaymentSettings | null> {
    try {
      // The trigger in the migration will handle unsetting other defaults
      const result = await db
        .update(paymentSettings)
        .set({
          is_default: true,
          updated_at: new Date(),
        })
        .where(and(eq(paymentSettings.id, id), eq(paymentSettings.club_id, clubId)))
        .returning();

      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async delete(id: string, clubId: string): Promise<boolean> {
    const result = await db
      .delete(paymentSettings)
      .where(and(eq(paymentSettings.id, id), eq(paymentSettings.club_id, clubId)))
      .returning();

    return result.length > 0;
  }

  async calculateFee(paymentSettingsId: string, amount: number): Promise<number> {
    // Use the PostgreSQL helper function
    const result = await db.execute<{ calculate_payment_fee: string }>(sql`
      SELECT calculate_payment_fee(
        ${paymentSettingsId}::uuid,
        ${amount}::numeric
      ) as calculate_payment_fee
    `);

    if (!result || result.length === 0) {
      return 0;
    }

    return parseFloat(result[0].calculate_payment_fee);
  }

  /**
   * Map database row to domain entity
   */
  private mapToDomain(row: typeof paymentSettings.$inferSelect): PaymentSettings {
    return {
      id: row.id,
      gateway: row.gateway as 'stripe' | 'paypal' | 'sepa' | 'cash' | 'other',
      gatewayName: row.gateway_name,
      isActive: row.is_active,
      isDefault: row.is_default,
      config: row.config as {
        apiKey?: string;
        publicKey?: string;
        secretKey?: string;
        merchantId?: string;
        webhookUrl?: string;
        [key: string]: any;
      },
      supportedCurrencies: row.supported_currencies,
      supportedMethods: row.supported_methods,
      minAmount: row.min_amount ? parseFloat(row.min_amount) : undefined,
      maxAmount: row.max_amount ? parseFloat(row.max_amount) : undefined,
      fees: row.fees as { fixed?: number; percentage?: number } | undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
