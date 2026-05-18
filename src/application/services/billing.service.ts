import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type {
  BillingPeriod,
  TrainerBilling,
  BillingLineItem,
  CreateTrainerBillingInput,
  UpdateTrainerBillingInput,
  BillingSummary,
} from '../../domain/entities/billing.entity';

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ── row-to-domain mappers ──────────────────────────────────────────────────

function rowToBillingPeriod(row: Record<string, unknown>): BillingPeriod {
  return {
    id: row.id as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    status: row.status as BillingPeriod['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToTrainerBilling(row: Record<string, unknown>): TrainerBilling {
  return {
    id: row.id as string,
    billingPeriodId: row.billing_period_id as string,
    trainerId: row.trainer_id as string,
    trainerName: row.trainer_name as string,
    totalHours: Number(row.total_hours),
    hourlyRate: Number(row.hourly_rate),
    totalAmount: Number(row.total_amount),
    status: row.status as TrainerBilling['status'],
    invoiceId: row.invoice_id as string | undefined,
    invoiceNumber: row.invoice_number as string | undefined,
    dueDate: row.due_date as string | undefined,
    paidAt: row.paid_at as string | undefined,
    notes: row.notes as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToBillingLineItem(row: Record<string, unknown>): BillingLineItem {
  return {
    id: row.id as string,
    trainerBillingId: row.trainer_billing_id as string,
    date: row.date as string,
    description: row.description as string,
    hours: Number(row.hours),
    rate: Number(row.rate),
    amount: Number(row.amount),
    type: row.type as BillingLineItem['type'],
    sessionId: row.session_id as string | undefined,
  };
}

// ── service ───────────────────────────────────────────────────────────────

export class BillingService {
  /**
   * Create a new billing period
   */
  static async createBillingPeriod(startDate: string, endDate: string): Promise<BillingPeriod> {
    const { data, error } = await supabase
      .from('billing_periods')
      .insert({ start_date: startDate, end_date: endDate, status: 'open' })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create billing period: ${error?.message}`);
    }
    return rowToBillingPeriod(data as Record<string, unknown>);
  }

  /**
   * Get billing period by ID
   */
  static async getBillingPeriodById(id: string): Promise<BillingPeriod | null> {
    const { data, error } = await supabase
      .from('billing_periods')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to get billing period: ${error.message}`);
    return data ? rowToBillingPeriod(data as Record<string, unknown>) : null;
  }

  /**
   * Get all billing periods
   */
  static async getAllBillingPeriods(): Promise<BillingPeriod[]> {
    const { data, error } = await supabase
      .from('billing_periods')
      .select()
      .order('start_date', { ascending: false });

    if (error) throw new Error(`Failed to get billing periods: ${error.message}`);
    return (data ?? []).map((r) => rowToBillingPeriod(r as Record<string, unknown>));
  }

  /**
   * Get current billing period
   */
  static async getCurrentBillingPeriod(): Promise<BillingPeriod | null> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('billing_periods')
      .select()
      .eq('status', 'open')
      .lte('start_date', now)
      .gte('end_date', now)
      .maybeSingle();

    if (error) throw new Error(`Failed to get current billing period: ${error.message}`);
    return data ? rowToBillingPeriod(data as Record<string, unknown>) : null;
  }

  /**
   * Close billing period
   */
  static async closeBillingPeriod(id: string): Promise<BillingPeriod | null> {
    const { data, error } = await supabase
      .from('billing_periods')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(`Failed to close billing period: ${error.message}`);
    return data ? rowToBillingPeriod(data as Record<string, unknown>) : null;
  }

  /**
   * Create trainer billing
   */
  static async createTrainerBilling(input: CreateTrainerBillingInput): Promise<TrainerBilling> {
    const { data, error } = await supabase
      .from('trainer_billings')
      .insert({
        billing_period_id: input.billingPeriodId,
        trainer_id: input.trainerId,
        trainer_name: input.trainerName,
        total_hours: input.totalHours,
        hourly_rate: input.hourlyRate,
        total_amount: input.totalAmount,
        status: 'pending',
        due_date: input.dueDate ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create trainer billing: ${error?.message}`);
    }
    return rowToTrainerBilling(data as Record<string, unknown>);
  }

  /**
   * Get trainer billing by ID
   */
  static async getTrainerBillingById(id: string): Promise<TrainerBilling | null> {
    const { data, error } = await supabase
      .from('trainer_billings')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to get trainer billing: ${error.message}`);
    return data ? rowToTrainerBilling(data as Record<string, unknown>) : null;
  }

  /**
   * Get trainer billings by billing period
   */
  static async getTrainerBillingsByBillingPeriod(
    billingPeriodId: string
  ): Promise<TrainerBilling[]> {
    const { data, error } = await supabase
      .from('trainer_billings')
      .select()
      .eq('billing_period_id', billingPeriodId);

    if (error) throw new Error(`Failed to get trainer billings by period: ${error.message}`);
    return (data ?? []).map((r) => rowToTrainerBilling(r as Record<string, unknown>));
  }

  /**
   * Get trainer billings by trainer ID
   */
  static async getTrainerBillingsByTrainerId(trainerId: string): Promise<TrainerBilling[]> {
    const { data, error } = await supabase
      .from('trainer_billings')
      .select()
      .eq('trainer_id', trainerId);

    if (error) throw new Error(`Failed to get trainer billings by trainer: ${error.message}`);
    return (data ?? []).map((r) => rowToTrainerBilling(r as Record<string, unknown>));
  }

  /**
   * Get all trainer billings, optionally filtered by status
   */
  static async getAllTrainerBillings(status?: string): Promise<TrainerBilling[]> {
    let query = supabase.from('trainer_billings').select();
    if (status) {
      query = query.eq('status', status);
    }
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get trainer billings: ${error.message}`);
    return (data ?? []).map((r) => rowToTrainerBilling(r as Record<string, unknown>));
  }

  /**
   * Update trainer billing
   */
  static async updateTrainerBilling(
    id: string,
    input: UpdateTrainerBillingInput
  ): Promise<TrainerBilling | null> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.status !== undefined) patch.status = input.status;
    if (input.invoiceId !== undefined) patch.invoice_id = input.invoiceId;
    if (input.invoiceNumber !== undefined) patch.invoice_number = input.invoiceNumber;
    if (input.dueDate !== undefined) patch.due_date = input.dueDate;
    if (input.paidAt !== undefined) patch.paid_at = input.paidAt;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await supabase
      .from('trainer_billings')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(`Failed to update trainer billing: ${error.message}`);
    return data ? rowToTrainerBilling(data as Record<string, unknown>) : null;
  }

  /**
   * Mark trainer billing as paid
   */
  static async markTrainerBillingAsPaid(id: string): Promise<TrainerBilling | null> {
    return this.updateTrainerBilling(id, {
      status: 'paid',
      paidAt: new Date().toISOString(),
    });
  }

  /**
   * Mark trainer billing as overdue
   */
  static async markTrainerBillingAsOverdue(id: string): Promise<TrainerBilling | null> {
    return this.updateTrainerBilling(id, {
      status: 'overdue',
    });
  }

  /**
   * Create billing line item
   */
  static async createBillingLineItem(
    trainerBillingId: string,
    date: string,
    description: string,
    hours: number,
    rate: number,
    type: 'training' | 'preparation' | 'meeting' | 'other',
    sessionId?: string
  ): Promise<BillingLineItem> {
    const { data, error } = await supabase
      .from('billing_line_items')
      .insert({
        trainer_billing_id: trainerBillingId,
        date,
        description,
        hours,
        rate,
        amount: hours * rate,
        type,
        session_id: sessionId ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create billing line item: ${error?.message}`);
    }
    return rowToBillingLineItem(data as Record<string, unknown>);
  }

  /**
   * Get billing line items by trainer billing ID
   */
  static async getBillingLineItemsByTrainerBilling(
    trainerBillingId: string
  ): Promise<BillingLineItem[]> {
    const { data, error } = await supabase
      .from('billing_line_items')
      .select()
      .eq('trainer_billing_id', trainerBillingId);

    if (error) throw new Error(`Failed to get billing line items: ${error.message}`);
    return (data ?? []).map((r) => rowToBillingLineItem(r as Record<string, unknown>));
  }

  /**
   * Get all billing line items
   */
  static async getAllBillingLineItems(): Promise<BillingLineItem[]> {
    const { data, error } = await supabase.from('billing_line_items').select();

    if (error) throw new Error(`Failed to get billing line items: ${error.message}`);
    return (data ?? []).map((r) => rowToBillingLineItem(r as Record<string, unknown>));
  }

  /**
   * Calculate billing summary for a billing period
   */
  static async calculateBillingSummary(billingPeriodId: string): Promise<BillingSummary> {
    const periodBillings = await this.getTrainerBillingsByBillingPeriod(billingPeriodId);

    const totalTrainers = periodBillings.length;
    const totalHours = periodBillings.reduce((sum, b) => sum + b.totalHours, 0);
    const totalAmount = periodBillings.reduce((sum, b) => sum + b.totalAmount, 0);
    const pendingAmount = periodBillings
      .filter((b) => b.status === 'pending')
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const processedAmount = periodBillings
      .filter((b) => b.status === 'processed')
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const paidAmount = periodBillings
      .filter((b) => b.status === 'paid')
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const overdueAmount = periodBillings
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

  /**
   * Generate invoice number based on current DB count
   */
  static async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}`;

    const { count } = await supabase
      .from('trainer_billings')
      .select('id', { count: 'exact', head: true })
      .like('invoice_number', `${prefix}%`);

    const next = (count ?? 0) + 1;
    return `${prefix}-${String(next).padStart(4, '0')}`;
  }
}
