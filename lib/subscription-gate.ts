import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * True when the caller's SaaS subscription needs the customer to act (a
 * failed payment) before they should keep using paid features. Checked
 * per-user, not per-club: admin/superadmin subscriptions are billed to the
 * person's own account (see lib/plans.ts and users.subscription_status),
 * not to a club — a multi-club admin can't dodge this by switching clubs.
 */
export async function isSubscriptionPastDue(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('subscription_status')
    .eq('id', userId)
    .maybeSingle();
  return data?.subscription_status === 'past_due' || data?.subscription_status === 'unpaid';
}
