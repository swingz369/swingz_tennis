/**
 * POST /api/billing/generate-invoices
 * Generates monthly invoices for all active members of a club.
 * Body: { clubId?: string, month?: string (YYYY-MM), excludeMemberIds?: string[] }
 *
 * GET /api/billing/generate-invoices?month=YYYY-MM
 * Returns a preview of which members would receive invoices, without creating them.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:generate-invoices');

// ─── Types ───────────────────────────────────────────────────────────────────

interface PreviewMember {
  memberId: string;
  memberName: string;
  email: string;
  amount: number;
  taxAmount: number;
  subtotal: number;
}

interface AlreadyBilledMember {
  memberId: string;
  memberName: string;
}

interface InvoicePreviewData {
  memberships: Record<string, unknown>[];
  members: PreviewMember[];
  alreadyBilled: AlreadyBilledMember[];
  alreadyBilledIds: Set<string>;
  feeAmount: number;
  feeCurrency: string;
  feeName: string | null;
  taxRate: number;
  month: string;
  yearStr: string;
  monStr: string;
  year: number;
  monthNum: number;
  dueDateStr: string;
  warning?: string;
}

// ─── Shared helper ───────────────────────────────────────────────────────────

/**
 * Resolves the target club for this invoice operation.
 *
 * Layering: `withApiAuth` already routed the request through the shared
 * `resolveActiveClub` helper inside `buildAuthContext` and exposed the
 * result as `auth.clubId` (which honors `ADMIN_CLUB_COOKIE` against the
 * user's memberships, with no per-route re-implementation needed). The
 * only route-specific override is the explicit `body/query` param, which
 * lets a superadmin target a specific club for invoice generation without
 * affecting their visible admin session context.
 */
function resolveClubId(
  auth: { clubId: string | null },
  explicitClubId?: string | null
): string | null {
  return explicitClubId ?? auth.clubId;
}

/**
 * Fetches all data needed to preview or generate invoices for a given month.
 * Shared between GET (preview) and POST (generate) to avoid duplication.
 */
async function getInvoicePreviewData(
  supabase: any,
  clubId: string,
  monthStr: string
): Promise<InvoicePreviewData> {
  const [yearStr, monStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monStr, 10);

  const dueDate = new Date(year, monthNum, 0);
  const dueDateStr = dueDate.toISOString().slice(0, 10);

  // 1. Get active members
  const { data: memberships, error: membershipsError } = await supabase
    .from('user_club_memberships')
    .select('id, user_id, club_id')
    .eq('club_id', clubId)
    .eq('role', 'member')
    .eq('is_active', true);

  if (membershipsError) {
    throw new Error(membershipsError.message);
  }

  if (!memberships || memberships.length === 0) {
    return {
      memberships: [],
      members: [],
      alreadyBilled: [],
      alreadyBilledIds: new Set(),
      feeAmount: 0,
      feeCurrency: 'EUR',
      feeName: null,
      taxRate: 0,
      month: monthStr,
      yearStr,
      monStr,
      year,
      monthNum,
      dueDateStr,
      warning: 'NO_MEMBERS',
    };
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

  const alreadyBilledIds = new Set<string>(
    (existingInvoices ?? [])
      .map((inv: Record<string, unknown>) => inv.member_id as string)
      .filter(Boolean)
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

  // 6. Build preview lists
  const previewMembers: PreviewMember[] = memberships
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

  const alreadyBilled: AlreadyBilledMember[] = memberships
    .filter((m: Record<string, unknown>) => alreadyBilledIds.has(m.user_id as string))
    .map((m: Record<string, unknown>) => {
      const user = userMap.get(m.user_id as string) as Record<string, unknown> | undefined;
      return {
        memberId: m.user_id as string,
        memberName: (user?.full_name as string) || 'Unbekannt',
      };
    });

  return {
    memberships,
    members: previewMembers,
    alreadyBilled,
    alreadyBilledIds,
    feeAmount,
    feeCurrency,
    feeName,
    taxRate,
    month: monthStr,
    yearStr,
    monStr,
    year,
    monthNum,
    dueDateStr,
    warning: feeAmount === 0 ? 'NO_FEE_CONFIGURED' : undefined,
  };
}

// ─── GET (Preview) ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Zugriff nur für Admins');

    const url = new URL(req.url);
    const clubId = resolveClubId(auth, url.searchParams.get('clubId'));
    if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 });

    const monthStr: string = url.searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
    const [yearStr, monStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monStr, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    try {
      const data = await getInvoicePreviewData(auth.supabase, clubId, monthStr);

      return NextResponse.json({
        members: data.members,
        alreadyBilled: data.alreadyBilled,
        feeAmount: data.feeAmount,
        feeName: data.feeName,
        currency: data.feeCurrency,
        taxRate: data.taxRate,
        month: data.month,
        warning: data.warning,
      });
    } catch (err) {
      log.error('[GenerateInvoices GET] preview error:', err);
      return internalErrorResponse();
    }
  });
}

