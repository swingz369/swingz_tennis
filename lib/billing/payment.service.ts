import { createClient } from '@supabase/supabase-js';
import { Payment, CreatePayment, PaymentStatus } from '../types/billing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class PaymentService {
  private static instance: PaymentService;

  private constructor() {}

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
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
}

export const paymentService = PaymentService.getInstance();
