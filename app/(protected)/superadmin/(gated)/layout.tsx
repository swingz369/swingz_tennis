import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { isSubscriptionPastDue } from '@/lib/subscription-gate';
import { SubscriptionDunningBlock } from '@/components/billing/subscription-dunning-block';

/**
 * Superadmin "gated" route group — everything except /superadmin/onboarding.
 * Sibling (not parent) of onboarding, so this redirect can never loop back
 * into itself: onboarding is structurally outside this layout's subtree.
 */
export default async function SuperadminGatedLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  const { data: userData } = await supabase
    .from('users')
    .select('superadmin_setup_completed_at')
    .eq('id', user.id)
    .maybeSingle();

  if (!userData?.superadmin_setup_completed_at) {
    redirect('/superadmin/onboarding');
  }

  // Dunning: block access once the SaaS subscription is past_due/unpaid.
  // Previously only the admin layout had this check — the school_s/school_l
  // plans (79/99 €) are billed to the superadmin's own account, so this
  // layout needs the identical gate (see lib/subscription-gate.ts).
  if (await isSubscriptionPastDue(supabase, user.id)) {
    return <SubscriptionDunningBlock />;
  }

  return <>{children}</>;
}
