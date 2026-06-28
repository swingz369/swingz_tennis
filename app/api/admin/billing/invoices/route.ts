import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const log = createLogger('api:admin:billing:invoices');

// GET /api/admin/billing/invoices – All invoices for the current club (Admin/Superadmin)
export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Rate limiting
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    // Permission check
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin access required');

    try {
      const supabase = auth.supabase;
      const clubId = auth.clubId;
      if (!clubId) {
        return NextResponse.json({ error: 'No club selected' }, { status: 400 });
      }

      // Fetch invoices for the current club, joining with users for member name
      const { data: invoicesData, error: invoicesError } = await supabase
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
          users!invoices_member_id_fkey(full_name, email)
        `
        )
        .eq('club_id', clubId)
        .order('due_date', { ascending: false });

      if (invoicesError) {
        return NextResponse.json({ error: invoicesError.message }, { status: 500 });
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
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date,
        paidAt: inv.paid_at,
      }));

      return NextResponse.json({ data: invoices });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      log.error('Error fetching invoices:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
