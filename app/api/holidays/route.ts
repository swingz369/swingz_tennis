import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { resolveBundeslandCode } from '@/lib/season-planning/holidays';
import {
  loadHolidaysForState,
  loadPublicHolidaysForState,
} from '@/lib/season-planning/holidays.server';

/**
 * GET /api/holidays — Schulferien und Feiertage des Bundeslands des eigenen Vereins.
 * Referenzdaten (~35 Zeilen), fürs Kalender-Overlay.
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) return forbiddenResponse('Anmeldung erforderlich');
    if (!auth.clubId)
      return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });

    const { data: club } = await auth.supabase
      .from('clubs')
      .select('bundesland')
      .eq('id', auth.clubId)
      .single();
    if (!club?.bundesland) return NextResponse.json({ school: [], public: [] });

    const code = resolveBundeslandCode(club.bundesland);
    const [school, publicDays] = await Promise.all([
      loadHolidaysForState(code),
      loadPublicHolidaysForState(code),
    ]);
    return NextResponse.json({ school, public: publicDays });
  });
}
