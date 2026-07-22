import { NextResponse } from 'next/server';
import { requireAdminClub } from '@/lib/admin-context';
import { createServiceClient } from '@/lib/supabase/service';
import { getPagination, buildPaginationMeta } from '@/lib/pagination';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { clubId } = await requireAdminClub();
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const { page, offset, limit } = getPagination(params, 20);

    // Service client: RLS blocks admin reads on audit_logs via the user client
    // (same class of issue as the sessions/trainers lookup fix) — access is
    // already scoped to the admin's own club below via .eq('club_id', clubId).
    const sb = createServiceClient();
    const [{ data: auditLogs }, { count }] = await Promise.all([
      sb
        .from('audit_logs')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      sb.from('audit_logs').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
    ]);

    const pagination = buildPaginationMeta(page, limit, count);

    return NextResponse.json({ logs: auditLogs ?? [], pagination });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
