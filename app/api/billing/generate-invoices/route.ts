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

/**
 * GET /api/billing/generate-invoices?month=YYYY-MM
 * Returns a preview of which members would receive invoices, without creating them.
 * Admin-only.
 */
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Admin access required');

    const url = new URL(req.url);
    let clubId: string | null = url.searchParams.get('clubId');
    if (!clubId) {
      if (auth.role === 'superadmin') {
        clubId = req.cookies.get(ADMIN_CLUB_COOKIE)?.value ?? null;
        if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 });
      } else {
        clubId = auth.clubId;
      }
    }
    if (!clubId) return NextResponse.json({ error: 'No club context' }, { status: 400 });

    const monthStr: string = url.searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
    const [yearStr, monStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monStr, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    const dueDate = new Date(year, month, 0);
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    const supabase = auth.supabase;

    // 1. Get active members
    const { data: memberships, error: membershipsError } = await supabase
      .from('user_club_memberships')
      .select('id, user_id, club_id')
      .eq('club_id', clubId)
      .eq('role', 'member')
      .eq('is_active', true);

    if (membershipsError) {
      return NextResponse.json({ error: membershipsError.message }, { status: 500 });
    }
    if (!memberships || memberships.length === 0) {
      return NextResponse.json({
        members: [],
        feeAmount: 0,
        feeName: null,
        currency: 'EUR',
        month: monthStr,
        alreadyBilled: [],
        warning: 'NO_MEMBERS',
      });
    }

    // 2. Get fee config
    const { data: feeConfig } = await supabase
      .from('fee_configurations')
      .select('id, amount, currency, name')
      .eq('club_id', clubId)
      .eq('type', 'membership')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const feeAmount = feeConfig ? Number(feeConfig.amount) : 0;
    const feeCurrency = feeConfig?.currency ?? 'EUR';
    const feeName: string | null = feeConfig?.name ?? null;

    // 3. Already billed members
    const monthStart = `${yearStr}-${monStr}-01`;
    const { data: existingInvoices } = await supabase
      .from('invoices')
      .select('member_id')
      .eq('club_id', clubId)
      .eq('invoice_type', 'membership')
      .gte('due_date', monthStart)
      .lte('due_date', dueDateStr);

    const alreadyBilledIds = new Set(
      (existingInvoices ?? []).map((inv: Record<string, unknown>) => inv.member_id).filter(Boolean)
    );

    // 4. Get member names
    const memberIds = memberships.map((m: Record<string, unknown>) => m.user_id as string);
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', memberIds);

    const userMap = new Map((users ?? []).map((u: Record<string, unknown>) => [u.id as string, u]));

    // 5. Get tax rate
    let taxRate = 0;
    try {
      const { data: clubData } = await supabase
        .from('clubs')
        .select('tax_rate')
        .eq('id', clubId)
        .maybeSingle();
      taxRate = Number((clubData as Record<string, unknown>)?.tax_rate ?? 0);
    } catch {
      /* ignore */
    }

    // 6. Build preview list
    const members = memberships
      .filter((m: Record<string, unknown>) => !alreadyBilledIds.has(m.user_id as string))
      .map((m: Record<string, unknown>) => {
        const user = userMap.get(m.user_id as string) as Record<string, unknown> | undefined;
        return {
          memberId: m.user_id as string,
          memberName: (user?.full_name as string) || 'Unbekannt',
          email: (user?.email as string) || '',
          amount: feeAmount + feeAmount * (taxRate / 100),
          taxAmount: feeAmount * (taxRate / 100),
          subtotal: feeAmount,
        };
      });

    const alreadyBilled = memberships
      .filter((m: Record<string, unknown>) => alreadyBilledIds.has(m.user_id as string))
      .map((m: Record<string, unknown>) => {
        const user = userMap.get(m.user_id as string) as Record<string, unknown> | undefined;
        return {
          memberId: m.user_id as string,
          memberName: (user?.full_name as string) || 'Unbekannt',
        };
      });

    return NextResponse.json({
      members,
      alreadyBilled,
      feeAmount,
      feeName,
      currency: feeCurrency,
      taxRate,
      month: monthStr,
      warning: feeAmount === 0 ? 'NO_FEE_CONFIGURED' : undefined,
    });
  });
}

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

    // Guard: don't create €0 invoices when no fee is configured
    if (feeAmount === 0) {
      const monthLabel = new Date(year, month - 1).toLocaleDateString('de-DE', {
        month: 'long',
        year: 'numeric',
      });
      return NextResponse.json({
        created: 0,
        skipped: memberships?.length ?? 0,
        month: monthStr,
        message: `Keine Gebühr konfiguriert — Rechnungen für ${monthLabel} wurden NICHT erstellt`,
        warning: 'NO_FEE_CONFIGURED',
      });
    }

    // 3. Get existing invoices for this club and month to detect duplicates
    const monthStart = `${yearStr}-${monStr}-01`;
    const monthEnd = dueDateStr;

    const { data: existingInvoices } = await supabase
      .from('invoices')
      .select('member_id')
      .eq('club_id', clubId)
      .eq('invoice_type', 'membership')
      .gte('due_date', monthStart)
      .lte('due_date', monthEnd);

    const alreadyBilledMemberIds = new Set(
      (existingInvoices ?? []).map((inv: any) => inv.member_id).filter(Boolean)
    );

    // 4. Get current invoice count for auto-numbering
    const { count: invoiceCount } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId);

    const baseCount = invoiceCount ?? 0;
    let created = 0;
    let skipped = 0;

    // 5. Get club tax rate (once, before the loop)
    let taxRate = 0;
    try {
      const { data: clubData } = await supabase
        .from('clubs')
        .select('tax_rate')
        .eq('id', clubId)
        .maybeSingle();
      taxRate = (clubData as any)?.tax_rate ?? 0;
    } catch {
      taxRate = 0;
    }

    // 6. Parse optional exclude list from body
    const excludeMemberIds: Set<string> = new Set(
      Array.isArray(body.excludeMemberIds) ? body.excludeMemberIds.filter(Boolean) : []
    );

    // 7. Create invoices for members who don't have one yet
    const toInsert = [];
    for (const membership of memberships) {
      const memberId: string = membership.user_id;

      if (alreadyBilledMemberIds.has(memberId)) {
        skipped++;
        continue;
      }

      if (excludeMemberIds.has(memberId)) {
        skipped++;
        continue;
      }

      const seqNum = baseCount + created + 1;
      const invoiceNumber = `INV-${year}-${monStr}-${String(seqNum).padStart(4, '0')}`;

      const memberTaxAmount = feeAmount * (taxRate / 100);

      toInsert.push({
        club_id: clubId,
        member_id: memberId,
        invoice_number: invoiceNumber,
        invoice_type: 'membership',
        amount: feeAmount + memberTaxAmount,
        tax_amount: memberTaxAmount,
        currency: feeCurrency,
        status: 'open',
        due_date: dueDateStr,
        notes: `Mitgliedsbeitrag ${monthStr}`,
      });

      created++;
    }

    if (toInsert.length > 0) {
      const { data: insertedInvoices, error: insertError } = await supabase
        .from('invoices')
        .insert(toInsert)
        .select('id, member_id');

      if (insertError) {
        console.error('[GenerateInvoices] insert error:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      // Create line items for each invoice
      if (insertedInvoices && feeAmount > 0) {
        const lineItems = insertedInvoices.map((inv: any) => ({
          invoice_id: inv.id,
          description: feeConfig
            ? `${feeConfig.name} — ${monthStr}`
            : `Mitgliedsbeitrag ${monthStr}`,
          quantity: 1,
          unit_price: feeAmount,
          item_type: 'membership_fee',
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(lineItems as any);
        if (itemsError) {
          console.error('[GenerateInvoices] line items insert error:', itemsError);
        }
      }
    }

    // Build informative message with month context
    const monthLabel = new Date(year, month - 1).toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric',
    });
    const message =
      created > 0
        ? `${created} Rechnung(en) für ${monthLabel} erstellt${
            skipped > 0 ? `, ${skipped} bereits vorhanden` : ''
          }`
        : `Alle ${skipped} Mitglieder wurden bereits für ${monthLabel} abgerechnet — 0 neue Rechnungen erstellt`;

    if (created === 0 && skipped > 0) {
      console.log(
        `[GenerateInvoices] All ${skipped} members already billed for ${monthStr} (club=${clubId})`
      );
    }

    return NextResponse.json({
      created,
      skipped,
      month: monthStr,
      message,
    });
  });
}
