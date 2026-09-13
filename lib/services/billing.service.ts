import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { createClient } from '@/lib/supabase/server';
import type { Invoice } from '@/lib/types/billing.types';

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
