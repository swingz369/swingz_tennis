import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { OUTSTANDING_INVOICE_STATUSES } from '@/lib/billing/invoice-visibility';

/**
 * GET /api/admin/nav-counts — alle Zähler der Admin-Navigation in einem Aufruf.
 *
 * Warum ein gemeinsamer Endpoint und nicht drei: die Sidebar pollt alle 45 s.
 * Drei Endpoints wären dreimal Auth, dreimal Roundtrip und dreimal Cache-Miss
 * für dieselbe Anzeige. `/api/admin/approvals/count` bleibt bestehen — er wird
 * an anderer Stelle genutzt und ist nicht Teil dieser Änderung.
 *
 * Fehlerverhalten: einzelne fehlgeschlagene Zählungen liefern `null`, nicht 0.
 * Die Sidebar blendet `null` aus, statt fälschlich „0 Mitglieder" zu behaupten,
 * wenn nur die Abfrage schiefging.
 */
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clubId = auth.clubId;
    if (!clubId) {
      return NextResponse.json({ members: null, openInvoices: null, preferencesPct: null });
    }

    const sb = auth.supabase as any;

    const [membersRes, invoicesRes, seasonRes] = await Promise.all([
      sb
        .from('user_club_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('is_active', true)
        .eq('role', 'member'),
      sb
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .in('status', OUTSTANDING_INVOICE_STATUSES),
      sb
        .from('seasons')
        .select('id, planning_status')
        .eq('club_id', clubId)
        .order('year', { ascending: false })
        .order('start_date', { ascending: false })
        .limit(1),
    ]);

    const members = membersRes.error ? null : (membersRes.count ?? 0);
    const openInvoices = invoicesRes.error ? null : (invoicesRes.count ?? 0);

    // Der Prozentsatz ergibt nur Sinn, solange Präferenzen gesammelt werden —
    // in jedem anderen Status ist „x von y" keine Fortschrittsaussage.
    let preferencesPct: number | null = null;
    const season = seasonRes.error ? null : (seasonRes.data ?? [])[0];
    if (season?.planning_status === 'collecting_preferences' && members && members > 0) {
      const { count: submitted, error } = await sb
        .from('user_training_preferences')
        .select('id', { count: 'exact', head: true })
        .eq('season_id', season.id)
        .eq('user_role', 'member');
      if (!error) {
        preferencesPct = Math.round(((submitted ?? 0) / members) * 100);
      }
    }

    return NextResponse.json({ members, openInvoices, preferencesPct });
  });
}
