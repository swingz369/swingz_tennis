import dynamicImport from 'next/dynamic';
import { requireAdminClub } from '@/lib/admin-context';
import { getPagination, buildPaginationMeta } from '@/lib/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import type { Subscription, Invoice } from './billing-client';

const BillingClient = dynamicImport(() => import('./billing-client'), {
  loading: () => <Skeleton className="h-96 w-full rounded-xl" />,
});

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, clubId } = await requireAdminClub();
  const params = await searchParams;
  const { page, offset, limit } = getPagination(params, 25);

  // --- Fetch subscriptions + members ---
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

  const subscriptions: Subscription[] = (clubMemberships || [])
    .map((m: Record<string, unknown>) => {
      const user = m.users as Record<string, unknown> | null;
      if (!user) return null;
      return {
        id: `sub-${user.id}`,
        memberId: String(user.id),
        memberName: String(user.full_name || 'N/A'),
        memberEmail: String(user.email || ''),
        plan: String(user.subscription_tier || 'free') as Subscription['plan'],
        status: String(user.subscription_status || 'active') as Subscription['status'],
        currentPeriodEnd: String(user.current_period_end || new Date().toISOString()),
        stripeCustomerId: user.stripe_customer_id as string | undefined,
        stripeSubscriptionId: user.stripe_subscription_id as string | undefined,
      } as Subscription;
    })
    .filter((s): s is Subscription => s !== null);

  // Build members list from the same query result
  const members = (clubMemberships || [])
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

  // --- Fetch invoices (server-paginated) ---
  const [{ data: invoicesData }, { count: invoiceCount }] = await Promise.all([
    supabase
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
      .order('due_date', { ascending: false })
      .range(offset, offset + limit - 1),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
  ]);

  const invoicePagination = buildPaginationMeta(page, limit, invoiceCount);

  const invoices: Invoice[] = (invoicesData || []).map((inv: Record<string, unknown>) => {
    const users = inv.users as Record<string, unknown> | null;
    return {
      id: String(inv.id),
      invoiceNumber: String(inv.invoice_number || ''),
      memberId: String(inv.member_id || ''),
      memberName: String(users?.full_name || 'N/A'),
      amount: Number(inv.amount ?? 0),
      currency: String(inv.currency || 'EUR'),
      status: String(inv.status || 'draft') as Invoice['status'],
      dueDate: String(inv.due_date || ''),
      paidAt: inv.paid_at ? String(inv.paid_at) : undefined,
    } as Invoice;
  });

  return (
    <BillingClient
      initialSubscriptions={subscriptions}
      initialInvoices={invoices}
      members={members}
      clubId={clubId}
      invoicePagination={invoicePagination}
      searchParams={params}
    />
  );
}
