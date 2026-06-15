/**
 * nuLiga Scraper Service
 *
 * Fetches and parses league standings (Tabelle) and match schedules (Spielplan)
 * from nuLiga portal pages (e.g. htv.liga.nu, btv.liga.nu, tvn.liga.nu).
 *
 * nuLiga pages are server-side rendered HTML using Java WebObjects.
 * Data tables use the CSS class "result-set".
 */

import * as cheerio from 'cheerio';

// ── Types ────────────────────────────────────────────────────────────────

export interface NuligaStanding {
  rank: number;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  matchPoints: string; // e.g. "12:4"
  sets: string; // e.g. "36:12"
  games: string; // e.g. "280:195"
}

export interface NuligaMatch {
  date: string; // e.g. "Sa. 27.06.2026 10:00"
  homeTeam: string;
  awayTeam: string;
  matchPoints: string | null; // e.g. "6:0" or null if "offen"
  sets: string | null;
  games: string | null;
  status: 'completed' | 'pending';
  reportUrl: string | null;
}

export interface NuligaGroupPage {
  championship: string;
  groupName: string;
  standings: NuligaStanding[];
  matches: NuligaMatch[];
  fetchedAt: string;
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Fetch and parse a nuLiga group page.
 *
 * @param url - Full nuLiga URL, e.g.
 *   https://htv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/groupPage?championship=Medenrunde+2026&group=1
 * @returns Parsed standings and match schedule
 */
export async function fetchNuligaGroupPage(url: string): Promise<NuligaGroupPage> {
  // Validate URL is from a known nuLiga domain
  const parsed = new URL(url);
  if (!parsed.hostname.endsWith('.liga.nu')) {
    throw new Error(
      `Ungültige nuLiga URL: Domain muss *.liga.nu sein (erhalten: ${parsed.hostname})`
    );
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SwingZ/1.0 (Vereinsmanagement; Kontakt: admin@swingz.de)',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'de-DE,de;q=0.9',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`nuLiga antwortete mit HTTP ${response.status}`);
  }

  const html = await response.text();
  return parseGroupPageHtml(html, url);
}

// ── HTML Parsing ─────────────────────────────────────────────────────────

function parseGroupPageHtml(html: string, sourceUrl: string): NuligaGroupPage {
  const $ = cheerio.load(html);

  // Extract championship and group name from page title
  const title = $('title').text().trim();
  // Title format: "nuLiga\n-\nDamen (6er) - Hessenliga Gr. 001"
  const groupName = title.replace(/^nuLiga\s*[-–]\s*/i, '').trim();

  // Extract championship from URL or breadcrumb
  const urlObj = new URL(sourceUrl);
  const championship = urlObj.searchParams.get('championship') || '';

  // ── Parse Standings (Tabelle) ────────────────────────────────────────
  const standings = parseStandingsTable($);

  // ── Parse Match Schedule (Spielplan) ─────────────────────────────────
  const matches = parseMatchSchedule($);

  return {
    championship: decodeURIComponent(championship),
    groupName,
    standings,
    matches,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Parse the standings table (Tabelle).
 *
 * nuLiga tables use <table class="result-set"> with:
 * Headers: Rang | Mannschaft | Begegnungen | S | U | N | Punkte | Matchpunkte | Sätze | Spiele
 * Data rows: <tr> with <td> cells
 */
function parseStandingsTable($: cheerio.CheerioAPI): NuligaStanding[] {
  // Find the "Tabelle" heading and its associated table
  const tableHeaders = ($('h2, h3, h4, b, strong') as any).filter((_: number, el: any) => {
    const text = $(el).text().trim().toLowerCase();
    // Match 'Tabelle' heading but NOT 'Tabelle und Spielplan (pdf)' links
    return text === 'tabelle' || (text.startsWith('tabelle') && !text.includes('spielplan'));
  });

  if (tableHeaders.length === 0) {
    // Fallback: use the first result-set table on the page
    return parseFirstResultSetTable($);
  }

  // Find the result-set table nearest to the Tabelle heading
  const table = tableHeaders.first().nextAll('table.result-set').first();
  if (table.length === 0) {
    // Try parent's next table
    const parentTable = tableHeaders.first().parent().find('table.result-set').first();
    if (parentTable.length === 0) return [];
    return extractStandingsFromTable($, parentTable);
  }

  return extractStandingsFromTable($, table);
}

function parseFirstResultSetTable($: cheerio.CheerioAPI): NuligaStanding[] {
  const table = $('table.result-set').first();
  if (table.length === 0) return [];
  return extractStandingsFromTable($, table);
}

function extractStandingsFromTable($: cheerio.CheerioAPI, table: any): NuligaStanding[] {
  const standings: NuligaStanding[] = [];
  const rows = table.find('tr');

  // Skip header row (first row contains <th> elements)
  rows.each((i: number, row: any) => {
    if (i === 0) return; // skip header

    const cells = $(row).find('td');
    if (cells.length < 4) return; // skip rows with too few cells

    const cellTexts: string[] = [];
    cells.each((_, cell) => {
      cellTexts.push($(cell).text().trim());
    });

    // Parse based on the observed column order.
    // nuLiga tables may have an empty first column before the rank.
    // Find the rank: it's the first cell that parses as a number.
    let rankIdx = 0;
    while (
      rankIdx < cellTexts.length &&
      (cellTexts[rankIdx] === '' || isNaN(parseInt(cellTexts[rankIdx], 10)))
    ) {
      rankIdx++;
    }
    if (rankIdx >= cellTexts.length) return;

    const rank = parseInt(cellTexts[rankIdx], 10);
    const teamName = cellTexts[rankIdx + 1] || '';
    if (!teamName) return;

    // Offset all remaining columns by rankIdx
    standings.push({
      rank,
      teamName,
      matchesPlayed: parseIntSafe(cellTexts[rankIdx + 2]),
      wins: parseIntSafe(cellTexts[rankIdx + 3]),
      draws: parseIntSafe(cellTexts[rankIdx + 4]),
      losses: parseIntSafe(cellTexts[rankIdx + 5]),
      points: parseIntSafe(cellTexts[rankIdx + 6]),
      matchPoints: cellTexts[rankIdx + 7] || '0:0',
      sets: cellTexts[rankIdx + 8] || '0:0',
      games: cellTexts[rankIdx + 9] || '0:0',
    });
  });

  return standings;
}

/**
 * Parse the match schedule (Spielplan).
 *
 * Structure:
 * Headers: Datum | Heimmannschaft | Gastmannschaft | Matchpunkte | Sätze | Spiele | Spielbericht
 */
function parseMatchSchedule($: cheerio.CheerioAPI): NuligaMatch[] {
  const matches: NuligaMatch[] = [];

  // Find the Spielplan heading
  const scheduleHeaders = ($('h2, h3, h4, b, strong') as any).filter((_: number, el: any) => {
    const text = $(el).text().trim().toLowerCase();
    return text === 'spielplan' || (text.startsWith('spielplan') && !text.includes('tabelle'));
  });

  if (scheduleHeaders.length === 0) return [];

  // Find the result-set table after the Spielplan heading
  const table = scheduleHeaders.first().nextAll('table.result-set').first();
  if (table.length === 0) return [];

  let currentDate = '';
  const rows = table.find('tr');

  rows.each((i: number, row: any) => {
    if (i === 0) return; // skip header row

    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const cellTexts: string[] = [];
    cells.each((_: number, cell: any) => {
      cellTexts.push($(cell).text().trim());
    });

    // nuLiga schedule layout (observed from HTV):
    // Column 0: Weekday ("Sa.", "So.") or empty for continuation rows
    // Column 1: Date+Time ("27.06.2026 10:00") or empty
    // Column 2: (often empty)
    // Column 3: Home team
    // Column 4: Away team
    // Columns 5-7: Match points, Sets, Games (often empty for pending)
    // Column 8: Status ("offen" or score)
    // OR compact layout:
    // Column 0: Home team
    // Column 1: Away team
    // Column 2+: Results or "offen"

    const col0 = cellTexts[0] || '';
    const col1 = cellTexts[1] || '';

    // Track date when it appears in column 1
    if (col1.match(/\d{2}\.\d{2}\.\d{4}/)) currentDate = col1;

    // Detect layout: date-layout has 9+ columns, compact has fewer
    // In date-layout, team names are in columns 3/4
    // Continuation rows (same date, multiple matches) have empty col0/col1 but still 9 columns
    const isDateLayout = cells.length >= 7 && (cellTexts[3] || cellTexts[4]);

    let homeTeam: string;
    let awayTeam: string;
    let date: string;
    let statusText: string;
    let reportUrl: string | null = null;

    if (isDateLayout) {
      // Date layout: Weekday | DateTime | _ | Home | Away | MP | Sets | Games | Status
      homeTeam = cellTexts[3] || '';
      awayTeam = cellTexts[4] || '';
      date = currentDate;

      // Status is in the last column
      statusText = cellTexts[8] || cellTexts[cellTexts.length - 1] || '';

      // Check for Spielbericht link in last column
      const lastCell = $(cells[cells.length - 1]);
      const reportLink = lastCell.find('a').attr('href');
      reportUrl = reportLink || null;
    } else {
      // Compact layout: Home | Away | results...
      homeTeam = col0;
      awayTeam = col1;
      date = currentDate;
      statusText = cellTexts[cellTexts.length - 1] || '';
    }

    if (!homeTeam || !awayTeam) return;

    // Determine if match is completed based on status text
    const isPending = !statusText || statusText.toLowerCase() === 'offen';

    // Try to extract match points from the cell before "offen" or from fixed positions
    let matchPoints: string | null = null;
    let sets: string | null = null;
    let games: string | null = null;

    if (!isPending) {
      // Extract scores from fixed column positions (date layout: cols 5/6/7)
      if (isDateLayout) {
        const mp = cellTexts[5]?.trim();
        matchPoints = mp && /^\d+:\d+$/.test(mp) ? mp : null;
        const s = cellTexts[6]?.trim();
        sets = s && /^\d+:\d+$/.test(s) ? s : null;
        const g = cellTexts[7]?.trim();
        games = g && /^\d+:\d+$/.test(g) ? g : null;
      }
      // Fallback: if no match points from columns, use status text
      if (!matchPoints) matchPoints = statusText.match(/^\d+:\d+$/) ? statusText : null;
    }

    const status: 'completed' | 'pending' = isPending ? 'pending' : 'completed';
    matches.push({
      date: date || currentDate,
      homeTeam,
      awayTeam,
      matchPoints: status === 'completed' ? matchPoints : null,
      sets: status === 'completed' ? sets : null,
      games: status === 'completed' ? games : null,
      status,
      reportUrl,
    });
  });

  return matches;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function parseIntSafe(value: string): number {
  const parsed = parseInt(value?.trim() || '0', 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Validate that a URL looks like a valid nuLiga group page URL.
 */
export function isValidNuligaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('.liga.nu')) return false;
    if (!parsed.pathname.includes('nuLiga')) return false;
    if (!parsed.pathname.includes('wa/')) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract the base domain prefix (e.g. "htv", "btv", "tvn") from a nuLiga URL.
 */
export function getNuligaDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.hostname.match(/^([a-z]+)\.liga\.nu$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

// ── Shared Helpers (exported for use by sync route and cron) ─────────

/**
 * Parse nuLiga date format to ISO date.
 * Input: "Sa. 27.06.2026 10:00" or "27.06.2026"
 * Output: "2026-06-27" or null
 */
export function parseNuligaDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Parse score string like "6:3" into { home: 6, away: 3 }.
 */
export function parseScore(scoreStr: string | null): { home: number; away: number } | null {
  if (!scoreStr || scoreStr.toLowerCase() === 'offen') return null;
  const parts = scoreStr.split(':');
  if (parts.length !== 2) return null;
  const home = parseInt(parts[0].trim(), 10);
  const away = parseInt(parts[1].trim(), 10);
  if (isNaN(home) || isNaN(away)) return null;
  return { home, away };
}
