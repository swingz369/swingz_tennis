/**
 * app/api/leagues/import-nuliga/route.ts
 *
 * POST — ausgewählte nuLiga-Mannschaften als Ligen anlegen.
 *
 * Body: { portraitUrls: string[] }
 *
 * Der Client schickt nur die Auswahl, keine Inhalte: Name, Liga, Saison,
 * Gruppenseite und Meldeliste holt der Server selbst von der Vereinsseite des
 * Vereins. Das ist gleichzeitig die Sicherheits- und Datenschutzgrenze —
 * eine URL, die dort nicht steht, wird abgelehnt. Damit kann auch ein
 * manipulierter Client keine fremde Mannschaft anlegen, deren Meldeliste
 * anschließend Spielernamen liefern würde.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { logAudit } from '@/lib/audit';
import { fetchNuligaClubTeams, type NuligaClubTeam } from '@/lib/services/nuliga-scraper';

const log = createLogger('api:leagues:import-nuliga');

export const dynamic = 'force-dynamic';

/**
 * „Herren 40 (4er) - Bezirksliga Gr. 042" → division „Bezirksliga Gr. 042".
 * Ohne Bindestrich bleibt die Ligabezeichnung als Ganzes stehen.
 */
function divisionFrom(leagueName: string | null): string | null {
  if (!leagueName) return null;
  const parts = leagueName.split(' - ');
  return (parts.length > 1 ? parts.slice(1).join(' - ') : leagueName).trim() || null;
}

/** „Juniorinnen U12 (4er)" → „Juniorinnen U12" — Mannschaftsgröße ist keine Altersgruppe. */
function ageGroupFrom(team: NuligaClubTeam): string | null {
  const base = (team.leagueName?.split(' - ')[0] ?? team.teamName).replace(/\s*\(\d+er\)\s*/i, ' ');
  return (
    base
      .replace(/\s+(I{1,3}|IV|V|\d+)$/i, '')
      .replace(/\s+/g, ' ')
      .trim() || null
  );
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Zugriff nur für Admins');
    if (!auth.clubId) return forbiddenResponse('Vereinskontext erforderlich');
    const clubId = auth.clubId;

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const body = await request.json().catch(() => ({}));
    const requested: string[] = Array.isArray(body?.portraitUrls) ? body.portraitUrls : [];
    if (requested.length === 0) {
      return NextResponse.json({ error: 'Keine Mannschaft ausgewählt' }, { status: 400 });
    }

    const { data: club } = await (auth.supabase as any)
      .from('clubs')
      .select('id, nuliga_club_url')
      .eq('id', clubId)
      .maybeSingle();

    if (!club?.nuliga_club_url) {
      return NextResponse.json(
        { error: 'Für diesen Verein ist keine nuLiga-Vereinsseite hinterlegt.' },
        { status: 400 }
      );
    }

    let discovered;
    try {
      discovered = await fetchNuligaClubTeams(club.nuliga_club_url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      log.error('Vereinsseite nicht abrufbar', { clubId, error: message });
      return NextResponse.json({ error: `nuLiga nicht erreichbar: ${message}` }, { status: 502 });
    }

    // Nur Mannschaften, die wirklich auf der Vereinsseite stehen. Manche Zeilen
    // verlinken kein Mannschaftsportrait, sondern ausschließlich die
    // Gruppenseite (z. B. Spielgemeinschaften). Die waren bisher gar nicht
    // übernehmbar — der Client konnte sie auswählen, der Server kannte den
    // Schlüssel nicht und lehnte die gesamte Auswahl ab.
    const byUrl = new Map<string, NuligaClubTeam>();
    for (const t of discovered.teams) {
      if (t.portraitUrl) byUrl.set(t.portraitUrl, t);
      if (t.groupUrl) byUrl.set(t.groupUrl, t);
    }
    const selected = requested.map((url) => byUrl.get(url)).filter((t): t is NuligaClubTeam => !!t);

    if (selected.length === 0) {
      return NextResponse.json(
        {
          error:
            'Keine der übergebenen Mannschaften gehört zu diesem Verein. Bitte die Liste neu laden.',
        },
        { status: 403 }
      );
    }

    // Schon vorhandene Ligen überspringen statt Dubletten anzulegen.
    const { data: existing } = await (auth.supabase as any)
      .from('leagues')
      .select('nuliga_url, nuliga_roster_url')
      .eq('club_id', clubId);
    const known = new Set(
      ((existing ?? []) as any[]).flatMap((l) =>
        [l.nuliga_url, l.nuliga_roster_url].filter(Boolean)
      )
    );

    const currentYear = new Date().getFullYear();
    // Dubletten über beide möglichen Quellen prüfen, nicht nur über das Portrait.
    const rows = selected
      .filter((t) => !known.has((t.portraitUrl ?? t.groupUrl) as string))
      .map((t) => ({
        club_id: clubId,
        name: t.leagueName ? `${t.teamName} — ${divisionFrom(t.leagueName)}` : t.teamName,
        season_year: t.seasonYear ?? currentYear,
        league_type: 'regular',
        division: divisionFrom(t.leagueName),
        sport: 'tennis',
        age_group: ageGroupFrom(t),
        // Das Mannschaftsportrait ist die bessere Hauptquelle: Es liefert nur
        // die eigenen Spieltermine und die Meldeliste, die Gruppenseite nur
        // Tabelle plus alle fremden Begegnungen. Fehlt das Portrait, ist die
        // Gruppenseite besser als gar keine Verknüpfung.
        nuliga_url: t.portraitUrl ?? t.groupUrl,
        // Eine Meldeliste gibt es nur im Portrait — ohne Portrait bleibt das leer.
        nuliga_roster_url: t.portraitUrl,
        own_team_name: t.teamName,
        notes: t.groupUrl ? `Gruppenseite (Tabelle): ${t.groupUrl}` : null,
      }));

    if (rows.length === 0) {
      return NextResponse.json({ created: 0, skipped: selected.length });
    }

    const { data: created, error } = await (auth.supabase as any)
      .from('leagues')
      .insert(rows)
      .select('id, name');

    if (error) {
      log.error('Ligen konnten nicht angelegt werden', { clubId, error: error.message });
      return NextResponse.json({ error: 'Ligen konnten nicht angelegt werden' }, { status: 500 });
    }

    await logAudit(
      ((created ?? []) as any[]).map((l) => ({
        actorId: auth.user.id,
        action: 'create',
        resourceType: 'league',
        resourceId: l.id,
        clubId,
        details: { kind: 'nuliga_import', name: l.name },
        request,
      }))
    );

    return NextResponse.json({
      created: created?.length ?? 0,
      skipped: selected.length - rows.length,
      leagues: created ?? [],
    });
  });
}
