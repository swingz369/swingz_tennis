import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import BillingClient from './billing-client';
import type { Subscription, Invoice } from './billing-client';

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BillingPage() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      redirect('/login');
    }

    // Get the user's active admin membership to determine club context
    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('role, club_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const isSuperadmin = memberships?.some((m: { role: string }) => m.role === 'superadmin');
    const adminMembership = memberships?.find((m: { role: string }) => m.role === 'admin');

    // Only superadmins and admins can access this page
    if (!isSuperadmin && !adminMembership) {
      redirect('/dashboard');
    }

    // For superadmins: use the first membership's club, or null for platform-wide view
    // For regular admins: use their specific club
    const clubId = adminMembership?.club_id ?? memberships?.[0]?.club_id ?? null;

    // --- Fetch subscriptions + members ---
    let subscriptions: Subscription[] = [];
    let members: { id: string; name: string; email: string }[] = [];

    if (clubId) {
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
            plan: String(user.subscription_tier || 'free') as Subscription['plan'],
            status: String(user.subscription_status || 'active') as Subscription['status'],
            currentPeriodEnd: String(user.current_period_end || new Date().toISOString()),
            stripeCustomerId: user.stripe_customer_id as string | undefined,
            stripeSubscriptionId: user.stripe_subscription_id as string | undefined,
          } as Subscription;
        })
        .filter((s): s is Subscription => s !== null);

      // Build members list from the same query result
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
    }

    // --- Fetch invoices ---
    let invoices: Invoice[] = [];

    if (clubId) {
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
          status: String(inv.status || 'draft') as Invoice['status'],
          dueDate: String(inv.due_date || ''),
          paidAt: inv.paid_at ? String(inv.paid_at) : undefined,
        } as Invoice;
      });
    }

    return (
      <BillingClient
        initialSubscriptions={subscriptions}
        initialInvoices={invoices}
        members={members}
        clubId={clubId}
      />
    );
  } catch (error) {
    console.error('[Billing Page] Error:', error);
    return (
      <BillingClient initialSubscriptions={[]} initialInvoices={[]} members={[]} clubId={null} />
    );
  }
}
