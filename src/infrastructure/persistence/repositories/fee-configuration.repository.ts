import { eq, and, gte, lte, or, desc, sql, isNull } from 'drizzle-orm';
import { db } from '../db';
import { feeConfigurations } from '../schema';
import type { IFeeConfigurationRepository } from '@/domain/repositories/fee-configuration-repository.interface';
import type {
  FeeConfiguration,
  CreateFeeConfigurationInput,
  UpdateFeeConfigurationInput,
} from '@/domain/entities/fee-configuration.entity';
import { parsePostgresError } from '@/lib/errors/database-errors';

/**
 * Drizzle ORM implementation of the Fee Configuration Repository
 * Manages club pricing/fee configurations with multi-tenant isolation and conditional rules
 */
export class DrizzleFeeConfigurationRepository implements IFeeConfigurationRepository {
  async create(input: CreateFeeConfigurationInput, clubId: string): Promise<FeeConfiguration> {
    const now = new Date();

    try {
      const result = await db
        .insert(feeConfigurations)
        .values({
          club_id: clubId,
          name: input.name,
          description: input.description,
          type: input.type,
          amount: input.amount.toString(),
          currency: input.currency ?? 'EUR',
          billing_cycle: input.billingCycle,
          is_active: true,
          valid_from: input.validFrom ? new Date(input.validFrom) : null,
          valid_until: input.validUntil ? new Date(input.validUntil) : null,
          conditions: input.conditions ?? {},
          created_at: now,
          updated_at: now,
        })
        .returning();

      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async findById(id: string, clubId: string): Promise<FeeConfiguration | null> {
    const result = await db
      .select()
      .from(feeConfigurations)
      .where(and(eq(feeConfigurations.id, id), eq(feeConfigurations.club_id, clubId)))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findAll(clubId: string): Promise<FeeConfiguration[]> {
    const result = await db
      .select()
      .from(feeConfigurations)
      .where(eq(feeConfigurations.club_id, clubId))
      .orderBy(desc(feeConfigurations.created_at));

    return result.map((row) => this.mapToDomain(row));
  }

  async findActive(clubId: string, date?: string): Promise<FeeConfiguration[]> {
    const targetDate = date ? new Date(date) : new Date();

    const result = await db
      .select()
      .from(feeConfigurations)
      .where(
        and(
          eq(feeConfigurations.club_id, clubId),
          eq(feeConfigurations.is_active, true),
          or(isNull(feeConfigurations.valid_from), lte(feeConfigurations.valid_from, targetDate)),
          or(isNull(feeConfigurations.valid_until), gte(feeConfigurations.valid_until, targetDate))
        )
      )
      .orderBy(desc(feeConfigurations.created_at));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByType(type: FeeConfiguration['type'], clubId: string): Promise<FeeConfiguration[]> {
    const result = await db
      .select()
      .from(feeConfigurations)
      .where(and(eq(feeConfigurations.type, type), eq(feeConfigurations.club_id, clubId)))
      .orderBy(desc(feeConfigurations.created_at));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByBillingCycle(
    billingCycle: FeeConfiguration['billingCycle'],
    clubId: string
  ): Promise<FeeConfiguration[]> {
    const result = await db
      .select()
      .from(feeConfigurations)
      .where(
        and(
          eq(feeConfigurations.billing_cycle, billingCycle),
          eq(feeConfigurations.club_id, clubId)
        )
      )
      .orderBy(desc(feeConfigurations.created_at));

    return result.map((row) => this.mapToDomain(row));
  }

  async calculateForMember(
    memberAge: number,
    memberType: string,
    clubId: string,
    trainingGroup?: string
  ): Promise<FeeConfiguration[]> {
    // Use the PostgreSQL helper function
    const result = await db.execute<typeof feeConfigurations.$inferSelect>(sql`
      SELECT *
      FROM calculate_member_fees(
        ${clubId}::uuid,
        ${memberAge}::integer,
        ${memberType}::varchar,
        ${trainingGroup ?? null}::varchar
      )
    `);

    if (!result || result.length === 0) {
      return [];
    }

    return result.map((row) => this.mapToDomain(row));
  }

  async update(
    id: string,
    input: UpdateFeeConfigurationInput,
    clubId: string
  ): Promise<FeeConfiguration | null> {
    const now = new Date();

    try {
      const updateData: any = {
        updated_at: now,
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.type !== undefined) updateData.type = input.type;
      if (input.amount !== undefined) updateData.amount = input.amount.toString();
      if (input.currency !== undefined) updateData.currency = input.currency;
      if (input.billingCycle !== undefined) updateData.billing_cycle = input.billingCycle;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      if (input.validFrom !== undefined)
        updateData.valid_from = input.validFrom ? new Date(input.validFrom) : null;
      if (input.validUntil !== undefined)
        updateData.valid_until = input.validUntil ? new Date(input.validUntil) : null;
      if (input.conditions !== undefined) updateData.conditions = input.conditions;

      const result = await db
        .update(feeConfigurations)
        .set(updateData)
        .where(and(eq(feeConfigurations.id, id), eq(feeConfigurations.club_id, clubId)))
        .returning();

      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async delete(id: string, clubId: string): Promise<boolean> {
    const result = await db
      .delete(feeConfigurations)
      .where(and(eq(feeConfigurations.id, id), eq(feeConfigurations.club_id, clubId)))
      .returning();

    return result.length > 0;
  }

  async deactivate(id: string, clubId: string): Promise<FeeConfiguration | null> {
    return this.update(id, { isActive: false }, clubId);
  }

  async activate(id: string, clubId: string): Promise<FeeConfiguration | null> {
    return this.update(id, { isActive: true }, clubId);
  }

  /**
   * Map database row to domain entity
   */
  private mapToDomain(row: typeof feeConfigurations.$inferSelect): FeeConfiguration {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      type: row.type as 'membership' | 'training' | 'court' | 'other',
      amount: parseFloat(row.amount),
      currency: row.currency,
      billingCycle: row.billing_cycle as 'monthly' | 'quarterly' | 'yearly' | 'one_time',
      isActive: row.is_active,
      validFrom: row.valid_from ? this.formatDate(row.valid_from) : undefined,
      validUntil: row.valid_until ? this.formatDate(row.valid_until) : undefined,
      conditions: row.conditions as
        | {
            minAge?: number;
            maxAge?: number;
            memberType?: string[];
            trainingGroup?: string[];
          }
        | undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Format date to YYYY-MM-DD string
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
