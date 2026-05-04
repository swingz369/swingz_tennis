import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Members can view invoices
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);

      const clubId = searchParams.get('clubId');
      const memberId = searchParams.get('memberId');
      const status = searchParams.get('status');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
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

      // Filter by date range if provided
      let filteredInvoices = invoices || [];

      if (startDate) {
        const start = new Date(startDate);
        filteredInvoices = filteredInvoices.filter(
          (invoice) => new Date(invoice.invoice_date) >= start
        );
      }

      if (endDate) {
        const end = new Date(endDate);
        filteredInvoices = filteredInvoices.filter(
          (invoice) => new Date(invoice.invoice_date) <= end
        );
      }

      // Calculate summary statistics
      const totalInvoices = filteredInvoices.length;
      const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
      const paidAmount = filteredInvoices.reduce((sum, inv) => sum + inv.paid_amount, 0);

      const statusCounts = filteredInvoices.reduce(
        (counts, invoice) => {
          counts[invoice.status] = (counts[invoice.status] || 0) + 1;
          return counts;
        },
        {} as Record<string, number>
      );

      return NextResponse.json({
        invoices: filteredInvoices,
        summary: {
          total_count: totalInvoices,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          outstanding_amount: totalAmount - paidAmount,
          status_counts: statusCounts,
        },
        pagination: {
          limit,
          offset,
          has_more: filteredInvoices.length === limit,
        },
      });
    } catch (error) {
      console.error('Error getting invoice overview:', error);
      return NextResponse.json({ error: 'Failed to get invoice overview' }, { status: 500 });
    }
  });
}
