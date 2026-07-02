import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { PortalButton } from './subscription/subscribe-button';

/**
 * Admin "gated" route group — everything except /admin/onboarding.
 * Sibling (not parent) of onboarding, so this redirect can never loop back
 * into itself: onboarding is structurally outside this layout's subtree.
 */
export default async function AdminGatedLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isSuperadmin = memberships?.some((m: { role: string }) => m.role === 'superadmin');
  const adminMembership = memberships?.find((m: { role: string }) => m.role === 'admin');
  const clubId = adminMembership?.club_id;

  // Dunning: block access once the SaaS subscription is past_due/unpaid.
  // Rendered inline (not a redirect) so the customer can always reach the
  // billing portal even though the target route itself is also gated.
  const { data: billingProfile } = await supabase
    .from('users')
    .select('subscription_status')
    .eq('id', user.id)
    .maybeSingle();
  if (
    billingProfile?.subscription_status === 'past_due' ||
    billingProfile?.subscription_status === 'unpaid'
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-semibold">Zahlung ausstehend</h1>
          <p className="text-muted-foreground">
            Die Zahlung für dein SwingZ-Abonnement konnte nicht verarbeitet werden. Bitte
            aktualisiere deine Zahlungsmethode, um den Zugriff fortzusetzen.
          </p>
          <PortalButton />
        </div>
      </div>
    );
  }

  // Superadmin always has access regardless of club setup state.
  if (!isSuperadmin && clubId) {
    const { data: clubData } = await supabase
      .from('clubs')
      .select('setup_completed_at')
      .eq('id', clubId)
      .maybeSingle();

    if (clubData && !clubData.setup_completed_at) {
      redirect('/admin/onboarding');
    }
  }

  return <>{children}</>;
}
