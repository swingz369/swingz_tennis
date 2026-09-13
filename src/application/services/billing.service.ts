import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import type { TablesInsert } from '@/types/supabase';
import { getUserDb } from '@/infrastructure/db';
import {
  BillingRepository,
  type TrainerBilling,
  type BillingLineItem,
  type BillingSummary,
} from '@/infrastructure/persistence/repositories/billing.repository';

export type CreateTrainerBillingInput = Omit<
  TablesInsert<'trainer_billings'>,
  'id' | 'status' | 'created_at' | 'updated_at'
>;

/**
 * Repository-Service für die Domäne "Honorarabrechnung" (ADR-005). Fachlogik
 * (Übungsleiterpauschale) hier, Datenzugriff ausschliesslich im Repository —
 * RLS erzwingt die Mandantentrennung, nicht dieser Service.
 */
export class BillingService {
  private readonly repo: BillingRepository;

  constructor(auth: AuthContext) {
    this.repo = new BillingRepository(getUserDb(auth));
  }

  // ═══ Trainer Billings ═══

  /**
   * Übungsleiterpauschale (§ 3 Nr. 26 EStG): max. 3.000 € steuerfrei p.a.
   * Berechnet den steuerfreien Anteil aus dem bereits im laufenden Jahr
   * genutzten Freibetrag des Trainers.
   */
  async createTrainerBilling(input: CreateTrainerBillingInput): Promise<TrainerBilling> {
    const ANNUAL_LIMIT = 3000;
    const currentYear = new Date().getFullYear();

    const existing = await this.repo.findTaxFreeAmountsForTrainerInYear(
      input.trainer_id,
      currentYear
    );
    const usedThisYear = existing.reduce((sum, b) => sum + b.taxFreeAmount, 0);
    const remaining = Math.max(0, ANNUAL_LIMIT - usedThisYear);
    const taxFreeAmount = Math.min(Number(input.total_amount), remaining);
    const taxableAmount = Number(input.total_amount) - taxFreeAmount;

    return this.repo.createTrainerBilling({
      ...input,
      tax_free_amount: taxFreeAmount,
      taxable_amount: taxableAmount,
      status: 'pending',
    });
  }

  async getTrainerBillingById(id: string): Promise<TrainerBilling> {
    const billing = await this.repo.findTrainerBillingById(id);
    if (!billing) throw new ApiException('NOT_FOUND', 'Trainer-Abrechnung nicht gefunden');
    return billing;
  }

  async getTrainerBillingsByBillingPeriod(billingPeriodId: string): Promise<TrainerBilling[]> {
    return this.repo.findTrainerBillingsByBillingPeriod(billingPeriodId);
  }

  async getTrainerBillingsByTrainerId(trainerId: string): Promise<TrainerBilling[]> {
    return this.repo.findTrainerBillingsByTrainerId(trainerId);
  }

  async getAllTrainerBillings(status?: string): Promise<TrainerBilling[]> {
    return this.repo.findAllTrainerBillings(status);
  }

  async updateTrainerBilling(
    id: string,
    input: {
      status?: TrainerBilling['status'];
      invoiceId?: string;
      invoiceNumber?: string;
      dueDate?: string;
      paidAt?: string;
      notes?: string;
    }
  ): Promise<TrainerBilling> {
    const updated = await this.repo.updateTrainerBilling(id, {
      status: input.status,
      invoice_id: input.invoiceId,
      invoice_number: input.invoiceNumber,
      due_date: input.dueDate,
      paid_at: input.paidAt,
      notes: input.notes,
    });
    if (!updated) throw new ApiException('NOT_FOUND', 'Trainer-Abrechnung nicht gefunden');
    return updated;
  }

  async markTrainerBillingAsPaid(id: string): Promise<TrainerBilling> {
    const updated = await this.repo.markTrainerBillingAsPaid(id);
    if (!updated) throw new ApiException('NOT_FOUND', 'Trainer-Abrechnung nicht gefunden');
    return updated;
  }

  async markTrainerBillingAsOverdue(id: string): Promise<TrainerBilling> {
    const updated = await this.repo.markTrainerBillingAsOverdue(id);
    if (!updated) throw new ApiException('NOT_FOUND', 'Trainer-Abrechnung nicht gefunden');
    return updated;
  }

  async calculateBillingSummary(billingPeriodId: string): Promise<BillingSummary> {
    return this.repo.calculateBillingSummary(billingPeriodId);
  }

  async generateInvoiceNumber(): Promise<string> {
    return this.repo.generateInvoiceNumber();
  }

  // ═══ Billing Line Items ═══

  async createBillingLineItem(input: TablesInsert<'billing_line_items'>): Promise<BillingLineItem> {
    return this.repo.createBillingLineItem(input);
  }

  async getBillingLineItemsByTrainerBilling(trainerBillingId: string): Promise<BillingLineItem[]> {
    return this.repo.findBillingLineItemsByTrainerBilling(trainerBillingId);
  }

  async getAllBillingLineItems(): Promise<BillingLineItem[]> {
    return this.repo.findAllBillingLineItems();
  }
}
