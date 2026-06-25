import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { trainerBillings } from '../schema';
import type {
  TrainerBilling,
  CreateTrainerBillingInput,
  UpdateTrainerBillingInput,
  BillingSummary,
  TrainerBillingRepository,
} from '@/domain/repositories/trainer-billing-repository.interface';
import { parsePostgresError } from '@/lib/errors/database-errors';

export class DrizzleTrainerBillingRepository implements TrainerBillingRepository {
  async create(input: CreateTrainerBillingInput): Promise<TrainerBilling> {
    const now = new Date();

    try {
      const result = await db
        .insert(trainerBillings)
        .values({
          billing_period_id: input.billingPeriodId,
          trainer_id: input.trainerId,
          trainer_name: input.trainerName,
          total_hours: input.totalHours.toString(),
          hourly_rate: input.hourlyRate.toString(),
          total_amount: input.totalAmount.toString(),
          status: 'pending',
          due_date: input.dueDate ? new Date(input.dueDate) : null,
          notes: input.notes,
          created_at: now,
          updated_at: now,
        })
        .returning();

      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async findById(id: string): Promise<TrainerBilling | null> {
    const result = await db
      .select()
      .from(trainerBillings)
      .where(eq(trainerBillings.id, id))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByBillingPeriod(billingPeriodId: string): Promise<TrainerBilling[]> {
    const result = await db
      .select()
      .from(trainerBillings)
      .where(eq(trainerBillings.billing_period_id, billingPeriodId))
      .orderBy(desc(trainerBillings.created_at));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByTrainerId(trainerId: string): Promise<TrainerBilling[]> {
    const result = await db
      .select()
      .from(trainerBillings)
      .where(eq(trainerBillings.trainer_id, trainerId))
      .orderBy(desc(trainerBillings.created_at));

    return result.map((row) => this.mapToDomain(row));
  }

  async findAll(status?: string): Promise<TrainerBilling[]> {
    const query = status
      ? db.select().from(trainerBillings).where(eq(trainerBillings.status, status))
      : db.select().from(trainerBillings);

    const result = await query.orderBy(desc(trainerBillings.created_at));
    return result.map((row) => this.mapToDomain(row));
  }

  async update(id: string, input: UpdateTrainerBillingInput): Promise<TrainerBilling | null> {
    const now = new Date();

    try {
      const updateData: Partial<typeof trainerBillings.$inferInsert> = {
        updated_at: now,
      };

      if (input.status !== undefined) updateData.status = input.status;
      if (input.invoiceId !== undefined) updateData.invoice_id = input.invoiceId;
      if (input.invoiceNumber !== undefined) updateData.invoice_number = input.invoiceNumber;
      if (input.dueDate !== undefined) updateData.due_date = new Date(input.dueDate);
      if (input.paidAt !== undefined) updateData.paid_at = new Date(input.paidAt);
      if (input.notes !== undefined) updateData.notes = input.notes;

      const result = await db
        .update(trainerBillings)
        .set(updateData)
        .where(eq(trainerBillings.id, id))
        .returning();

      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async markAsPaid(id: string): Promise<TrainerBilling | null> {
    return this.update(id, {
      status: 'paid',
      paidAt: new Date().toISOString(),
    });
  }

  async markAsOverdue(id: string): Promise<TrainerBilling | null> {
    return this.update(id, {
      status: 'overdue',
    });
  }

  async calculateSummary(billingPeriodId: string): Promise<BillingSummary> {
    const billings = await this.findByBillingPeriod(billingPeriodId);

    const totalTrainers = billings.length;
    const totalHours = billings.reduce((sum, b) => sum + b.totalHours, 0);
    const totalAmount = billings.reduce((sum, b) => sum + b.totalAmount, 0);
    const pendingAmount = billings
      .filter((b) => b.status === 'pending')
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const processedAmount = billings
      .filter((b) => b.status === 'processed')
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const paidAmount = billings
      .filter((b) => b.status === 'paid')
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const overdueAmount = billings
      .filter((b) => b.status === 'overdue')
      .reduce((sum, b) => sum + b.totalAmount, 0);

    return {
      billingPeriodId,
      totalTrainers,
      totalHours,
      totalAmount,
      pendingAmount,
      processedAmount,
      paidAmount,
      overdueAmount,
    };
  }

  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}`;

    // Find the highest invoice number for this month
    const result = await db
      .select()
      .from(trainerBillings)
      .where(eq(trainerBillings.invoice_number, prefix))
      .orderBy(desc(trainerBillings.invoice_number))
      .limit(1);

    let nextNumber = 1;
    if (result.length > 0 && result[0].invoice_number) {
      const match = result[0].invoice_number.match(/-(\d{4})$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  async delete(id: string): Promise<void> {
    await db.delete(trainerBillings).where(eq(trainerBillings.id, id));
  }

  private mapToDomain(row: typeof trainerBillings.$inferSelect): TrainerBilling {
    return {
      id: row.id,
      billingPeriodId: row.billing_period_id,
      trainerId: row.trainer_id,
      trainerName: row.trainer_name,
      totalHours: parseFloat(row.total_hours),
      hourlyRate: parseFloat(row.hourly_rate),
      totalAmount: parseFloat(row.total_amount),
      // ponytail: cast — columns added via migration, not yet in Drizzle schema
      taxFreeAmount: parseFloat((row as unknown as Record<string, string>).tax_free_amount ?? '0'),
      taxableAmount: parseFloat(
        (row as unknown as Record<string, string>).taxable_amount ?? row.total_amount
      ),
      status: row.status as 'pending' | 'processed' | 'paid' | 'overdue',
      invoiceId: row.invoice_id ?? undefined,
      invoiceNumber: row.invoice_number ?? undefined,
      dueDate: row.due_date?.toISOString().split('T')[0],
      paidAt: row.paid_at?.toISOString(),
      notes: row.notes ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
