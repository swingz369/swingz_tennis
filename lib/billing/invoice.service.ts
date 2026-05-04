import { createClient } from '@supabase/supabase-js';
import type { Invoice, CreateInvoice, InvoiceWithItems, InvoiceStatus } from '../types/billing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class InvoiceService {
  private static instance: InvoiceService;

  private constructor() {}

  public static getInstance(): InvoiceService {
    if (!InvoiceService.instance) {
      InvoiceService.instance = new InvoiceService();
    }
    return InvoiceService.instance;
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

  async createInvoice(data: CreateInvoice): Promise<InvoiceWithItems> {
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
}

export const invoiceService = InvoiceService.getInstance();
