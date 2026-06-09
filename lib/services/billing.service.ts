import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase-types';
import { createClient } from '@/lib/supabase/server';
import type { Invoice, GenerateSeasonInvoiceParams } from '@/lib/types/billing.types';
import { seasonBillingService } from '@/lib/billing/season-billing.service';

export async function generateInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string
): Promise<string> {
  const { data, error } = await (supabase as SupabaseClient<Database>).rpc(
    'generate_invoice_number',
    {
      p_club_id: clubId,
    }
  );
  if (error) throw new Error(`Failed to generate invoice number: ${error.message}`);
  return data as string;
}

async function getClubTaxRate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string
): Promise<number> {
  const { data, error } = await supabase.from('clubs').select('tax_rate').eq('id', clubId).single();
  if (error) throw new Error(`Failed to fetch club tax rate: ${error.message}`);
  return (data as { tax_rate?: number } | null)?.tax_rate ?? 0;
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

  const { data: invoice, error } = await (supabase as SupabaseClient<Database>)
    .from('invoices')
    .insert({
      club_id: params.club_id,
      member_id: params.member_id,
      invoice_number,
      invoice_type: 'adhoc',
      due_date: params.due_date,
      status: 'draft',
      amount: total_amount,
      tax_amount,
      currency: 'EUR',
      notes: params.notes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create invoice: ${error.message}`);

  const lineItems = params.items.map((i) => ({
    invoice_id: (invoice as { id: string }).id,
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unit_price,
    tax_rate: taxRate,
    item_type: 'other',
  }));
  const { error: itemsError } = await (supabase as SupabaseClient<Database>)
    .from('invoice_items')
    .insert(lineItems);
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

  const { data, error } = await (supabase as SupabaseClient<Database>)
    .from('invoices')
    .insert({
      club_id: params.club_id,
      member_id: params.member_id,
      invoice_number,
      invoice_type: 'membership',
      season_id: params.season_id,
      due_date: params.due_date,
      status: 'draft',
      amount: params.amount + tax_amount,
      tax_amount,
      currency: 'EUR',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Invoice;
}

/**
 * @deprecated Use `seasonBillingService.generateInvoices(seasonId)` instead.
 * This wrapper exists for backward compatibility with `/api/billing/generate-season-invoices`
 * which still uses installment logic on top of the new line-item-based engine.
 *
 * The new flow:
 *   1. `seasonBillingService.calculatePreview(seasonId)` — honors inaktive Wochen
 *   2. `seasonBillingService.generateInvoices(seasonId)` — line-item invoices with
 *      proper tax_amount, season_id-filtered idempotency, transaction-safe
 *   3. If installments are needed, call `createInstallments(invoiceId, count, dates)`
 *
 * Single source of truth: `lib/billing/season-billing.service.ts`
 */
export async function createSeasonInvoice(params: GenerateSeasonInvoiceParams): Promise<Invoice> {
  const supabase = await createClient();

  // Step 1: trigger the new engine (idempotent — skips already-invoiced members)
  const result = await seasonBillingService.generateInvoices(params.season_id);

  // Step 2: locate the freshly created invoice for THIS member
  const created = result.created.find((c) => c.memberId === params.member_id);
  if (!created) {
    throw new Error(
      `No invoice created for member ${params.member_id} in season ${params.season_id} (likely already invoiced).`
    );
  }

  // Step 3: if installments are requested, add them to the invoice
  if (params.installment_count > 1) {
    if (params.installment_due_dates.length !== params.installment_count) {
      throw new Error(
        `installment_due_dates length (${params.installment_due_dates.length}) must equal installment_count (${params.installment_count})`
      );
    }
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('amount')
      .eq('id', created.invoiceId)
      .single();
    if (error || !invoice) throw new Error(`Failed to fetch invoice: ${error?.message}`);
    const total_amount = (invoice as { amount: number }).amount;
    const perInstallment = total_amount / params.installment_count;
    const installments = params.installment_due_dates.map((due_date, i) => ({
      invoice_id: created.invoiceId,
      installment_number: i + 1,
      amount: perInstallment,
      due_date,
      status: 'pending',
    }));
    const { error: instError } = await (supabase as SupabaseClient<Database>)
      .from('invoice_installments')
      .insert(installments);
    if (instError) throw new Error(`Failed to create installments: ${instError.message}`);
  }

  // Return the full invoice row
  const { data, error } = await (supabase as SupabaseClient<Database>)
    .from('invoices')
    .select('*')
    .eq('id', created.invoiceId)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Invoice not found');
  return data as Invoice;
}

export async function sendInvoice(invoiceId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await (supabase as SupabaseClient<Database>)
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('status', 'draft')
    .select('id');
  if (error) throw new Error(`Failed to send invoice: ${error.message}`);
  if (!data || data.length === 0)
    throw new Error(`Invoice ${invoiceId} not found or not in draft status`);
}
