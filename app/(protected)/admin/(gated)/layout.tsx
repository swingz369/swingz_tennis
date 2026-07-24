import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireAuth } from '@/lib/auth';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';
import { resolveActiveClub } from '@/lib/auth/resolve-active-club';
import { getHighestRole } from '@/lib/auth-common';
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

  // Resolve the active club via shared helper. Superadmin role implicitly
  // returns clubId=null (platform-staff bypass); admin role falls back to the
  // first admin membership with a real club_id. Single source of truth —
  // same algorithm as `app/(protected)/layout.tsx`, `lib/admin-context.ts`,
  // and `lib/api-auth.ts`, so every auth-aware layer agrees on which clubId
  // to use. This alignment was the F5 cold-SSR fix: previously this layout
  // drifted from the rest of the chain when ADMIN_CLUB_COOKIE pointed at a
  // different club → SPA navigation masked it, F5 surfaced it.
  const cookieStore = await cookies();
  const roles = (memberships ?? []).map((m: { role: string }) => m.role as string);
  const { clubId } = await resolveActiveClub({
    cookieValue: cookieStore.get(ADMIN_CLUB_COOKIE)?.value ?? null,
    memberships: memberships ?? [],
    highestRole: getHighestRole(roles),
  });

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
  const isSuperadmin = roles.includes('superadmin');
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
