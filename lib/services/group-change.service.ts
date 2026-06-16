import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { createClient } from '@/lib/supabase/server';
import type { GroupChangeParams, GroupChangeCreditResult } from '@/lib/types/billing.types';
import { getOrCreateMemberBalance, addBalanceEntry } from './member-balance.service';

export async function processGroupChange(
  params: GroupChangeParams
): Promise<GroupChangeCreditResult> {
  const supabase = await createClient();

  // Load remaining sessions for old group (after change_date, not cancelled)
  const { data: oldSessions, error: oldErr } = await (supabase as SupabaseClient<Database>)
    .from('sessions')
    .select('id, timeslot_start, timeslot_end')
    .contains('group_ids', [params.old_group_id])
    .gt('timeslot_start', params.change_date)
    .not('status', 'in', '("holiday_cancelled","cancelled")');
  if (oldErr) throw new Error(`Failed to load old group sessions: ${oldErr.message}`);

  // Load remaining sessions for new group
  const { data: newSessions, error: newErr } = await (supabase as SupabaseClient<Database>)
    .from('sessions')
    .select('id, timeslot_start, timeslot_end')
    .contains('group_ids', [params.new_group_id])
    .gt('timeslot_start', params.change_date)
    .not('status', 'in', '("holiday_cancelled","cancelled")');
  if (newErr) throw new Error(`Failed to load new group sessions: ${newErr.message}`);

  // Load member's fee config
  const { data: membership, error: memberErr } = await (supabase as SupabaseClient<Database>)
    .from('user_club_memberships')
    .select('fee_configuration_id, fee_configurations(amount, billing_unit_count)')
    .eq('user_id', params.member_id)
    .eq('club_id', params.club_id)
    .eq('is_active', true)
    .maybeSingle();
  if (memberErr) throw new Error(`Failed to load membership: ${memberErr.message}`);

  const feeConfig = membership?.fee_configurations;
  const pricePerUnit: number = feeConfig?.amount ?? 0;
  const billingUnitsPerSession: number = feeConfig?.billing_unit_count ?? 1;

  const calcAmount = (sessions: unknown[]): number =>
    sessions.length * pricePerUnit * billingUnitsPerSession;

  const credit_amount = calcAmount(oldSessions ?? []);
  const charge_amount = calcAmount(newSessions ?? []);
  const net_delta = credit_amount - charge_amount;

  // Update group memberships — close old, open new
  const { error: closeErr } = await (supabase as SupabaseClient<Database>)
    .from('training_group_memberships')
    .update({ left_at: params.change_date, left_reason: 'group_change' })
    .eq('member_id', params.member_id)
    .eq('training_group_id', params.old_group_id)
    .is('left_at', null);
  if (closeErr) throw new Error(`Failed to close group membership: ${closeErr.message}`);

  const { error: openErr } = await (supabase as SupabaseClient<Database>)
    .from('training_group_memberships')
    .insert({
      training_group_id: params.new_group_id,
      member_id: params.member_id,
      club_id: params.club_id,
      joined_at: params.change_date,
      created_by: params.created_by,
    });
  if (openErr) throw new Error(`Failed to open group membership: ${openErr.message}`);

  // Update balance
  const balance = await getOrCreateMemberBalance(supabase as any, params.member_id, params.club_id);

  if (credit_amount > 0) {
    await addBalanceEntry(supabase as any, {
      member_balance_id: balance.id,
      amount: credit_amount,
      reason: `Gutschrift Gruppenwechsel (Austritt)`,
      reference_type: 'group_change',
      created_by: params.created_by,
    });
  }
  if (charge_amount > 0) {
    await addBalanceEntry(supabase as any, {
      member_balance_id: balance.id,
      amount: -charge_amount,
      reason: `Belastung Gruppenwechsel (Eintritt)`,
      reference_type: 'group_change',
      created_by: params.created_by,
    });
  }

  // Re-fetch balance after entries to get the current value from DB
  const { getMemberBalance } = await import('./member-balance.service');
  const updatedBalance = await getMemberBalance(supabase as any, params.member_id, params.club_id);
  const new_balance = updatedBalance?.balance ?? balance.balance + net_delta;
  return { credit_amount, charge_amount, net_delta, new_balance };
}
