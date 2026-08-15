import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { buildDatevCsv } from '@/lib/billing/datev-mapper';
import type { DatevInvoice } from '@/lib/billing/datev-mapper';

/**
 * GET /api/billing/export/datev?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Exports paid/open invoices as DATEV Buchungsstapel CSV.
 * Requires admin role.
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { clubId, supabase } = auth;
    if (!clubId) return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Parameter from und to erforderlich (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const { data: invoicesRaw, error } = await supabase
      .from('invoices')
      .select(
        `
        id,
        invoice_number,
        invoice_date,
        status,
        users!invoices_member_id_fkey (full_name),
        invoice_items (
          description,
          total_price,
          tax_rate,
          datev_account_number
        )
        `
      )
      .eq('club_id', clubId)
      .gte('invoice_date', from)
      .lte('invoice_date', to)
      .not('status', 'in', '(draft,cancelled)')
      .order('invoice_date');

    if (error) return internalErrorResponse();

    const invoices: DatevInvoice[] = (invoicesRaw ?? []).map((inv: Record<string, unknown>) => {
      const user = inv.users as Record<string, unknown> | null;
      const items = (inv.invoice_items as Record<string, unknown>[] | null) ?? [];
      return {
        invoiceNumber: String(inv.invoice_number ?? ''),
        invoiceDate: String(inv.invoice_date ?? from),
        memberName: String(user?.full_name ?? 'Unbekannt'),
        items: items.map((it) => ({
          amount: Number(it.total_price ?? 0),
          description: String(it.description ?? ''),
          taxRate: Number(it.tax_rate ?? 0),
          datevAccountNumber: it.datev_account_number ? String(it.datev_account_number) : null,
        })),
      };
    });

    const csv = buildDatevCsv(invoices, from, to);
    const filename = `datev-buchungsstapel-${from}-${to}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  });
}
