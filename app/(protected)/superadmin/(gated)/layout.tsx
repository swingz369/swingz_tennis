import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { getSubscriptionState } from '@/lib/subscription-gate';
import {
  SubscriptionDunningBlock,
  SubscriptionRequiredBlock,
} from '@/components/billing/subscription-dunning-block';
import { SubscriptionDisabledBanner } from '@/components/billing/subscription-disabled-banner';

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
  const subscription = await getSubscriptionState(supabase, user.id);
  if (subscription === 'past_due') {
    return <SubscriptionDunningBlock />;
  }

  // Pflicht-Abo, identisch zum Admin-Layout (PRODUKTIONSREIFE.md 3.1).
  // Der Superadmin hat das Onboarding an dieser Stelle bereits hinter sich —
  // der Redirect oben stellt das sicher.
  if (subscription === 'none') {
    return <SubscriptionRequiredBlock href="/superadmin/subscription" />;
  }

  return (
    <>
      <SubscriptionDisabledBanner />
      {children}
    </>
  );
}
