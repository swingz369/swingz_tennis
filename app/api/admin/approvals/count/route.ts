import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';

// GET /api/admin/approvals/count — returns count of pending registrations
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    if (auth.role !== 'admin' && auth.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (auth.supabase as any)
      .from('registration_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (auth.role !== 'superadmin' && auth.clubId) {
      query = query.eq('club_id', auth.clubId);
    }

    const { count, error } = await query;

    if (error) {
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json({ count: count ?? 0 });
  });
}
