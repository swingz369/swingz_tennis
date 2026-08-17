import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';

// GET /api/admin/approvals/count — returns count of pending registrations
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    // `verifyRole` statt eines Rollen-Vergleichs von Hand: Der direkte
    // Vergleich schloss den Owner aus, der über „Als Admin" in einem Verein
    // arbeitet — im Browser-Log schlug diese Route deshalb dauerhaft mit 403
    // fehl, während der Rest der Admin-Oberfläche lief.
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Zugriff nur für Admins' }, { status: 403 });
    }

    let query = auth.supabase
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
