/**
 * app/api/admin/nuliga/discover/route.ts
 *
 * POST — Mannschaften des eigenen Vereins bei nuLiga finden.
 *
 * Zweck: Der Admin soll keine nuLiga-URLs mehr abtippen. Er gibt einmal die
 * Vereinsseite an (oder sucht den Verein nach Namen); danach liefert diese
 * Route die vollständige Mannschaftsliste mit Liga, Gruppenseite und
 * Mannschaftsportrait. Die Vereins-URL wird am Verein gespeichert, sodass der
 * nächste Aufruf — auch in der nächsten Saison — ohne Eingabe auskommt.
 *
 * Body (alle optional):
 *   { url?: string }                       — nuLiga-Vereinsseite
 *   { search?: string, federation?: string, host?: string } — Vereinssuche
 *   {}                                     — nimmt clubs.nuliga_club_url
 *
 * Datenschutz: Diese Route liest ausschließlich öffentlich zugängliche
 * Verbandsseiten und speichert daraus nur die URL. Spielernamen werden hier
 * nicht angefasst — der Kader-Import läuft getrennt und ist auf die hier
 * ermittelten eigenen Mannschaften begrenzt.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { logAudit } from '@/lib/audit';
import {
  fetchNuligaClubTeams,
  searchNuligaClubs,
  toNuligaClubTeamsUrl,
  isValidNuligaUrl,
} from '@/lib/services/nuliga-scraper';

const log = createLogger('api:admin:nuliga:discover');

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Zugriff nur für Admins');
    if (!auth.clubId) return forbiddenResponse('Vereinskontext erforderlich');
    const clubId = auth.clubId;

    // Jede Anfrage löst mehrere Zugriffe auf ein fremdes Portal aus — deshalb
    // dasselbe Limit wie bei den übrigen schreibenden Routen.
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const body = await request.json().catch(() => ({}));
    const search: string | undefined = body?.search?.trim() || undefined;

    // ── Vereinssuche ──────────────────────────────────────────────────
    if (search) {
      const host: string = body?.host?.trim() || 'htv.liga.nu';
      const federation: string = body?.federation?.trim() || host.split('.')[0].toUpperCase();
      try {
        const clubs = await searchNuligaClubs(host, federation, search);
        return NextResponse.json({ clubs });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
        log.error('Vereinssuche fehlgeschlagen', { search, host, error: message });
        return NextResponse.json(
          { error: `Vereinssuche fehlgeschlagen: ${message}` },
          { status: 502 }
        );
      }
    }

    // ── Mannschaften einer Vereinsseite ───────────────────────────────
    const { data: club } = await (auth.supabase as any)
      .from('clubs')
      .select('id, nuliga_club_url')
      .eq('id', clubId)
      .maybeSingle();

    const rawUrl: string | null = body?.url?.trim() || club?.nuliga_club_url || null;
    if (!rawUrl) {
      return NextResponse.json(
        {
          error:
            'Keine nuLiga-Vereinsseite hinterlegt. Bitte die Vereinsseite verlinken oder den Verein suchen.',
        },
        { status: 400 }
      );
    }
    if (!isValidNuligaUrl(rawUrl)) {
      return NextResponse.json(
        { error: 'Ungültige nuLiga-URL. Die URL muss von *.liga.nu stammen.' },
        { status: 400 }
      );
    }
    const teamsUrl = toNuligaClubTeamsUrl(rawUrl);
    if (!teamsUrl) {
      return NextResponse.json(
        {
          error:
            'Die URL enthält keine Vereinsnummer. Erwartet wird die Vereinsseite mit „?club=…" — z. B. die Seite „Mannschaften" des Vereins.',
        },
        { status: 400 }
      );
    }

    let result;
    try {
      result = await fetchNuligaClubTeams(teamsUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      log.error('Mannschaften konnten nicht geladen werden', { teamsUrl, error: message });
      return NextResponse.json({ error: `nuLiga nicht erreichbar: ${message}` }, { status: 502 });
    }

    if (result.teams.length === 0) {
      return NextResponse.json(
        { error: 'Auf der Vereinsseite wurden keine Mannschaften gefunden. Stimmt die URL?' },
        { status: 422 }
      );
    }

    // Bereits angelegte Ligen markieren, damit die Oberfläche keine Dubletten
    // zum Anlegen anbietet.
    const { data: existing } = await (auth.supabase as any)
      .from('leagues')
      .select('id, nuliga_url, nuliga_roster_url, own_team_name, season_year')
      .eq('club_id', clubId);

    const known = new Set(
      ((existing ?? []) as any[]).flatMap((l) =>
        [l.nuliga_url, l.nuliga_roster_url].filter(Boolean)
      )
    );

    const teams = result.teams.map((t) => ({
      ...t,
      alreadyImported: !!(
        (t.portraitUrl && known.has(t.portraitUrl)) ||
        (t.groupUrl && known.has(t.groupUrl))
      ),
    }));

    // URL merken — ab jetzt läuft die Suche ohne Eingabe.
    if (club && club.nuliga_club_url !== result.sourceUrl) {
      await (auth.supabase as any)
        .from('clubs')
        .update({ nuliga_club_url: result.sourceUrl })
        .eq('id', clubId);

      await logAudit({
        actorId: auth.user.id,
        action: 'update',
        resourceType: 'club',
        resourceId: clubId,
        clubId,
        details: { kind: 'nuliga_club_url_set', url: result.sourceUrl },
        request,
      });
    }

    return NextResponse.json({
      clubNumber: result.clubNumber,
      sourceUrl: result.sourceUrl,
      teams,
    });
  });
}