// ─── POST (Generate) ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Zugriff nur für Admins');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STRICT);
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => ({}));

    const clubId = resolveClubId(auth, body.clubId ?? null);
    if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 });

    const monthStr: string = body.month ?? new Date().toISOString().slice(0, 7);
    const [yearStr, monStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monStr, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    try {
      const data = await getInvoicePreviewData(auth.supabase, clubId, monthStr);

      // Guard: don't create €0 invoices when no fee is configured
      if (data.feeAmount === 0) {
        const monthLabel = new Date(year, month - 1).toLocaleDateString('de-DE', {
          month: 'long',
          year: 'numeric',
        });
        return NextResponse.json({
          created: 0,
          skipped: data.memberships?.length ?? 0,
          month: monthStr,
          message: `Keine Gebühr konfiguriert — Rechnungen für ${monthLabel} wurden NICHT erstellt`,
          warning: 'NO_FEE_CONFIGURED',
        });
      }

      if (data.memberships.length === 0) {
        return NextResponse.json({ created: 0, skipped: 0, message: 'No active members found' });
      }

      // Parse optional exclude list from body
      const excludeMemberIds: Set<string> = new Set(
        Array.isArray(body.excludeMemberIds) ? body.excludeMemberIds.filter(Boolean) : []
      );

      // Get current invoice count for auto-numbering
      const supabase = auth.supabase;
      const { count: invoiceCount } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId);

      const baseCount = invoiceCount ?? 0;
      let created = 0;
      let skipped = 0;

      // Create invoices for members who don't have one yet
      const toInsert: Record<string, unknown>[] = [];
      for (const membership of data.memberships) {
        const memberId: string = membership.user_id as string;

        if (data.alreadyBilledIds.has(memberId) || excludeMemberIds.has(memberId)) {
          skipped++;
          continue;
        }

        const seqNum = baseCount + created + 1;
        const invoiceNumber = `INV-${year}-${monStr}-${String(seqNum).padStart(4, '0')}`;
        const memberTaxAmount = data.feeAmount * (data.taxRate / 100);

        toInsert.push({
          club_id: clubId,
          member_id: memberId,
          invoice_number: invoiceNumber,
          invoice_type: 'membership',
          amount: data.feeAmount + memberTaxAmount,
          tax_amount: memberTaxAmount,
          currency: data.feeCurrency,
          status: 'open',
          due_date: data.dueDateStr,
          notes: `Mitgliedsbeitrag ${monthStr}`,
        });

        created++;
      }

      if (toInsert.length > 0) {
        const { data: insertedInvoices, error: insertError } = await supabase
          .from('invoices')
          .insert(toInsert as any)
          .select('id, member_id');

        if (insertError) {
          log.error('[GenerateInvoices] insert error:', insertError);
          return internalErrorResponse();
        }

        // Create line items for each invoice
        if (insertedInvoices && data.feeAmount > 0) {
          const lineItems = insertedInvoices.map((inv: Record<string, unknown>) => ({
            invoice_id: inv.id,
            description: data.feeName
              ? `${data.feeName} — ${monthStr}`
              : `Mitgliedsbeitrag ${monthStr}`,
            quantity: 1,
            unit_price: data.feeAmount,
            item_type: 'membership_fee',
          }));

          const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(lineItems as any);
          if (itemsError) {
            log.error('[GenerateInvoices] line items insert error:', itemsError);
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

      return NextResponse.json({
        created,
        skipped,
        month: monthStr,
        message,
      });
    } catch (err) {
      log.error('[GenerateInvoices POST] error:', err);
      return internalErrorResponse();
    }
  });
}
