import type {
  Invoice,
  Payment,
  SepaMandate,
  DunningRecord,
  CreateInvoice,
  CreatePayment,
  CreateSepaMandate,
  CreateDunningRecord,
  InvoiceWithItems,
  MemberBillingSummary,
  ClubBillingStats,
  InvoiceStatus,
  PaymentStatus,
} from './types/billing';
import type { SepaDirectDebitTransaction, SepaPain008Config } from './sepa/pain008-generator';
import { InvoiceService } from './billing/invoice.service';
import { PaymentService } from './billing/payment.service';
import { SepaService } from './billing/sepa.service';
import { StatsService } from './billing/stats.service';
import { systemDb } from '@/infrastructure/db';
import { DunningService } from '@/application/services/dunning.service';

export class BillingEngine {
  private static instance: BillingEngine;
  private invoiceService = InvoiceService.getInstance();
  private paymentService = PaymentService.getInstance();
  private sepaService = SepaService.getInstance();
  // Legacy-Fassade ohne Request-Kontext — läuft bewusst über systemDb(),
  // wie zuvor über createServiceClient() in lib/billing/dunning.service.ts.
  private dunningService = new DunningService(
    systemDb('lib/billing-engine.ts Legacy-Fassade (Mahnwesen, kein User-Kontext verfügbar)')
  );
  private statsService = StatsService.getInstance();

  private constructor() {}

  public static getInstance(): BillingEngine {
    if (!BillingEngine.instance) {
      BillingEngine.instance = new BillingEngine();
    }
    return BillingEngine.instance;
  }

  // === Invoice ===

  async generateInvoiceNumber(clubId: string): Promise<string> {
    return this.invoiceService.generateInvoiceNumber(clubId);
  }

  async createInvoice(data: CreateInvoice): Promise<InvoiceWithItems> {
    return this.invoiceService.createInvoice(data);
  }

  async getInvoiceById(invoiceId: string): Promise<InvoiceWithItems | null> {
    return this.invoiceService.getInvoiceById(invoiceId);
  }

  async getInvoicesByMember(
    memberId: string,
    filters?: {
      status?: InvoiceStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<Invoice[]> {
    return this.invoiceService.getInvoicesByMember(memberId, filters);
  }

  async getInvoicesByClub(
    clubId: string,
    filters?: {
      status?: InvoiceStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<Invoice[]> {
    return this.invoiceService.getInvoicesByClub(clubId, filters);
  }

  async updateInvoiceStatus(invoiceId: string, status: InvoiceStatus): Promise<Invoice> {
    return this.invoiceService.updateInvoiceStatus(invoiceId, status);
  }

  async getOverdueInvoices(clubId: string): Promise<Invoice[]> {
    return this.invoiceService.getOverdueInvoices(clubId);
  }

  // === Payment ===

  async createPayment(data: CreatePayment): Promise<Payment> {
    return this.paymentService.createPayment(data);
  }

  async updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<Payment> {
    return this.paymentService.updatePaymentStatus(paymentId, status);
  }

  async getPaymentById(paymentId: string): Promise<Payment | null> {
    return this.paymentService.getPaymentById(paymentId);
  }

  async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    return this.paymentService.getPaymentsByInvoice(invoiceId);
  }

  // === SEPA ===

  async createSepaMandate(data: CreateSepaMandate): Promise<SepaMandate> {
    return this.sepaService.createSepaMandate(data);
  }

  async getActiveSepaMandate(memberId: string, clubId: string): Promise<SepaMandate | null> {
    return this.sepaService.getActiveSepaMandate(memberId, clubId);
  }

  async getSepaMandateById(mandateId: string): Promise<SepaMandate | null> {
    return this.sepaService.getSepaMandateById(mandateId);
  }

  async revokeSepaMandate(mandateId: string, reason?: string): Promise<SepaMandate> {
    return this.sepaService.revokeSepaMandate(mandateId, reason);
  }

  async generateSepaDirectDebit(
    paymentIds: string[],
    config?: Partial<SepaPain008Config>
  ): Promise<{ xml: string; fileName: string; transactions: SepaDirectDebitTransaction[] }> {
    return this.sepaService.generateSepaDirectDebit(paymentIds, config);
  }

  async getPendingSepaPayments(clubId: string): Promise<Payment[]> {
    return this.sepaService.getPendingSepaPayments(clubId);
  }

  // === Dunning ===

  async createDunningRecord(data: CreateDunningRecord): Promise<DunningRecord> {
    return this.dunningService.createDunningRecord(data);
  }

  async getDunningRecordsByInvoice(invoiceId: string): Promise<DunningRecord[]> {
    return this.dunningService.getDunningRecordsByInvoice(invoiceId);
  }

  async processAutomaticDunning(clubId: string): Promise<DunningRecord[]> {
    return this.dunningService.processAutomaticDunning(clubId);
  }

  // === Stats ===

  async getMemberBillingSummary(memberId: string): Promise<MemberBillingSummary> {
    return this.statsService.getMemberBillingSummary(memberId);
  }

  async getClubBillingStats(clubId: string): Promise<ClubBillingStats> {
    return this.statsService.getClubBillingStats(clubId);
  }
}

export const billingEngine = BillingEngine.getInstance();
