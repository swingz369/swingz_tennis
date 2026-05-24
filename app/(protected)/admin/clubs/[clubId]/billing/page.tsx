import dynamicImport from 'next/dynamic';
import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { Skeleton } from '@/components/ui/skeleton';
import type { Subscription, Invoice } from '@/app/(protected)/admin/billing/billing-client';

const BillingClient = dynamicImport(() => import('@/app/(protected)/admin/billing/billing-client'), {
  loading: () => <Skeleton className="h-96 w-full rounded-xl" />
});

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ClubBillingPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { clubId } = await params;

  // Access control: user must be admin/superadmin of this club
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const hasAccess = memberships?.some(
    (m) =>
      (m.role === 'superadmin' || m.role === 'admin') && m.club_id === clubId
  );

  if (!hasAccess) {
    redirect('/dashboard');
  }

  // Verify club exists
  const { data: club } = await supabase
    .from('clubs')
    .select('id, name')
    .eq('id', clubId)
    .single();

  if (!club) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500">Verein nicht gefunden</p>
        </div>
      </div>
    );
  }

  // --- Fetch subscriptions + members ---
  let subscriptions: Subscription[] = [];
  let members: { id: string; name: string; email: string }[] = [];

  const { data: clubMemberships } = await supabase
    .from('user_club_memberships')
    .select(
      `
        user_id,
        users (
          id,
          email,
          full_name,
          subscription_tier,
          subscription_status,
          stripe_customer_id,
          current_period_end
        )
      `
    )
    .eq('club_id', clubId)
    .eq('is_active', true)
    .eq('role', 'member');

  subscriptions = (clubMemberships || [])
    .map((m: Record<string, unknown>) => {
      const user = m.users as Record<string, unknown> | null;
      if (!user) return null;
      return {
        id: `sub-${user.id}`,
        memberId: String(user.id),
        memberName: String(user.full_name || 'N/A'),
        memberEmail: String(user.email || ''),
        plan: (String(user.subscription_tier || 'free')) as Subscription['plan'],
        status: (String(user.subscription_status || 'active')) as Subscription['status'],
        currentPeriodEnd: String(user.current_period_end || new Date().toISOString()),
        stripeCustomerId: user.stripe_customer_id as string | undefined,
        stripeSubscriptionId: user.stripe_subscription_id as string | undefined,
      } as Subscription;
    })
    .filter((s): s is Subscription => s !== null);

  members = (clubMemberships || [])
    .map((m: Record<string, unknown>) => {
      const user = m.users as Record<string, unknown> | null;
      if (!user) return null;
      return {
        id: String(user.id),
        name: String(user.full_name || 'N/A'),
        email: String(user.email || ''),
      };
    })
    .filter((m): m is { id: string; name: string; email: string } => m !== null);

  // --- Fetch invoices ---
  let invoices: Invoice[] = [];

  const { data: invoicesData } = await supabase
    .from('invoices')
    .select(
      `
        id,
        invoice_number,
        amount,
        currency,
        status,
        due_date,
        paid_at,
        member_id,
        users!inner (full_name)
      `
    )
    .eq('club_id', clubId)
    .order('due_date', { ascending: false });

  invoices = (invoicesData || []).map((inv: Record<string, unknown>) => {
    const users = inv.users as Record<string, unknown> | null;
    return {
      id: String(inv.id),
      invoiceNumber: String(inv.invoice_number || ''),
      memberId: String(inv.member_id || ''),
      memberName: String(users?.full_name || 'N/A'),
      amount: Number(inv.amount ?? 0),
      currency: String(inv.currency || 'EUR'),
      status: (String(inv.status || 'draft')) as Invoice['status'],
      dueDate: String(inv.due_date || ''),
      paidAt: inv.paid_at ? String(inv.paid_at) : undefined,
    } as Invoice;
  });

  return (
    <div className="space-y-4">
      {/* Club context header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary via-brand-primary/95 to-brand-dark px-6 py-4 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/10 backdrop-blur-sm">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white/70">
              <a href={`/admin/clubs/${clubId}/dashboard`} className="hover:underline">
                {club.name}
              </a>
              {' › '}
              Abrechnung
            </p>
          </div>
        </div>
      </div>

      <BillingClient
        initialSubscriptions={subscriptions}
        initialInvoices={invoices}
        members={members}
      />
    </div>
  );
}
