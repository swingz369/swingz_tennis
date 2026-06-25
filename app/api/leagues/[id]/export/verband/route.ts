/**
 * app/api/leagues/[id]/export/verband/route.ts
 *
 * GET /api/leagues/[id]/export/verband — Medenspiel-CSV-Export für regionale
 * Tennis-Verbände (BTV, WTV, HTV, TVBB, …).
 *
 * Zielgruppe: Sportwarte, die nach einem Heimspiel die Ergebnisse im verband-
 * typischen CSV-Format an den zuständigen Verband melden.
 *
 * Hinweis: Verbands-Formate unterscheiden sich je Region. Dieses Format hier
 * ist eine *generische* Variante mit den in Deutschland üblichen Spalten.
 * Für den Real-Einsatz muss das Format mit dem jeweiligen Verband (BTV/WTV/
 * HTV) abgeglichen werden — Adapter ggf. erweitern.
 *
 * Schema (24 Spalten):
 *   [1] Heim + [2] Datum + [3] Spieltag + [4] Gegner +
 *   [5] Punkte_Eigene + [6] Punkte_Gegner +
 *   [7..18] Einzel1-6 (Eigene|Gegner) — 12 Zellen +
 *   [19..22] Doppel1-2 (Eigene|Gegner) — 4 Zellen +
 *   [23] Status + [24] Bemerkungen
 *
 * Auth: Trainer+ (Members sehen keine Spielpläne/CSV-Exports).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';
import { escapeCsvCell } from '@/lib/csv-export';

const log = createLogger('api:leagues/export/verband');

const VERBAND_HEADERS = [
  'Heim',
  'Datum',
  'Spieltag',
  'Gegner',
  'Punkte_Eigene',
  'Punkte_Gegner',
  'Einzel1_Eigene',
  'Einzel1_Gegner',
  'Einzel2_Eigene',
  'Einzel2_Gegner',
  'Einzel3_Eigene',
  'Einzel3_Gegner',
  'Einzel4_Eigene',
  'Einzel4_Gegner',
  'Einzel5_Eigene',
  'Einzel5_Gegner',
  'Einzel6_Eigene',
  'Einzel6_Gegner',
  'Doppel1_Eigene',
  'Doppel1_Gegner',
  'Doppel2_Eigene',
  'Doppel2_Gegner',
  'Status',
  'Bemerkungen',
] as const;

/**
 * Medenspiel-CSV-Generator. escapeCsvCell wird aus @/lib/csv-export verwendet.
 */

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'trainer');
    if (!hasRole) return forbiddenResponse('Trainer-Zugang erforderlich');
    if (!auth.clubId) return forbiddenResponse('Club-Kontext fehlt');

    const { id } = await params;
    // Filter: nur Matchdays dieser Liga
    const { data: league } = await auth.supabase
      .from('leagues')
      .select('id, name, season_year, division, age_group, nuliga_url')
      .eq('id', id)
      .eq('club_id', auth.clubId)
      .single();
    if (!league) {
      return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });
    }

    const { data: matchDays, error } = await auth.supabase
      .from('match_days')
      .select(
        'id, matchday_number, scheduled_date, opponent, is_home, venue, result, score_home, score_away, status, notes'
      )
      .eq('league_id', id)
      .order('matchday_number', { ascending: true });

    if (error) {
      log.error('Failed to fetch matchdays', { leagueId: id, error: error.message });
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
    }

    // Ergebnis-Detail (1:1 je Einzel/Doppel) — geplant aus separater Tabelle
    // `match_results`, aktuell leer, daher 16 leere Ergebnis-Zellen pro Zeile.
    // 12 Einzel-Zellen (Eigene|Gegner ×6) + 4 Doppel-Zellen (Eigene|Gegner ×2).
    const EMPTY_RESULT_CELLS = Array(16).fill('');

    const rows = (matchDays ?? []).map((md) => [
      md.is_home ? 'H' : 'A',
      md.scheduled_date ? new Date(md.scheduled_date).toLocaleDateString('de-DE') : '',
      md.matchday_number,
      md.opponent,
      md.score_home !== null && md.score_away !== null ? `${md.score_home}:${md.score_away}` : '',
      md.score_away ?? '',
      ...EMPTY_RESULT_CELLS,
      md.status === 'completed' ? 'abgeschlossen' : md.status,
      md.notes ?? '',
    ]);

    // Kopf-Block mit Liga-Metadaten (viele Verbände akzeptieren Kommentare am Anfang).
    const headerBlock = [
      `# Liga: ${league.name}`,
      `# Saison: ${league.season_year}`,
      league.division ? `# Klasse: ${league.division}` : '',
      league.age_group ? `# Altersklasse: ${league.age_group}` : '',
      `# Exportdatum: ${new Date().toLocaleDateString('de-DE')}`,
      '',
    ].filter(Boolean);

    // UTF-8 BOM für Excel-Kompatibilität.
    const BOM = '\uFEFF';
    const csv =
      BOM +
      [
        ...headerBlock,
        VERBAND_HEADERS.join(';'),
        ...rows.map((r) => r.map(escapeCsvCell).join(';')),
      ].join('\n');

    const filenameSafe = league.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="verband-${filenameSafe}-${league.season_year}.csv"`,
      },
    });
  });
}
