import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * GET /api/leagues/[id]/export — Export league match days as CSV
 *
 * CSV format compatible with tennis.de result imports:
 * Spieltag;Datum;Gegner;Heim/Auswärts;Ergebnis;Eigene;Gegner;Status;Notizen
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { id } = await params;

    // Fetch league name
    const { data: league } = await auth.supabase
      .from('leagues')
      .select('name, season_year, division')
      .eq('id', id)
      .single();

    if (!league) {
      return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });
    }

    // Fetch match days
    const { data: matchDays } = await auth.supabase
      .from('match_days')
      .select(
        'matchday_number, scheduled_date, opponent, is_home, venue, result, score_home, score_away, status, notes'
      )
      .eq('league_id', id)
      .order('matchday_number', { ascending: true });

    // CSV column headers
    const headers = [
      'Spieltag',
      'Datum',
      'Gegner',
      'Heim/Auswärts',
      'Spielort',
      'Ergebnis',
      'Punkte Heim',
      'Punkte Gast',
      'Status',
      'Notizen',
    ];

    if (!matchDays || matchDays.length === 0) {
      // Return empty CSV with just headers
      const emptyCsv = `\uFEFF${headers.join(';')}\n`;
      return new NextResponse(emptyCsv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="liga-${league.name.replace(/[^a-zA-Z0-9]/g, '_')}-${league.season_year}.csv"`,
        },
      });
    }

    const rows = matchDays.map((md: any) => [
      md.matchday_number,
      md.scheduled_date ?? '',
      md.opponent,
      md.is_home ? 'Heim' : 'Auswärts',
      md.venue ?? '',
      md.result === 'win'
        ? 'Sieg'
        : md.result === 'loss'
          ? 'Niederlage'
          : md.result === 'draw'
            ? 'Unentschieden'
            : '',
      md.score_home ?? '',
      md.score_away ?? '',
      md.status === 'completed' ? 'Abgeschlossen' : 'Ausstehend',
      md.notes ?? '',
    ]);

    // Prepend BOM for Excel compatibility
    const BOM = '\uFEFF';
    const csvContent =
      BOM +
      [
        `# Liga: ${league.name} (${league.season_year}${league.division ? ` - ${league.division}` : ''})`,
        `# Exportiert am: ${new Date().toLocaleDateString('de-DE')}`,
        '',
        headers.join(';'),
        ...rows.map((row: (string | number)[]) =>
          row
            .map((cell) => {
              const str = String(cell);
              // Escape cells containing semicolons, quotes, or newlines
              if (str.includes(';') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            })
            .join(';')
        ),
      ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="liga-${league.name.replace(/[^a-zA-Z0-9]/g, '_')}-${league.season_year}.csv"`,
      },
    });
  });
}
