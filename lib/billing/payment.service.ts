import { createServiceClient } from '@/lib/supabase/service';
import type { Payment, CreatePayment, PaymentStatus } from '../types/billing';

const supabase = createServiceClient();

function fallbackPaymentId(): string {
  return `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class PaymentService {
  private static instance: PaymentService;

  private constructor() {}

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  async createPayment(data: CreatePayment): Promise<Payment> {
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        invoice_id: data.invoice_id ?? null,
        amount: data.amount,
        currency: 'EUR',
        payment_method: data.payment_method,
        status: 'pending',
        external_id: data.external_id ?? fallbackPaymentId(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create payment: ${error.message}`);
    }

    return payment;
  }

  async updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<Payment> {
    const updateData: Record<string, unknown> = { status };

    if (status === 'completed') {
      updateData.paid_at = new Date().toISOString();
    }

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

  async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get payments: ${error.message}`);
    }

    return data || [];
  }
}

export const paymentService = PaymentService.getInstance();
