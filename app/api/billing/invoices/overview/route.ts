import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import type { InvoiceStatus } from '@/lib/types/billing';
import { createLogger } from '@/lib/logger';
import { isMemberVisibleInvoiceStatus } from '@/lib/billing/invoice-visibility';

const log = createLogger('api:billing:invoices:overview');

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Members can view invoices
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Anmeldung erforderlich');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);

      const clubId = searchParams.get('clubId');
      const memberId = searchParams.get('memberId');
      const status = searchParams.get('status') as InvoiceStatus | null;
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
          ...(status != null ? { status } : {}),
          limit,
          offset,
        });
      } else if (memberId) {
        invoices = await billingEngine.getInvoicesByMember(memberId, {
          ...(status != null ? { status } : {}),
          limit,
          offset,
        });
      }

      // Filter by date range if provided (use created_at)
      let filteredInvoices = invoices || [];

      // Ein Entwurf ist Arbeitsstand des Vereins — er kann sich noch ändern oder
      // beim erneuten Veröffentlichen einer Saison ganz verschwinden. Mitglieder
      // und Trainer sahen ihn bisher als „ausstehende Rechnung", obwohl der Verein
      // ihn nie verschickt hat.
      if (auth.role === 'member' || auth.role === 'trainer') {
        filteredInvoices = filteredInvoices.filter((invoice) =>
          isMemberVisibleInvoiceStatus(invoice.status)
        );
      }

      if (startDate) {
        const start = new Date(startDate);
        filteredInvoices = filteredInvoices.filter((invoice) =>
          invoice.created_at ? new Date(invoice.created_at) >= start : false
        );
      }

      if (endDate) {
        const end = new Date(endDate);
        filteredInvoices = filteredInvoices.filter((invoice) =>
          invoice.created_at ? new Date(invoice.created_at) <= end : false
        );
      }

      // Calculate summary statistics
      const totalInvoices = filteredInvoices.length;
      const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);

      const statusCounts = filteredInvoices.reduce(
        (counts, invoice) => {
          const s = invoice.status || 'unknown';
          counts[s] = (counts[s] || 0) + 1;
          return counts;
        },
        {} as Record<string, number>
      );

      // Fetch actual paid amounts from payments table
      const invoiceIds = filteredInvoices.map((inv) => inv.id);
      let paidAmount = 0;
      if (invoiceIds.length > 0) {
        const { data: payments } = await auth.supabase
          .from('payments')
          .select('amount')
          .in('invoice_id', invoiceIds)
          .eq('status', 'paid');
        paidAmount = (payments ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0);
      }

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
      log.error('Error getting invoice overview:', error);
      // Return empty result instead of 500 when billing engine fails
      return NextResponse.json({
        invoices: [],
        summary: {
          total_count: 0,
          total_amount: 0,
          paid_amount: 0,
          outstanding_amount: 0,
          status_counts: {},
        },
        pagination: {
          limit: parseInt(new URL(_request.url).searchParams.get('limit') || '50'),
          offset: parseInt(new URL(_request.url).searchParams.get('offset') || '0'),
          has_more: false,
        },
      });
    }
  });
}
