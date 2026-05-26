import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { billingLineItems } from '../schema';
import type {
  BillingLineItem,
  BillingLineItemRepository,
} from '@/domain/repositories/trainer-billing-repository.interface';
import { parsePostgresError } from '@/lib/errors/database-errors';

export class DrizzleBillingLineItemRepository implements BillingLineItemRepository {
  async create(
    trainerBillingId: string,
    date: Date,
    description: string,
    hours: number,
    rate: number,
    type: 'training' | 'preparation' | 'meeting' | 'other',
    sessionId?: string
  ): Promise<BillingLineItem> {
    const amount = hours * rate;
    const now = new Date();

    try {
      const result = await db
        .insert(billingLineItems)
        .values({
          trainer_billing_id: trainerBillingId,
          date,
          description,
          hours: hours.toString(),
          rate: rate.toString(),
          amount: amount.toString(),
          type,
          session_id: sessionId ?? null,
          created_at: now,
        })
        .returning();

      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async findByTrainerBilling(trainerBillingId: string): Promise<BillingLineItem[]> {
    const result = await db
      .select()
      .from(billingLineItems)
      .where(eq(billingLineItems.trainer_billing_id, trainerBillingId))
      .orderBy(desc(billingLineItems.date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findAll(): Promise<BillingLineItem[]> {
    const result = await db.select().from(billingLineItems).orderBy(desc(billingLineItems.date));
    return result.map((row) => this.mapToDomain(row));
  }

  async update(id: string, data: Partial<BillingLineItem>): Promise<BillingLineItem | null> {

    try {
      const updateData: any = {};

      if (data.date !== undefined) updateData.date = new Date(data.date);
      if (data.description !== undefined) updateData.description = data.description;
      if (data.hours !== undefined) updateData.hours = data.hours.toString();
      if (data.rate !== undefined) updateData.rate = data.rate.toString();
      if (data.amount !== undefined) updateData.amount = data.amount.toString();
      if (data.type !== undefined) updateData.type = data.type;
      if (data.sessionId !== undefined) updateData.session_id = data.sessionId;

      const result = await db
        .update(billingLineItems)
        .set(updateData)
        .where(eq(billingLineItems.id, id))
        .returning();

      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async delete(id: string): Promise<void> {
    await db.delete(billingLineItems).where(eq(billingLineItems.id, id));
  }

  private mapToDomain(row: typeof billingLineItems.$inferSelect): BillingLineItem {
    return {
      id: row.id,
      trainerBillingId: row.trainer_billing_id,
      date: row.date.toISOString().split('T')[0], // YYYY-MM-DD format
      description: row.description,
      hours: parseFloat(row.hours),
      rate: parseFloat(row.rate),
      amount: parseFloat(row.amount),
      type: row.type as 'training' | 'preparation' | 'meeting' | 'other',
      sessionId: row.session_id ?? undefined,
    };
  }
}
