/**
 * app/api/leagues/[id]/roster/route.ts
 *
 * GET   — Kader (Meldeliste) der Liga
 * PATCH — Kaderzeile einem Vereinsmitglied zuordnen
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, verifyOffice, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import {
  loadMemberCandidates,
  suggestByName,
  persistDtbId,
} from '@/lib/services/league-member-matching';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) return forbiddenResponse();
    if (!auth.clubId) return forbiddenResponse('Vereinskontext erforderlich');

    const { id } = await params;
    const { data, error } = await auth.supabase
      .from('league_players')
      .select('id, name, lk, position_number, member_id, synced_at, source_url, birth_year')
      .eq('league_id', id)
      .eq('club_id', auth.clubId)
      .order('position_number', { ascending: true, nullsFirst: false });

    if (error) return NextResponse.json({ error: 'Kader nicht abrufbar' }, { status: 500 });

    // Für nicht zugeordnete Spieler einen Namensvorschlag mitliefern — der
    // Sportwart bestätigt mit einem Klick statt in einer Liste zu suchen.
    // Nur für Admin/Mannschaftsführer: Mitglieder brauchen die Vorschläge anderer nicht.
    const players = data ?? [];
    const canEdit =
      (await verifyRole(auth, 'admin')) || (await verifyOffice(auth, 'mannschaftsfuehrer'));
    if (!canEdit || players.every((p) => p.member_id)) return NextResponse.json({ players });

    const members = await loadMemberCandidates(auth.supabase, auth.clubId);
    return NextResponse.json({
      players: players.map((p) => ({
        ...p,
        suggested_member_id: p.member_id
          ? null
          : suggestByName({ name: p.name, birthYear: p.birth_year }, members),
      })),
    });
  });
}

/**
 * PATCH — einen Kadereintrag von Hand einem Mitglied zuordnen (oder lösen).
 *
 * Nötig, weil die DTB-ID im Profil selten gepflegt ist: der automatische
 * Abgleich trifft dann nur über den Namen, und "Müller, Thomas" gibt es im
 * Verein zweimal. Ohne diesen Weg bliebe der Spieler ohne Zuordnung — und
 * sähe seine Medenspiele nie im eigenen Dashboard.
 *
 * Body: { player_id: string, member_id: string | null }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const canEdit =
      (await verifyRole(auth, 'admin')) || (await verifyOffice(auth, 'mannschaftsfuehrer'));
    if (!canEdit) return forbiddenResponse('Admin- oder Mannschaftsführer-Zugang erforderlich');
    if (!auth.clubId) return forbiddenResponse('Vereinskontext erforderlich');
    const clubId = auth.clubId;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const playerId: string | undefined = body?.player_id;
    const memberId: string | null = body?.member_id ?? null;

    if (!playerId) return NextResponse.json({ error: 'player_id fehlt' }, { status: 400 });

    // Das Mitglied muss im selben Verein aktiv sein — sonst ließe sich ein
    // Kaderplatz an eine beliebige User-ID hängen.
    if (memberId) {
      const { data: membership } = await auth.supabase
        .from('user_club_memberships')
        .select('user_id')
        .eq('user_id', memberId)
        .eq('club_id', clubId)
        .eq('is_active', true)
        .maybeSingle();
      if (!membership) {
        return NextResponse.json(
          { error: 'Mitglied gehört nicht zu diesem Verein' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await auth.supabase
      .from('league_players')
      .update({ member_id: memberId })
      .eq('id', playerId)
      .eq('league_id', id)
      .eq('club_id', clubId)
      .select('id, dtb_id');

    if (error) return NextResponse.json({ error: 'Zuordnung fehlgeschlagen' }, { status: 500 });
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Kadereintrag nicht gefunden' }, { status: 404 });
    }

    // Bestätigte Zuordnung dauerhaft machen: DTB-ID am Mitglied festhalten.
    // Service-Client, weil der Admin fremde Profile nicht beschreiben darf; die
    // Vereinszugehörigkeit des Mitglieds ist oben geprüft.
    if (memberId) await persistDtbId(createServiceClient(), memberId, data[0].dtb_id);
    return NextResponse.json({ success: true });
  });
}
