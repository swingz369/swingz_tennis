/**
 * POST /api/billing/generate-invoices
 * Generates monthly invoices for all active members of a club.
 * Body: { clubId?: string, month?: string (YYYY-MM) }
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Admin access required');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STRICT);
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => ({}));

    // Determine clubId
    let clubId: string | null = body.clubId ?? null;
    if (!clubId) {
      if (auth.role === 'superadmin') {
        clubId = req.cookies.get(ADMIN_CLUB_COOKIE)?.value ?? null;
        if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 });
      } else {
        clubId = auth.clubId;
      }
    }
    if (!clubId) return NextResponse.json({ error: 'No club context' }, { status: 400 });

    // Determine billing month (defaults to current month)
    const monthStr: string = body.month ?? new Date().toISOString().slice(0, 7); // YYYY-MM
    const [yearStr, monStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monStr, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    // Last day of the month
    const dueDate = new Date(year, month, 0); // day 0 of next month = last day of this month
    const dueDateStr = dueDate.toISOString().slice(0, 10); // YYYY-MM-DD

    const supabase = auth.supabase;

    // 1. Get all active members of the club
    const { data: memberships, error: membershipsError } = await supabase
      .from('user_club_memberships')
      .select('id, user_id, club_id')
      .eq('club_id', clubId)
      .eq('role', 'member')
      .eq('is_active', true);

    if (membershipsError) {
      console.error('[GenerateInvoices] memberships error:', membershipsError);
      return NextResponse.json({ error: membershipsError.message }, { status: 500 });
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0, message: 'No active members found' });
    }

    // 2. Get the club's active membership fee configuration
    const { data: feeConfig, error: feeError } = await supabase
      .from('fee_configurations')
      .select('id, amount, currency, name')
      .eq('club_id', clubId)
      .eq('type', 'membership')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (feeError) {
      console.error('[GenerateInvoices] fee config error:', feeError);
      return NextResponse.json({ error: feeError.message }, { status: 500 });
    }

    const feeAmount = feeConfig ? Number(feeConfig.amount) : 0;
    const feeCurrency = feeConfig?.currency ?? 'EUR';

    // 3. Get existing invoices for this club and month to detect duplicates
    const monthStart = `${yearStr}-${monStr}-01`;
    const monthEnd = dueDateStr;

    const { data: existingInvoices } = await supabase
      .from('invoices')
      .select('member_id')
      .eq('club_id', clubId)
      .eq('type', 'member_fee')
      .gte('due_date', monthStart)
      .lte('due_date', monthEnd);

    const alreadyBilledMemberIds = new Set(
      (existingInvoices ?? []).map((inv: any) => inv.member_id)
    );

    // 4. Get current invoice count for auto-numbering
    const { count: invoiceCount } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId);

    const baseCount = invoiceCount ?? 0;
    let created = 0;
    let skipped = 0;

    // 5. Create invoices for members who don't have one yet
    const toInsert = [];
    for (const membership of memberships) {
      const memberId: string = membership.user_id;

      if (alreadyBilledMemberIds.has(memberId)) {
        skipped++;
        continue;
      }

      const seqNum = baseCount + created + 1;
      const invoiceNumber = `INV-${year}-${monStr}-${String(seqNum).padStart(4, '0')}`;

      toInsert.push({
        club_id: clubId,
        member_id: memberId,
        invoice_number: invoiceNumber,
        type: 'member_fee',
        amount: feeAmount,
        currency: feeCurrency,
        status: 'open',
        due_date: dueDateStr,
        notes: `Mitgliedsbeitrag ${monthStr}`,
      });

      created++;
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('invoices').insert(toInsert);

      if (insertError) {
        console.error('[GenerateInvoices] insert error:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      created,
      skipped,
      month: monthStr,
      message: `${created} Rechnung(en) erstellt, ${skipped} übersprungen`,
    });
  });
}
