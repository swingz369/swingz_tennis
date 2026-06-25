import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';
import type { DunningRecord } from '@/lib/types/billing';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
const log = createLogger('api:billing:dunning');

interface DunningKpis {
  totalRecords: number;
  thisMonthCount: number;
  totalInterest: number;
  openRecords: number;
  openAmount: number;
  byLevel: { level1: number; level2: number; level3: number };
  overdueInvoices: number;
}

/**
 * GET /api/billing/dunning?clubId=...
 *
 * Liefert Mahnläufe + Kennzahlen für die Mahnlauf-Dashboard-Komponente.
 *
 * Auth: muss aktives Mitglied des Clubs sein (jede Rolle).
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await requireAuth(request);
  const { searchParams } = new URL(request.url);
  const clubId = searchParams.get('clubId');

  if (!clubId) {
    return NextResponse.json({ error: 'clubId required' }, { status: 400 });
  }

  // Membership-Check (jede Rolle darf lesen — auch Trainer/Mitglied)
  const { data: membership } = await supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .eq('is_active', true)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'Kein Zugriff auf diesen Verein' }, { status: 403 });
  }

  // Service-Client für Bypass-RLS (Dashboard-Aggregation)
  const sb = createServiceClient();

  const [recordsRes, overdueRes] = await Promise.all([
    sb
      .from('dunning_records')
      .select('*')
      .eq('club_id', clubId)
      .order('sent_at', { ascending: false })
      .limit(100),
    sb
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('status', 'overdue'),
  ]);

  if (recordsRes.error) {
    log.error('Failed to fetch dunning records', { error: recordsRes.error.message });
    return NextResponse.json({ error: recordsRes.error.message }, { status: 500 });
  }

  const records = (recordsRes.data ?? []) as unknown as DunningRecord[];
  const kpis: DunningKpis = computeKpis(records, overdueRes.count ?? 0);

  return NextResponse.json({
    records,
    kpis,
  });
}

function computeKpis(records: DunningRecord[], overdueInvoices: number): DunningKpis {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let thisMonthCount = 0;
  let totalInterest = 0;
  let openRecords = 0;
  let openAmount = 0;
  let level1 = 0;
  let level2 = 0;
  let level3 = 0;

  for (const r of records) {
    if (r.sent_at && new Date(r.sent_at) >= monthStart) thisMonthCount += 1;
    totalInterest += Number(r.interest_amount ?? 0);
    const isOpen = !r.paid_at && !r.cancelled_at && (r.status ?? '') !== 'paid';
    if (isOpen) {
      openRecords += 1;
      openAmount += Number(r.total_due ?? r.total_amount ?? 0);
    }
    const lvl = Number(r.level ?? 0);
    if (lvl === 1) level1 += 1;
    else if (lvl === 2) level2 += 1;
    else if (lvl === 3) level3 += 1;
  }

  return {
    totalRecords: records.length,
    thisMonthCount,
    totalInterest,
    openRecords,
    openAmount,
    byLevel: { level1, level2, level3 },
    overdueInvoices,
  };
}
