import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:members-directory');

/**
 * GET /api/members/directory?clubId=<uuid>
 *
 * Namensliste der aktiven Mitglieder eines Vereins — für Auswahlfelder wie die
 * Wunschpartner in den Trainingspräferenzen.
 *
 * Warum eine eigene Route statt eines Supabase-Calls im Client: die RLS-Policy
 * auf `user_club_memberships` gibt einem Mitglied nur die eigene Zeile frei.
 * Ein Client-Query liefert deshalb immer eine leere Liste — ohne Fehler, weil
 * RLS still filtert. Der Service-Client umgeht das; die Autorisierung passiert
 * hier explizit: nur wer selbst im Verein ist, sieht dessen Mitglieder, und
 * ausgeliefert werden ausschließlich Name und ID.
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    try {
      const clubId = new URL(request.url).searchParams.get('clubId');
      if (!clubId) {
        return NextResponse.json({ error: 'clubId ist erforderlich' }, { status: 400 });
      }

      const belongsToClub = auth.memberships.some((m) => m.club_id === clubId);
      if (!belongsToClub) {
        return forbiddenResponse('Kein Zugriff auf diesen Verein');
      }

      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('user_club_memberships')
        .select('user_id, users!user_club_memberships_user_id_fkey(full_name)')
        .eq('club_id', clubId)
        .eq('role', 'member')
        .eq('is_active', true)
        .neq('user_id', auth.user.id);

      if (error) {
        log.error('Mitgliederliste konnte nicht geladen werden', new Error(error.message));
        return NextResponse.json({ error: 'Mitgliederliste nicht verfügbar' }, { status: 500 });
      }

      const members = (data ?? [])
        .map((row) => {
          const joined = row.users as
            { full_name: string | null }[] | { full_name: string | null } | null;
          const name = (Array.isArray(joined) ? joined[0] : joined)?.full_name;
          return name ? { id: row.user_id as string, name } : null;
        })
        .filter((m): m is { id: string; name: string } => m !== null)
        .sort((a, b) => a.name.localeCompare(b.name, 'de'));

      return NextResponse.json({ members });
    } catch (err) {
      log.error('Mitgliederliste fehlgeschlagen', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Mitgliederliste nicht verfügbar' }, { status: 500 });
    }
  });
}
