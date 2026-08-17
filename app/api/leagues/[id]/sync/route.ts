import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { isValidNuligaUrl } from '@/lib/services/nuliga-scraper';
import { syncLeagueFromNuliga } from '@/lib/services/nuliga-sync';

/**
 * POST /api/leagues/[id]/sync — Sync league data from nuLiga
 *
 * Holt Tabelle und Spielplan von der hinterlegten nuLiga-URL und übernimmt sie.
 * Die eigentliche Übernahme steht in `lib/services/nuliga-sync.ts` — dieselbe
 * Funktion benutzt der Cron.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { id } = await params;

    const { data: league, error: leagueError } = await auth.supabase
      .from('leagues')
      .select('id, name, nuliga_url, own_team_name, club_id')
      .eq('id', id)
      .single();

    if (leagueError || !league) {
      return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });
    }

    if (!league.club_id) {
      return NextResponse.json({ error: 'Liga hat keine club_id zugeordnet' }, { status: 400 });
    }

    // URL aus dem Body überschreibt die gespeicherte (Erstverbindung).
    let nuligaUrl = league.nuliga_url;
    const body = await request.json().catch(() => ({}));
    if (body?.nuliga_url) nuligaUrl = body.nuliga_url;

    if (!nuligaUrl) {
      return NextResponse.json(
        {
          error:
            'Keine nuLiga-URL konfiguriert. Bitte hinterlege die URL in den Liga-Einstellungen.',
        },
        { status: 400 }
      );
    }

    if (!isValidNuligaUrl(nuligaUrl)) {
      return NextResponse.json(
        { error: 'Ungültige nuLiga-URL. Die URL muss von *.liga.nu stammen.' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    let result;
    try {
      result = await syncLeagueFromNuliga(auth.supabase, league, nuligaUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      await auth.supabase.from('nuliga_sync_log').insert({
        league_id: id,
        club_id: league.club_id,
        status: 'failed',
        trigger: 'manual',
        error_message: message,
        nuliga_url: nuligaUrl,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: `Fehler beim Abrufen von nuLiga: ${message}` },
        { status: 502 }
      );
    }

    const completedAt = new Date();
    await auth.supabase
      .from('leagues')
      .update({
        last_synced_at: completedAt.toISOString(),
        nuliga_url: nuligaUrl,
        // Konnte die eigene Mannschaft über den Vereinsnamen aufgelöst werden,
        // merken wir sie — der nächste Sync muss dann nicht mehr raten.
        ...(result.ownTeam && !league.own_team_name ? { own_team_name: result.ownTeam } : {}),
      })
      .eq('id', id);

    // Der Supabase-Query-Builder ist ein Thenable, aber kein Promise — ein
    // angehängtes `.catch()` wirft "is not a function" und riss vorher den
    // ganzen Sync mit sich. Deshalb echtes await in try/catch.
    try {
      await auth.supabase.from('nuliga_sync_log').insert({
        league_id: id,
        club_id: league.club_id,
        status: 'success',
        trigger: 'manual',
        teams_created: result.teamsCreated,
        teams_updated: result.teamsUpdated,
        matches_created: result.matchesCreated,
        matches_updated: result.matchesUpdated,
        nuliga_url: nuligaUrl,
        nuliga_group_name: result.groupName,
        nuliga_championship: result.championship,
        started_at: new Date(startTime).toISOString(),
        completed_at: completedAt.toISOString(),
        duration_ms: completedAt.getTime() - startTime,
      });
    } catch {
      // Ein fehlgeschlagener Protokolleintrag darf den Sync nicht rot machen.
    }

    return NextResponse.json({
      success: true,
      ...result,
      warning: result.ownTeam
        ? undefined
        : 'Eigene Mannschaft nicht erkannt — Tabelle wurde übernommen, der Spielplan nicht. Bitte den Mannschaftsnamen exakt wie in der nuLiga-Tabelle in den Liga-Einstellungen eintragen.',
    });
  });
}
