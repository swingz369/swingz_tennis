import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import type { InvoiceStatus } from '@/lib/types/billing';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:open-items');

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Permission check
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    // Rate limit
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);

      const clubId = searchParams.get('clubId');
      const memberId = searchParams.get('memberId');
      const status = searchParams.get('status');
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');

      if (!clubId && !memberId) {
        return NextResponse.json(
          { error: 'Either clubId or memberId is required' },
          { status: 400 }
        );
      }

      let invoices;

      if (clubId) {
        invoices = await billingEngine.getInvoicesByClub(clubId, {
          status: status as InvoiceStatus,
          limit,
          offset,
        });
      } else if (memberId) {
        invoices = await billingEngine.getInvoicesByMember(memberId, {
          status: status as InvoiceStatus,
          limit,
          offset,
        });
      }

      const openInvoices =
        invoices?.filter(
          (invoice) => invoice.status !== 'paid' && invoice.status !== 'cancelled'
        ) || [];

      // Fetch paid amounts per invoice to compute true outstanding balances
      const invoiceIds = openInvoices.map((inv) => inv.id);
      const paidByInvoice: Record<string, number> = {};
      if (invoiceIds.length > 0) {
        const { data: payments } = await auth.supabase
          .from('payments')
          .select('invoice_id, amount')
          .in('invoice_id', invoiceIds)
          .eq('status', 'paid');
        for (const p of payments ?? []) {
          if (p.invoice_id) {
            paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] ?? 0) + (p.amount ?? 0);
          }
        }
      }

      const openItems = openInvoices.map((invoice) => {
        const paid = paidByInvoice[invoice.id] ?? 0;
        return {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          created_at: invoice.created_at,
          due_date: invoice.due_date,
          status: invoice.status,
          amount: invoice.amount,
          tax_amount: invoice.tax_amount,
          outstanding_amount: invoice.amount - paid,
          currency: invoice.currency,
          member_id: invoice.member_id,
          club_id: invoice.club_id,
          is_overdue: invoice.due_date
            ? new Date(invoice.due_date) < new Date() && invoice.status !== 'paid'
            : false,
          days_overdue: invoice.due_date
            ? Math.max(
                0,
                Math.floor(
                  (new Date().getTime() - new Date(invoice.due_date).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              )
            : 0,
        };
      });

      return NextResponse.json({
        open_items: openItems,
        summary: {
          total_count: openItems.length,
          total_outstanding: openItems.reduce((sum, item) => sum + item.outstanding_amount, 0),
          total_overdue: openItems
            .filter((item) => item.is_overdue)
            .reduce((sum, item) => sum + item.outstanding_amount, 0),
          overdue_count: openItems.filter((item) => item.is_overdue).length,
        },
      });
    } catch (error) {
      log.error('Error getting open items:', error);
      return NextResponse.json({ error: 'Failed to get open items' }, { status: 500 });
    }
  });
}
