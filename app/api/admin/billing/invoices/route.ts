import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { getPagination, buildPaginationMeta } from '@/lib/pagination';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:billing:invoices');

const VALID_TYPES = new Set(['season', 'membership', 'adhoc']);

// GET /api/admin/billing/invoices – Paginated invoices for the current club (Admin/Superadmin)
// Query params: page, limit (default 25), type (season|membership|adhoc, omit for all)
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    // Rate limiting
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    // Permission check
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Zugriff nur für Admins');

    try {
      const supabase = auth.supabase;
      const clubId = auth.clubId;
      if (!clubId) {
        return NextResponse.json({ error: 'Kein Verein ausgewählt' }, { status: 400 });
      }

      const { searchParams } = new URL(request.url);
      const { page, offset, limit } = getPagination(Object.fromEntries(searchParams), 25);
      const type = searchParams.get('type');

      // Fetch invoices for the current club, joining with users for member name
      let query = supabase
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
          users!invoices_member_id_fkey(full_name, email)
        `,
          { count: 'exact' }
        )
        .eq('club_id', clubId)
        .order('due_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (type && VALID_TYPES.has(type)) {
        query = query.eq('invoice_type', type);
      }

      const { data: invoicesData, error: invoicesError, count } = await query;

      if (invoicesError) {
        return internalErrorResponse();
      }

      const invoices = (invoicesData || []).map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        memberId: inv.member_id,
        memberName: inv.users?.full_name || 'N/A',
        subtotal: inv.subtotal,
        amount: inv.amount,
        paidAmount: inv.paid_amount,
        currency: inv.currency,
        status: inv.status,
        invoiceType: inv.invoice_type ?? undefined,
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date,
        paidAt: inv.paid_at,
      }));

      return NextResponse.json({
        data: invoices,
        pagination: buildPaginationMeta(page, limit, count),
      });
    } catch (error) {
      log.error('Error fetching invoices:', error);
      return internalErrorResponse();
    }
  });
}
