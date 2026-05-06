import { eq, desc } from 'drizzle-orm';
import { getDb } from '../client';
import { billingPeriods } from '../schema';
import type {
  BillingPeriod,
  BillingPeriodRepository,
} from '@/domain/repositories/trainer-billing-repository.interface';
import { parsePostgresError } from '@/lib/errors/database-errors';

export class DrizzleBillingPeriodRepository implements BillingPeriodRepository {
  async create(startDate: Date, endDate: Date): Promise<BillingPeriod> {
    const db = getDb();
    const now = new Date();

    try {
      const result = await db
        .insert(billingPeriods)
        .values({
          start_date: startDate,
          end_date: endDate,
          status: 'open',
          created_at: now,
          updated_at: now,
        })
        .returning();

      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async findById(id: string): Promise<BillingPeriod | null> {
    const db = getDb();
    const result = await db.select().from(billingPeriods).where(eq(billingPeriods.id, id)).limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findAll(): Promise<BillingPeriod[]> {
    const db = getDb();
    const result = await db.select().from(billingPeriods).orderBy(desc(billingPeriods.start_date));
    return result.map((row) => this.mapToDomain(row));
  }

  async findCurrent(): Promise<BillingPeriod | null> {
    const db = getDb();
    const now = new Date();

    const result = await db
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.status, 'open'))
      .limit(1);

    // Filter in-memory for date range (or use SQL gte/lte if preferred)
    const current = result.find((p) => {
      const start = new Date(p.start_date);
      const end = new Date(p.end_date);
      return start <= now && end >= now && p.status === 'open';
    });

    return current ? this.mapToDomain(current) : null;
  }

  async close(id: string): Promise<BillingPeriod | null> {
    const db = getDb();
    const now = new Date();

    try {
      const result = await db
        .update(billingPeriods)
        .set({ status: 'closed', updated_at: now })
        .where(eq(billingPeriods.id, id))
        .returning();

      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async delete(id: string): Promise<void> {
    const db = getDb();
    await db.delete(billingPeriods).where(eq(billingPeriods.id, id));
  }

  private mapToDomain(row: typeof billingPeriods.$inferSelect): BillingPeriod {
    return {
      id: row.id,
      startDate: row.start_date.toISOString().split('T')[0], // YYYY-MM-DD format
      endDate: row.end_date.toISOString().split('T')[0],
      status: row.status as 'open' | 'processing' | 'closed',
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
