import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MemberBalance,
  MemberBalanceEntry,
  BalanceEntryReferenceType,
} from '@/lib/types/billing.types';

export async function getOrCreateMemberBalance(
  supabase: SupabaseClient,
  memberId: string,
  clubId: string
): Promise<MemberBalance> {
  const existing = await getMemberBalance(supabase, memberId, clubId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('member_balances')
    .insert({ member_id: memberId, club_id: clubId, balance: 0 })
    .select()
    .single();

  if (error) throw new Error(`Failed to create member balance: ${error.message}`);
  return data as MemberBalance;
}

export async function getMemberBalance(
  supabase: SupabaseClient,
  memberId: string,
  clubId: string
): Promise<MemberBalance | null> {
  const { data } = await supabase
    .from('member_balances')
    .select('*')
    .eq('member_id', memberId)
    .eq('club_id', clubId)
    .maybeSingle();

  return (data as MemberBalance) ?? null;
}

export async function addBalanceEntry(
  supabase: SupabaseClient,
  params: {
    member_balance_id: string;
    amount: number;
    reason: string;
    reference_type?: BalanceEntryReferenceType;
    reference_id?: string;
    created_by?: string;
  }
): Promise<MemberBalanceEntry> {
  const { data, error } = await supabase.rpc('add_balance_entry_atomic', {
    p_balance_id: params.member_balance_id,
    p_amount: params.amount,
    p_reason: params.reason,
    p_reference_type: params.reference_type ?? null,
    p_reference_id: params.reference_id ?? null,
    p_created_by: params.created_by ?? null,
  });

  if (error) throw new Error(`Failed to create balance entry: ${error.message}`);

  // rpc returns array for RETURNS TABLE functions
  const entry = Array.isArray(data) ? data[0] : data;
  if (!entry) throw new Error('Balance entry creation returned no data');

  return entry as MemberBalanceEntry;
}

export async function getMemberBalanceHistory(
  supabase: SupabaseClient,
  memberId: string,
  clubId: string
): Promise<MemberBalanceEntry[]> {
  const balance = await getMemberBalance(supabase, memberId, clubId);
  if (!balance) return [];

  const { data } = await supabase
    .from('member_balance_entries')
    .select('*')
    .eq('member_balance_id', balance.id)
    .order('created_at', { ascending: false });

  return (data as MemberBalanceEntry[]) ?? [];
}
