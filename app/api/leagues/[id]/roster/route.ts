/**
 * app/api/leagues/[id]/roster/route.ts
 *
 * GET  — Kader (Meldeliste) der Liga
 * POST — Kader aus dem nuLiga-Mannschaftsportrait übernehmen
 *
 * Es wird ausschließlich die Meldeliste der EIGENEN Mannschaft importiert; die
 * Portrait-Seite enthält keine fremden Spielernamen. Für gegnerische
 * Aufstellungen steht nur der Link in `match_days.nuliga_report_url`.
 *
 * Beim vollen Sync (`/sync`) läuft derselbe Import mit — diese Route ist der
 * Weg, den Kader einzeln nachzuziehen, ohne Tabelle und Spielplan anzufassen.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, verifyOffice, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';
import {
  fetchNuligaTeamPortrait,
  fetchNuligaClubTeams,
  isNuligaTeamPortraitUrl,
  isValidNuligaUrl,
} from '@/lib/services/nuliga-scraper';
import { upsertRoster } from '@/lib/services/nuliga-sync';

const log = createLogger('api:leagues:roster');

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) return forbiddenResponse();
    if (!auth.clubId) return forbiddenResponse('Vereinskontext erforderlich');

    const { id } = await params;
    const { data, error } = await auth.supabase
      .from('league_players')
      .select('id, name, lk, position_number, member_id, synced_at, source_url')
      .eq('league_id', id)
      .eq('club_id', auth.clubId)
      .order('position_number', { ascending: true, nullsFirst: false });

    if (error) return NextResponse.json({ error: 'Kader nicht abrufbar' }, { status: 500 });
    return NextResponse.json({ players: data ?? [] });
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
      .select('id');

    if (error) return NextResponse.json({ error: 'Zuordnung fehlgeschlagen' }, { status: 500 });
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Kadereintrag nicht gefunden' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const canEdit =
      (await verifyRole(auth, 'admin')) || (await verifyOffice(auth, 'mannschaftsfuehrer'));
    if (!canEdit) return forbiddenResponse('Admin- oder Mannschaftsführer-Zugang erforderlich');
    if (!auth.clubId) return forbiddenResponse('Vereinskontext erforderlich');
    const clubId = auth.clubId;

    const { id } = await params;

    const { data: league } = await auth.supabase
      .from('leagues')
      .select('id, name, club_id, nuliga_url, nuliga_roster_url')
      .eq('id', id)
      .eq('club_id', clubId)
      .maybeSingle();
    if (!league) return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });

    // Die Kader-URL kommt ausschließlich aus der Liga, nie aus dem Request.
    // Vorher ließ sich hier eine beliebige `nuliga_roster_url` mitschicken —
    // damit konnte ein Verein die Meldeliste einer FREMDEN Mannschaft laden
    // und deren Klarnamen samt LK in die eigene Datenbank schreiben.
    const rosterUrl: string | null = league.nuliga_roster_url || league.nuliga_url;

    if (!rosterUrl) {
      return NextResponse.json(
        {
          error:
            'Keine nuLiga-URL hinterlegt. Bitte die Mannschaft über „Mannschaften aus nuLiga holen" anlegen.',
        },
        { status: 400 }
      );
    }
    if (!isValidNuligaUrl(rosterUrl)) {
      return NextResponse.json(
        { error: 'Ungültige nuLiga-URL. Die URL muss von *.liga.nu stammen.' },
        { status: 400 }
      );
    }
    if (!isNuligaTeamPortraitUrl(rosterUrl)) {
      return NextResponse.json(
        {
          error:
            'Diese URL ist keine Mannschaftsseite. Die Meldeliste steht auf dem Mannschaftsportrait (…/wa/teamPortrait?…), nicht auf der Gruppenseite.',
        },
        { status: 400 }
      );
    }

    // Datenschutz-Grenze: Das Portrait muss auf der nuLiga-Vereinsseite DIESES
    // Vereins stehen. Tabelle und Spielplan fremder Mannschaften bleiben
    // sichtbar (dort stehen nur Mannschaftsnamen) — Personendaten importieren
    // wir ausschließlich für die eigenen Mannschaften.
    const { data: ownClub } = await auth.supabase
      .from('clubs')
      .select('nuliga_club_url')
      .eq('id', clubId)
      .maybeSingle();

    if (ownClub?.nuliga_club_url) {
      try {
        const discovered = await fetchNuligaClubTeams(ownClub.nuliga_club_url);
        const ownPortraits = new Set(
          discovered.teams.map((t) => t.portraitUrl).filter((u): u is string => !!u)
        );
        if (!ownPortraits.has(rosterUrl)) {
          log.warn('Kader-Import abgelehnt — Mannschaft gehört nicht zum Verein', {
            leagueId: id,
            clubId,
          });
          return NextResponse.json(
            {
              error:
                'Diese Mannschaft steht nicht auf der nuLiga-Vereinsseite dieses Vereins. Meldelisten werden nur für eigene Mannschaften übernommen.',
            },
            { status: 403 }
          );
        }
      } catch (err) {
        // Portal nicht erreichbar: Wir lehnen ab statt durchzuwinken — eine
        // Prüfung, die bei Störung automatisch „ja" sagt, ist keine Prüfung.
        log.error('Vereinsseite für die Kader-Prüfung nicht erreichbar', {
          leagueId: id,
          error: err instanceof Error ? err.message : 'unbekannt',
        });
        return NextResponse.json(
          { error: 'nuLiga-Vereinsseite nicht erreichbar — Kader-Import vorerst nicht möglich.' },
          { status: 502 }
        );
      }
    }

    let portrait;
    try {
      portrait = await fetchNuligaTeamPortrait(rosterUrl);
    } catch (err) {
      log.error('Meldeliste konnte nicht geladen werden', {
        leagueId: id,
        error: err instanceof Error ? err.message : 'Unbekannter Fehler',
      });
      return NextResponse.json({ error: 'Fehler beim Abrufen der Meldeliste' }, { status: 502 });
    }

    if (portrait.players.length === 0) {
      return NextResponse.json(
        { error: 'Auf der Seite wurde keine Meldeliste gefunden. Stimmt die URL?' },
        { status: 422 }
      );
    }

    let stats;
    try {
      stats = await upsertRoster(
        auth.supabase,
        { id: league.id, club_id: clubId, name: league.name },
        portrait.players,
        rosterUrl
      );
    } catch (err) {
      log.error('Kader konnte nicht gespeichert werden', {
        leagueId: id,
        error: err instanceof Error ? err.message : 'unbekannt',
      });
      return NextResponse.json({ error: 'Kader konnte nicht gespeichert werden' }, { status: 500 });
    }

    // URL merken, damit der nächste Abruf ohne Eingabe läuft.
    if (!league.nuliga_roster_url) {
      await auth.supabase.from('leagues').update({ nuliga_roster_url: rosterUrl }).eq('id', id);
    }

    return NextResponse.json({
      success: true,
      teamName: portrait.teamName,
      imported: stats.imported,
      linked: stats.linked,
      unlinked: stats.imported - stats.linked,
    });
  });
}
