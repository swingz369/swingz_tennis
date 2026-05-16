import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { SepaMandate, Payment, CreateSepaMandate } from '../types/billing';
import type { SepaDirectDebitTransaction, SepaPain008Config } from '../sepa/pain008-generator';
import { generatePain008Xml } from '../sepa/pain008-generator';
import { InvoiceService } from './invoice.service';
import { PaymentService } from './payment.service';

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

export class SepaService {
  private static instance: SepaService;
  private invoiceService = InvoiceService.getInstance();
  private paymentService = PaymentService.getInstance();

  private constructor() {}

  public static getInstance(): SepaService {
    if (!SepaService.instance) {
      SepaService.instance = new SepaService();
    }
    return SepaService.instance;
  }

  async createSepaMandate(data: CreateSepaMandate): Promise<SepaMandate> {
    const mandateReference = `SWINGZ-${data.club_id}-${Date.now()}`;
    const creditorId = process.env.SEPA_CREDITOR_ID || 'DE98ZZZ09999999999';

    const { data: mandate, error } = await supabase
      .from('sepa_mandates')
      .insert({
        club_id: data.club_id,
        member_id: data.member_id,
        mandate_reference: mandateReference,
        creditor_id: creditorId,
        iban: data.iban.replace(/\s/g, ''),
        bic: data.bic,
        account_holder_name: data.account_holder_name,
        signature_date: data.signature_date || new Date().toISOString().split('T')[0],
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create SEPA mandate: ${error.message}`);
    }

    return mandate;
  }

  async getActiveSepaMandate(memberId: string, clubId: string): Promise<SepaMandate | null> {
    const { data, error } = await supabase
      .from('sepa_mandates')
      .select('*')
      .eq('member_id', memberId)
      .eq('club_id', clubId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get SEPA mandate: ${error.message}`);
    }

    return data;
  }

  async getSepaMandateById(mandateId: string): Promise<SepaMandate | null> {
    const { data, error } = await supabase
      .from('sepa_mandates')
      .select('*')
      .eq('id', mandateId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get SEPA mandate: ${error.message}`);
    }

    return data;
  }

  async revokeSepaMandate(mandateId: string, reason?: string): Promise<SepaMandate> {
    const { data, error } = await supabase
      .from('sepa_mandates')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_reason: reason,
      })
      .eq('id', mandateId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to revoke SEPA mandate: ${error.message}`);
    }

    return data;
  }

  async generateSepaDirectDebit(
    paymentIds: string[],
    config?: Partial<SepaPain008Config>
  ): Promise<{ xml: string; fileName: string; transactions: SepaDirectDebitTransaction[] }> {
    const payments = await Promise.all(
      paymentIds.map((id) => this.paymentService.getPaymentById(id))
    );

    const validPayments = payments.filter((p) => p !== null) as Payment[];

    if (validPayments.length === 0) {
      throw new Error('No valid payments found');
    }

    const transactions: SepaDirectDebitTransaction[] = [];

    for (const payment of validPayments) {
      if (!payment.sepa_mandate_id) {
        throw new Error(`Payment ${payment.id} has no SEPA mandate`);
      }

      const mandate = await this.getSepaMandateById(payment.sepa_mandate_id);

      if (!mandate) {
        throw new Error(`SEPA mandate ${payment.sepa_mandate_id} not found`);
      }

      if (mandate.status !== 'active') {
        throw new Error(`SEPA mandate ${payment.sepa_mandate_id} is not active`);
      }

      const invoice = payment.invoice_id
        ? await this.invoiceService.getInvoiceById(payment.invoice_id)
        : null;

      transactions.push({
        paymentId: payment.id,
        mandateId: mandate.id,
        mandateReference: mandate.mandate_reference,
        creditorId: mandate.creditor_id,
        iban: mandate.iban,
        bic: mandate.bic || undefined,
        accountHolderName: mandate.account_holder_name,
        amount: payment.amount,
        currency: 'EUR',
        paymentDate:
          typeof payment.payment_date === 'string'
            ? payment.payment_date
            : payment.payment_date.toISOString().split('T')[0],
        endToEndId: `SWINGZ-${payment.payment_number}`,
        remittanceInformation: invoice
          ? `Rechnung ${invoice.invoice_number}`
          : `Zahlung ${payment.payment_number}`,
      });
    }

    const defaultConfig: SepaPain008Config = {
      creditorName: process.env.SEPA_CREDITOR_NAME || 'SWINGZ Tennis Club',
      creditorAccountIban: process.env.SEPA_CREDITOR_IBAN || '',
      creditorAccountBic: process.env.SEPA_CREDITOR_BIC || undefined,
      creditorId: process.env.SEPA_CREDITOR_ID || 'DE98ZZZ09999999999',
      creditorAddress: {
        street: process.env.SEPA_CREDITOR_STREET || undefined,
        city: process.env.SEPA_CREDITOR_CITY || undefined,
        postalCode: process.env.SEPA_CREDITOR_POSTAL_CODE || undefined,
        country: process.env.SEPA_CREDITOR_COUNTRY || 'DE',
      },
      executionDate: undefined,
      batchBooking: true,
    };

    const finalConfig = { ...defaultConfig, ...config };

    if (!finalConfig.creditorAccountIban) {
      throw new Error('SEPA_CREDITOR_IBAN environment variable is required');
    }

    const xml = generatePain008Xml(transactions, finalConfig);
    const fileName = `SEPA-DD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xml`;

    return { xml, fileName, transactions };
  }

  async getPendingSepaPayments(clubId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('club_id', clubId)
      .eq('payment_method', 'sepa')
      .eq('status', 'pending')
      .order('payment_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get pending SEPA payments: ${error.message}`);
    }

    return data || [];
  }
}

export const sepaService = SepaService.getInstance();
