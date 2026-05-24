import { createServiceClient } from '@/lib/supabase/service';
import type { Invoice, CreateInvoice, InvoiceWithItems, InvoiceStatus } from '../types/billing';

const supabase = createServiceClient();

async function generateUniqueInvoiceNumber(clubId: string | undefined): Promise<string> {
  const safeId = (clubId || 'UNKNOWN').slice(0, 8);
  const prefix = safeId.toUpperCase();
  const year = new Date().getFullYear();
  try {
    const { data, error } = await supabase.rpc('next_invoice_sequence', { p_club_id: clubId });
    if (!error && data) {
      return `INV-${prefix}-${year}-${String(data).padStart(5, '0')}`;
    }
  } catch {
    // RPC not available — fall through
  }
  // Fallback: base-36 timestamp + random suffix eliminates the Date.now()%100000 collision window
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `INV-${prefix}-${year}-${ts}${rnd}`;
}

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
    return generateUniqueInvoiceNumber(clubId);
  }

  async createInvoice(data: CreateInvoice & { type?: string }): Promise<InvoiceWithItems> {
    const invoiceNumber = await this.generateInvoiceNumber(data.club_id);

    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
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
        type: data.type ?? 'other',
        amount: totalAmount,
        tax_amount: taxAmount,
        due_date: data.due_date,
        status: 'draft',
        currency: 'EUR',
        notes: data.notes ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create invoice: ${error.message}`);
    }

    const items = await Promise.all(
      data.items.map(async (item) => {
        const { data: invoiceItem, error: itemError } = await supabase
          .from('invoice_items')
          .insert({
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })
          .select()
          .single();

        if (itemError) {
          throw new Error(`Failed to create invoice item: ${itemError.message}`);
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

    const { data, error } = await query.order('created_at', { ascending: false });

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

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get invoices: ${error.message}`);
    }

    return data || [];
  }

  async updateInvoiceStatus(invoiceId: string, status: InvoiceStatus): Promise<Invoice> {
    const updateData: Record<string, unknown> = { status };

    if (status === 'paid') {
      updateData.paid_at = new Date().toISOString();
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
      .in('status', ['overdue'])
      .order('due_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get overdue invoices: ${error.message}`);
    }

    return data || [];
  }
}

export const invoiceService = InvoiceService.getInstance();
