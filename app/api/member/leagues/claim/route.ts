/**
 * app/api/member/leagues/claim/route.ts
 *
 * POST — "Das bin ich": ein Mitglied bestätigt einen Kadereintrag als seinen.
 *
 * Body: { player_id: string }
 *
 * Der Server prüft selbst, dass der Eintrag zum Verein gehört, noch frei ist und
 * eindeutig auf den Namen dieses Mitglieds passt — der Client kann sich keinen
 * beliebigen Kaderplatz greifen. Bestätigt wird der Eintrag in allen Ligen des
 * Vereins mit derselben DTB-ID bzw. demselben Namen, und die DTB-ID wandert ins
 * Profil, damit die Zuordnung künftig automatisch läuft.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import {
  loadMemberCandidates,
  suggestByName,
  persistDtbId,
  normalizeTeamName,
} from '@/lib/services/nuliga-sync';

const log = createLogger('api:member:leagues:claim');

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) return forbiddenResponse();
    if (!auth.clubId) return forbiddenResponse('Vereinskontext erforderlich');

    const body = await request.json().catch(() => ({}));
    const playerId: unknown = body?.player_id;
    if (typeof playerId !== 'string') {
      return NextResponse.json({ error: 'player_id fehlt' }, { status: 400 });
    }

    // Service-Client: Ein Mitglied darf Kaderzeilen nicht schreiben. Alle
    // Berechtigungen sind unten serverseitig geprüft.
    const sb = createServiceClient();
    const { data: player } = await sb
      .from('league_players')
      .select('id, name, dtb_id, birth_year, member_id, club_id')
      .eq('id', playerId)
      .eq('club_id', auth.clubId)
      .maybeSingle();

    if (!player || player.member_id) {
      return NextResponse.json({ error: 'Kadereintrag nicht verfügbar' }, { status: 404 });
    }

    const members = await loadMemberCandidates(sb, auth.clubId);
    const match = suggestByName({ name: player.name, birthYear: player.birth_year }, members);
    if (match !== auth.user.id) {
      return NextResponse.json(
        {
          error:
            'Dieser Eintrag passt nicht eindeutig zu deinem Profil. Bitte den Sportwart fragen.',
        },
        { status: 403 }
      );
    }

    // Alle noch freien Einträge derselben Person im Verein (andere Ligen, andere
    // Saisons): gleiche DTB-ID, sonst gleicher Name. Im Code gefiltert statt per
    // ilike — Namen dürfen %, _ oder Kommas enthalten.
    const { data: open } = await sb
      .from('league_players')
      .select('id, name, dtb_id')
      .eq('club_id', auth.clubId)
      .is('member_id', null);
    const wanted = normalizeTeamName(player.name);
    const ids = (open ?? [])
      .filter(
        (r) =>
          r.id === player.id ||
          (player.dtb_id ? r.dtb_id === player.dtb_id : normalizeTeamName(r.name) === wanted)
      )
      .map((r) => r.id);
    const { error } = await sb
      .from('league_players')
      .update({ member_id: auth.user.id })
      .in('id', ids);

    if (error) {
      log.error('Zuordnung fehlgeschlagen', { error: error.message });
      return NextResponse.json({ error: 'Zuordnung fehlgeschlagen' }, { status: 500 });
    }

    await persistDtbId(sb, auth.user.id, player.dtb_id);
    return NextResponse.json({ success: true });
  });
}
