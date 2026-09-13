/**
 * Trainer-Teildomäne "Honorarabrechnung" für ADR-005 (Domäne Abrechnung,
 * Teil 1). Ein Repository für trainer_billings + billing_line_items, kein
 * Adapter, keine Interfaces — Muster in docs/ARCHIV/2026-09-13-architektur-
 * analyse-datenzugriff.md § 6. RLS-Policy-Korrektur: supabase/migrations/
 * 20260914110000_billing_tables_admin_access.sql (admin, nicht nur
 * superadmin — wie zuvor bei hours_logs/trainer_availabilities/
 * attendance_records/trial_trainings).
 *
 * billing_periods hat club_id; trainer_billings/billing_line_items scopen
 * darüber (billing_period_id → billing_periods.club_id).
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:billing.repository');

export type TrainerBilling = Tables<'trainer_billings'>;
export type BillingLineItem = Tables<'billing_line_items'>;

export type BillingSummary = {
  billingPeriodId: string;
  totalTrainers: number;
  totalHours: number;
  totalAmount: number;
  pendingAmount: number;
  processedAmount: number;
  paidAmount: number;
  overdueAmount: number;
};

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

export class BillingRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  // ═══ Trainer Billings ═══

  async createTrainerBilling(input: TablesInsert<'trainer_billings'>): Promise<TrainerBilling> {
    const { data, error } = await this.db.from('trainer_billings').insert(input).select().single();
    assertNoError(error, 'Anlegen der Trainer-Abrechnung fehlgeschlagen');
    return data!;
  }

  async findTrainerBillingById(id: string): Promise<TrainerBilling | null> {
    const { data, error } = await this.db
      .from('trainer_billings')
      .select()
      .eq('id', id)
      .maybeSingle();
    assertNoError(error, 'Lesen der Trainer-Abrechnung fehlgeschlagen');
    return data;
  }

  async findTrainerBillingsByBillingPeriod(billingPeriodId: string): Promise<TrainerBilling[]> {
    const { data, error } = await this.db
      .from('trainer_billings')
      .select()
      .eq('billing_period_id', billingPeriodId);
    assertNoError(error, 'Lesen der Trainer-Abrechnungen fehlgeschlagen');
    return data ?? [];
  }

  async findTrainerBillingsByTrainerId(trainerId: string): Promise<TrainerBilling[]> {
    const { data, error } = await this.db
      .from('trainer_billings')
      .select()
      .eq('trainer_id', trainerId);
    assertNoError(error, 'Lesen der Trainer-Abrechnungen fehlgeschlagen');
    return data ?? [];
  }

  /** Ohne Club-Kontext: RLS liefert nur, worauf der Aufrufer Zugriff hat. */
  async findAllTrainerBillings(status?: string): Promise<TrainerBilling[]> {
    let query = this.db.from('trainer_billings').select();
    if (status) query = query.eq('status', status);
    const { data, error } = await query.order('created_at', { ascending: false });
    assertNoError(error, 'Lesen der Trainer-Abrechnungen fehlgeschlagen');
    return data ?? [];
  }

  async updateTrainerBilling(
    id: string,
    input: TablesUpdate<'trainer_billings'>
  ): Promise<TrainerBilling | null> {
    const { data, error } = await this.db
      .from('trainer_billings')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    assertNoError(error, 'Aktualisieren der Trainer-Abrechnung fehlgeschlagen');
    return data;
  }

  async markTrainerBillingAsPaid(id: string): Promise<TrainerBilling | null> {
    return this.updateTrainerBilling(id, { status: 'paid', paid_at: new Date().toISOString() });
  }

  async markTrainerBillingAsOverdue(id: string): Promise<TrainerBilling | null> {
    return this.updateTrainerBilling(id, { status: 'overdue' });
  }

  /** Für die Übungsleiterpauschale (§ 3 Nr. 26 EStG): bereits genutzter Freibetrag im laufenden Jahr. */
  async findTaxFreeAmountsForTrainerInYear(
    trainerId: string,
    year: number
  ): Promise<Array<{ taxFreeAmount: number; createdAt: string }>> {
    const { data, error } = await this.db
      .from('trainer_billings')
      .select('tax_free_amount, created_at')
      .eq('trainer_id', trainerId)
      .not('status', 'eq', 'overdue');
    assertNoError(error, 'Lesen der Freibetrags-Historie fehlgeschlagen');
    return (data ?? [])
      .filter((b) => new Date(b.created_at).getFullYear() === year)
      .map((b) => ({ taxFreeAmount: Number(b.tax_free_amount), createdAt: b.created_at }));
  }

  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}`;

    const { count, error } = await this.db
      .from('trainer_billings')
      .select('id', { count: 'exact', head: true })
      .like('invoice_number', `${prefix}%`);
    assertNoError(error, 'Ermitteln der Rechnungsnummer fehlgeschlagen');

    const next = (count ?? 0) + 1;
    return `${prefix}-${String(next).padStart(4, '0')}`;
  }

  async calculateBillingSummary(billingPeriodId: string): Promise<BillingSummary> {
    const billings = await this.findTrainerBillingsByBillingPeriod(billingPeriodId);

    const sumWhere = (pred: (b: TrainerBilling) => boolean) =>
      billings.filter(pred).reduce((sum, b) => sum + Number(b.total_amount), 0);

    return {
      billingPeriodId,
      totalTrainers: billings.length,
      totalHours: billings.reduce((sum, b) => sum + Number(b.total_hours), 0),
      totalAmount: sumWhere(() => true),
      pendingAmount: sumWhere((b) => b.status === 'pending'),
      processedAmount: sumWhere((b) => b.status === 'processed'),
      paidAmount: sumWhere((b) => b.status === 'paid'),
      overdueAmount: sumWhere((b) => b.status === 'overdue'),
    };
  }

  // ═══ Billing Line Items ═══

  async createBillingLineItem(input: TablesInsert<'billing_line_items'>): Promise<BillingLineItem> {
    const { data, error } = await this.db
      .from('billing_line_items')
      .insert(input)
      .select()
      .single();
    assertNoError(error, 'Anlegen der Abrechnungsposition fehlgeschlagen');
    return data!;
  }

  async findBillingLineItemsByTrainerBilling(trainerBillingId: string): Promise<BillingLineItem[]> {
    const { data, error } = await this.db
      .from('billing_line_items')
      .select()
      .eq('trainer_billing_id', trainerBillingId);
    assertNoError(error, 'Lesen der Abrechnungspositionen fehlgeschlagen');
    return data ?? [];
  }

  /** Ohne Club-Kontext: RLS liefert nur, worauf der Aufrufer Zugriff hat. */
  async findAllBillingLineItems(): Promise<BillingLineItem[]> {
    const { data, error } = await this.db.from('billing_line_items').select();
    assertNoError(error, 'Lesen der Abrechnungspositionen fehlgeschlagen');
    return data ?? [];
  }
}
