import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Permission check
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
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
          status: status as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'dunning',
          limit,
          offset,
        });
      } else if (memberId) {
        invoices = await billingEngine.getInvoicesByMember(memberId, {
          status: status as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'dunning',
          limit,
          offset,
        });
      }

      const openItems =
        invoices
          ?.filter((invoice) => invoice.status !== 'paid' && invoice.status !== 'cancelled')
          .map((invoice) => ({
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            invoice_date: invoice.invoice_date,
            due_date: invoice.due_date,
            status: invoice.status,
            total_amount: invoice.total_amount,
            paid_amount: invoice.paid_amount,
            outstanding_amount: invoice.total_amount - invoice.paid_amount,
            currency: invoice.currency,
            member_id: invoice.member_id,
            club_id: invoice.club_id,
            is_overdue: new Date(invoice.due_date) < new Date() && invoice.status !== 'paid',
            days_overdue: Math.max(
              0,
              Math.floor(
                (new Date().getTime() - new Date(invoice.due_date).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            ),
          })) || [];

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
      console.error('Error getting open items:', error);
      return NextResponse.json({ error: 'Failed to get open items' }, { status: 500 });
    }
  });
}
