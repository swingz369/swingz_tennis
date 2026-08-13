import Link from 'next/link';
import dynamicImport from 'next/dynamic';
import { requireAdminClub } from '@/lib/admin-context';
import { getPagination, buildPaginationMeta } from '@/lib/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { BillingCategoriesTabs } from './billing-tabs-wrapper';
import { AlertTriangle } from 'lucide-react';
import type { Invoice } from './billing-client';

import { createLogger } from '@/lib/logger';

const log = createLogger('admin:billing:page');

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

  // --- Fetch fee categories (for Kategorien tab) ---
  let feeCategories: Array<{
    id: string;
    name: string;
    type: string;
    amount: number;
    billing_cycle: string;
    is_active: boolean;
  }> = [];
  try {
    const { data } = await supabase
      .from('fee_configurations')
      .select('id, name, type, amount, billing_cycle, is_active')
      .eq('club_id', clubId)
      .order('name');
    feeCategories = data ?? [];
  } catch {
    // Table may not exist or RLS may block
  }

  // Check if there is an active membership fee configuration
  const hasActiveMembershipFee = feeCategories.some(
    (fc) => fc.type === 'membership' && fc.is_active
  );

  // --- Fetch members (members + trainers) ---
  const { data: clubMemberships } = await supabase
    .from('user_club_memberships')
    .select(
      `
        user_id,
        role,
        users (
          id,
          email,
          full_name
        )
      `
    )
    .eq('club_id', clubId)
    .eq('is_active', true)
    .in('role', ['member', 'trainer']);

  // Build members list
  const members = (clubMemberships || [])
    .map((m: Record<string, unknown>) => {
      const user = m.users as Record<string, unknown> | null;
      if (!user) return null;
      return {
        id: String(user.id),
        name: String(user.full_name || 'N/A'),
        email: String(user.email || ''),
        role: String(m.role || 'member'),
      };
    })
    .filter((m): m is { id: string; name: string; email: string; role: string } => m !== null);

  // --- Fetch invoices (server-paginated) ---
  const [{ data: invoicesData, error: invoicesError }, { count: invoiceCount, error: countError }] =
    await Promise.all([
      supabase
        .from('invoices')
        .select(
          `
          id,
          invoice_number,
          subtotal,
          amount,
          paid_amount,
          currency,
          status,
          invoice_date,
          due_date,
          paid_at,
          member_id,
          invoice_type,
          users!invoices_member_id_fkey (full_name)
        `
        )
        .eq('club_id', clubId)
        .order('due_date', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
    ]);

  if (invoicesError) log.error('[BillingPage] invoice query error:', invoicesError);
  if (countError) log.error('[BillingPage] count query error:', countError);

  const invoicePagination = buildPaginationMeta(page, limit, invoiceCount);

  const invoices: Invoice[] = (invoicesData || []).map((inv: Record<string, unknown>) => {
    const users = inv.users as Record<string, unknown> | null;
    return {
      id: String(inv.id),
      invoiceNumber: String(inv.invoice_number || ''),
      memberId: String(inv.member_id || ''),
      memberName: String(users?.full_name || 'N/A'),
      subtotal: Number(inv.subtotal ?? 0),
      amount: Number(inv.amount ?? 0),
      paidAmount: Number(inv.paid_amount ?? 0),
      currency: String(inv.currency || 'EUR'),
      status: String(inv.status || 'draft') as Invoice['status'],
      invoiceType: (inv.invoice_type || undefined) as Invoice['invoiceType'],
      invoiceDate: String(inv.invoice_date || ''),
      dueDate: String(inv.due_date || ''),
      paidAt: inv.paid_at ? String(inv.paid_at) : undefined,
    } as Invoice;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abrechnung"
        description="Rechnungen, Gebührenkategorien und Exporte verwalten"
      />
      <BillingCategoriesTabs
        initialCategories={feeCategories}
        clubId={clubId}
        defaultTab={String(params.tab ?? 'invoices')}
      >
        {!hasActiveMembershipFee && (
          <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-warning-800">
                  Keine aktive Mitgliedsgebühr konfiguriert
                </p>
                <p className="text-sm text-warning-700 mt-1">
                  Rechnungen können erst mit einem Betrag größer 0 erstellt werden, wenn eine aktive
                  Gebühr vom Typ <strong>Mitgliedschaft</strong> existiert.
                </p>
                <Link
                  href="?tab=categories"
                  className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-warning-800 underline hover:text-warning-900 transition-colors"
                >
                  Jetzt Mitgliedsgebühr anlegen →
                </Link>
              </div>
            </div>
          </div>
        )}
        <BillingClient
          initialInvoices={invoices}
          members={members}
          clubId={clubId}
          invoicePagination={invoicePagination}
        />
      </BillingCategoriesTabs>
    </div>
  );
}
