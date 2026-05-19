import { createClient } from '@/lib/supabase/server';
import type { Invoice, GenerateSeasonInvoiceParams } from '@/lib/types/billing.types';

export async function generateInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string
): Promise<string> {
  const { data, error } = await (supabase as any).rpc('generate_invoice_number', { p_club_id: clubId });
  if (error) throw new Error(`Failed to generate invoice number: ${error.message}`);
  return data as string;
}

async function getClubTaxRate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('clubs')
    .select('tax_rate')
    .eq('id', clubId)
    .single();
  if (error) throw new Error(`Failed to fetch club tax rate: ${error.message}`);
  return (data as any)?.tax_rate ?? 0;
}

export async function createAdhocInvoice(params: {
  club_id: string;
  member_id: string;
  due_date: string;
  notes?: string;
  items: Array<{ description: string; quantity: number; unit_price: number }>;
  created_by: string;
}): Promise<Invoice> {
  const supabase = await createClient();
  const invoice_number = await generateInvoiceNumber(supabase, params.club_id);
  const taxRate = await getClubTaxRate(supabase, params.club_id);
  const subtotal = params.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const tax_amount = subtotal * (taxRate / 100);
  const total_amount = subtotal + tax_amount;

  const { data: invoice, error } = await (supabase as any)
    .from('invoices')
    .insert({
      club_id: params.club_id,
      member_id: params.member_id,
      invoice_number,
      invoice_type: 'adhoc',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: params.due_date,
      status: 'draft',
      subtotal,
      tax_amount,
      total_amount,
      paid_amount: 0,
      currency: 'EUR',
      notes: params.notes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create invoice: ${error.message}`);

  const lineItems = params.items.map((i) => ({
    invoice_id: (invoice as any).id,
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unit_price,
    tax_rate: taxRate,
    total_price: i.quantity * i.unit_price,
    item_type: 'other',
  }));
  const { error: itemsError } = await (supabase as any).from('invoice_items').insert(lineItems);
  if (itemsError) throw new Error(`Failed to create invoice items: ${itemsError.message}`);

  return invoice as Invoice;
}

export async function createMembershipInvoice(params: {
  club_id: string;
  member_id: string;
  season_id: string;
  amount: number;
  due_date: string;
  created_by: string;
}): Promise<Invoice> {
  const supabase = await createClient();
  const invoice_number = await generateInvoiceNumber(supabase, params.club_id);
  const taxRate = await getClubTaxRate(supabase, params.club_id);
  const tax_amount = params.amount * (taxRate / 100);

  const { data, error } = await (supabase as any)
    .from('invoices')
    .insert({
      club_id: params.club_id,
      member_id: params.member_id,
      invoice_number,
      invoice_type: 'membership',
      season_id: params.season_id,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: params.due_date,
      status: 'draft',
      subtotal: params.amount,
      tax_amount,
      total_amount: params.amount + tax_amount,
      paid_amount: 0,
      currency: 'EUR',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Invoice;
}

export async function createSeasonInvoice(params: GenerateSeasonInvoiceParams): Promise<Invoice> {
  const supabase = await createClient();
  const invoice_number = await generateInvoiceNumber(supabase, params.club_id);
  const taxRate = await getClubTaxRate(supabase, params.club_id);

  const { data: feeConfig, error: feeError } = await supabase
    .from('fee_configurations')
    .select('amount, billing_unit_count')
    .eq('id', params.fee_configuration_id)
    .single();
  if (feeError) throw new Error(`Fee config not found: ${feeError.message}`);

  const pricePerUnit = (feeConfig as any)?.amount ?? 0;
  const billingUnitCount = (feeConfig as any)?.billing_unit_count ?? 1;
  const subtotal = pricePerUnit * billingUnitCount;
  const tax_amount = subtotal * (taxRate / 100);
  const total_amount = subtotal + tax_amount;

  const { data: invoice, error } = await (supabase as any)
    .from('invoices')
    .insert({
      club_id: params.club_id,
      member_id: params.member_id,
      invoice_number,
      invoice_type: 'season',
      season_id: params.season_id,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: params.due_date,
      status: 'draft',
      subtotal,
      tax_amount,
      total_amount,
      paid_amount: 0,
      currency: 'EUR',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (params.installment_count > 1) {
    const perInstallment = total_amount / params.installment_count;
    const installments = params.installment_due_dates.map((due_date, i) => ({
      invoice_id: (invoice as any).id,
      installment_number: i + 1,
      amount: perInstallment,
      due_date,
      status: 'pending',
    }));
    const { error: instError } = await (supabase as any).from('invoice_installments').insert(installments);
    if (instError) throw new Error(`Failed to create installments: ${instError.message}`);
  }

  return invoice as Invoice;
}

export async function sendInvoice(invoiceId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('status', 'draft');
  if (error) throw new Error(`Failed to send invoice: ${error.message}`);
}
