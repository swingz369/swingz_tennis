import { createClient } from '@supabase/supabase-js';
import {
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class BillingEngine {
  private static instance: BillingEngine;

  private constructor() {}

  public static getInstance(): BillingEngine {
    if (!BillingEngine.instance) {
      BillingEngine.instance = new BillingEngine();
    }
    return BillingEngine.instance;
  }

  async generateInvoiceNumber(clubId: string): Promise<string> {
    const { data, error } = await supabase.rpc('generate_invoice_number', {
      p_club_id: clubId,
    });

    if (error) {
      throw new Error(`Failed to generate invoice number: ${error.message}`);
    }

    return data;
  }

  async generatePaymentNumber(clubId: string): Promise<string> {
    const { data, error } = await supabase.rpc('generate_payment_number', {
      p_club_id: clubId,
    });

    if (error) {
      throw new Error(`Failed to generate payment number: ${error.message}`);
    }

    return data;
  }

  async createInvoice(data: CreateInvoice): Promise<Invoice> {
    const invoiceNumber = await this.generateInvoiceNumber(data.club_id);

    const subtotal = data.items.reduce((sum, item) => {
      return sum + item.quantity * item.unit_price;
    }, 0);

    const taxAmount = data.items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unit_price;
      return sum + itemTotal * (item.tax_rate / 100);
    }, 0);

    const totalAmount = subtotal + taxAmount;

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        club_id: data.club_id,
        member_id: data.member_id,
        invoice_number: invoiceNumber,
        invoice_date: data.invoice_date || new Date().toISOString().split('T')[0],
        due_date: data.due_date,
        status: 'draft',
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        paid_amount: 0,
        currency: 'EUR',
        notes: data.notes,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create invoice: ${error.message}`);
    }

    const items = await Promise.all(
      data.items.map(async (item) => {
        const total_price = item.quantity * item.unit_price;
        const { data: invoiceItem, error } = await supabase
          .from('invoice_items')
          .insert({
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            total_price,
            item_type: item.item_type,
            reference_id: item.reference_id,
            reference_type: item.reference_type,
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create invoice item: ${error.message}`);
        }

        return invoiceItem;
      })
    );

    return { ...invoice, items };
  }

  async getInvoiceById(invoiceId: string): Promise<InvoiceWithItems | null> {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(
        `
        *,
        items:invoice_items(*),
        payments:payments(*),
        dunning_records:dunning_records(*)
      `
      )
      .eq('id', invoiceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get invoice: ${error.message}`);
    }

    return invoice;
  }

  async getInvoicesByMember(
    memberId: string,
    filters?: {
      status?: InvoiceStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<Invoice[]> {
    let query = supabase.from('invoices').select('*').eq('member_id', memberId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query.order('invoice_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get invoices: ${error.message}`);
    }

    return data || [];
  }

  async getInvoicesByClub(
    clubId: string,
    filters?: {
      status?: InvoiceStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<Invoice[]> {
    let query = supabase.from('invoices').select('*').eq('club_id', clubId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query.order('invoice_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get invoices: ${error.message}`);
    }

    return data || [];
  }

  async updateInvoiceStatus(invoiceId: string, status: InvoiceStatus): Promise<Invoice> {
    const updateData: {
      status: InvoiceStatus;
      sent_at?: string;
      paid_at?: string;
      cancelled_at?: string;
    } = { status };

    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString();
    } else if (status === 'paid') {
      updateData.paid_at = new Date().toISOString();
    } else if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update invoice status: ${error.message}`);
    }

    return data;
  }

  async createPayment(data: CreatePayment): Promise<Payment> {
    const paymentNumber = await this.generatePaymentNumber(data.club_id);

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        club_id: data.club_id,
        member_id: data.member_id,
        invoice_id: data.invoice_id,
        payment_number: paymentNumber,
        payment_date: data.payment_date || new Date().toISOString().split('T')[0],
        amount: data.amount,
        payment_method: data.payment_method,
        status: 'pending',
        transaction_id: data.transaction_id,
        stripe_payment_intent_id: data.stripe_payment_intent_id,
        sepa_mandate_id: data.sepa_mandate_id,
        notes: data.notes,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create payment: ${error.message}`);
    }

    return payment;
  }

  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    metadata?: {
      processed_at?: string;
      failed_at?: string;
      failure_reason?: string;
      refunded_at?: string;
      refund_amount?: number;
      refund_reason?: string;
    }
  ): Promise<Payment> {
    const updateData: {
      status: PaymentStatus;
      processed_at?: string;
      failed_at?: string;
      failure_reason?: string;
      refunded_at?: string;
      refund_amount?: number;
      refund_reason?: string;
    } = { status, ...metadata };

    const { data, error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update payment status: ${error.message}`);
    }

    return data;
  }

  async getPaymentById(paymentId: string): Promise<Payment | null> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get payment: ${error.message}`);
    }

    return data;
  }

  async getPaymentByStripeId(stripePaymentIntentId: string): Promise<Payment | null> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', stripePaymentIntentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get payment by Stripe ID: ${error.message}`);
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

  async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get payments: ${error.message}`);
    }

    return data || [];
  }

  async getPaymentsByMember(memberId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('member_id', memberId)
      .order('payment_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get payments: ${error.message}`);
    }

    return data || [];
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

  async createDunningRecord(data: CreateDunningRecord): Promise<DunningRecord> {
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('total_amount')
      .eq('id', data.invoice_id)
      .single();

    if (invoiceError) {
      throw new Error(`Failed to get invoice: ${invoiceError.message}`);
    }

    const dunningFee = data.dunning_fee || this.calculateDunningFee(data.dunning_level);
    const totalAmount = invoice.total_amount + dunningFee;

    const { data: dunning, error } = await supabase
      .from('dunning_records')
      .insert({
        club_id: data.club_id,
        member_id: data.member_id,
        invoice_id: data.invoice_id,
        dunning_level: data.dunning_level,
        dunning_date: data.dunning_date || new Date().toISOString().split('T')[0],
        due_date: data.due_date,
        dunning_fee: dunningFee,
        original_amount: invoice.total_amount,
        total_amount: totalAmount,
        status: 'sent',
        sent_at: new Date().toISOString(),
        notes: data.notes,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create dunning record: ${error.message}`);
    }

    await this.updateInvoiceStatus(data.invoice_id, 'dunning');

    return dunning;
  }

  private calculateDunningFee(level: number): number {
    switch (level) {
      case 1:
        return 5.0;
      case 2:
        return 10.0;
      case 3:
        return 20.0;
      default:
        return 0;
    }
  }

  async getDunningRecordsByInvoice(invoiceId: string): Promise<DunningRecord[]> {
    const { data, error } = await supabase
      .from('dunning_records')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('dunning_level', { ascending: true });

    if (error) {
      throw new Error(`Failed to get dunning records: ${error.message}`);
    }

    return data || [];
  }

  async getMemberBillingSummary(memberId: string): Promise<MemberBillingSummary> {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('total_amount, paid_amount, status')
      .eq('member_id', memberId);

    if (error) {
      throw new Error(`Failed to get member invoices: ${error.message}`);
    }

    const totalInvoices = invoices?.length || 0;
    const totalAmount = invoices?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0;
    const paidAmount = invoices?.reduce((sum, inv) => sum + inv.paid_amount, 0) || 0;
    const outstandingAmount = totalAmount - paidAmount;
    const overdueInvoices =
      invoices?.filter((inv) => inv.status === 'overdue' || inv.status === 'dunning').length || 0;

    const { count: activeMandates } = await supabase
      .from('sepa_mandates')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('status', 'active');

    return {
      member_id: memberId,
      total_invoices: totalInvoices,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      outstanding_amount: outstandingAmount,
      overdue_invoices: overdueInvoices,
      active_mandates: activeMandates || 0,
    };
  }

  async getClubBillingStats(clubId: string): Promise<ClubBillingStats> {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('total_amount, paid_amount, status')
      .eq('club_id', clubId);

    if (error) {
      throw new Error(`Failed to get club invoices: ${error.message}`);
    }

    const totalInvoices = invoices?.length || 0;
    const totalRevenue = invoices?.reduce((sum, inv) => sum + inv.paid_amount, 0) || 0;
    const totalAmount = invoices?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0;
    const outstandingAmount = totalAmount - totalRevenue;
    const overdueAmount =
      invoices
        ?.filter((inv) => inv.status === 'overdue' || inv.status === 'dunning')
        .reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0) || 0;

    const { data: payments } = await supabase
      .from('payments')
      .select('payment_method')
      .eq('club_id', clubId)
      .eq('status', 'completed');

    const paymentMethods: Record<string, number> = {};
    payments?.forEach((p) => {
      paymentMethods[p.payment_method] = (paymentMethods[p.payment_method] || 0) + 1;
    });

    const { data: dunningRecords } = await supabase
      .from('dunning_records')
      .select('dunning_level')
      .eq('club_id', clubId)
      .eq('status', 'sent');

    const dunningLevel1 = dunningRecords?.filter((d) => d.dunning_level === 1).length || 0;
    const dunningLevel2 = dunningRecords?.filter((d) => d.dunning_level === 2).length || 0;
    const dunningLevel3 = dunningRecords?.filter((d) => d.dunning_level === 3).length || 0;

    return {
      club_id: clubId,
      total_invoices: totalInvoices,
      total_revenue: totalRevenue,
      paid_amount: totalRevenue,
      outstanding_amount: outstandingAmount,
      overdue_amount: overdueAmount,
      payment_methods: paymentMethods,
      dunning_level_1: dunningLevel1,
      dunning_level_2: dunningLevel2,
      dunning_level_3: dunningLevel3,
    };
  }

  async getOverdueInvoices(clubId: string): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('club_id', clubId)
      .in('status', ['overdue', 'dunning'])
      .order('due_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get overdue invoices: ${error.message}`);
    }

    return data || [];
  }

  async processAutomaticDunning(clubId: string): Promise<DunningRecord[]> {
    const overdueInvoices = await this.getOverdueInvoices(clubId);
    const newDunningRecords: DunningRecord[] = [];

    for (const invoice of overdueInvoices) {
      const { data: existingDunning } = await supabase
        .from('dunning_records')
        .select('*')
        .eq('invoice_id', invoice.id)
        .eq('status', 'sent')
        .order('dunning_level', { ascending: false })
        .limit(1);

      const currentLevel = existingDunning?.[0]?.dunning_level || 0;
      const { data: level } = await supabase.rpc('calculate_dunning_level', {
        p_invoice_id: invoice.id,
      });

      if (level && level > currentLevel) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        const dunning = await this.createDunningRecord({
          club_id: invoice.club_id,
          member_id: invoice.member_id,
          invoice_id: invoice.id,
          dunning_level: level,
          due_date: dueDate.toISOString().split('T')[0],
        });

        newDunningRecords.push(dunning);
      }
    }

    return newDunningRecords;
  }
}

export const billingEngine = BillingEngine.getInstance();
