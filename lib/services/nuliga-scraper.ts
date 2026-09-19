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
import * as Sentry from '@sentry/nextjs';
import { createLogger } from '@/lib/logger';

const log = createLogger('nuliga-scraper');

// ── Types ────────────────────────────────────────────────────────────────

/**
 * Kill-Switch für jeden Abruf bei nuLiga. Die AGB von tennis.de untersagen Scraping und
 * gewerbliche Weiterverwendung; solange das nicht geklärt ist, bleibt der Abruf aus.
 * Nur exakt `NULIGA_SCRAPING=on` schaltet ihn ein (lokal für Tests/Entwicklung).
 * Anzeige von Liga-Daten läuft über das tennis.de-Widget (`components/tennisde-widget.tsx`).
 */
export function assertNuligaScrapingEnabled(): void {
  if (process.env.NULIGA_SCRAPING !== 'on') {
    throw new Error('Der Abruf von nuLiga-Daten ist deaktiviert (nutze das tennis.de-Widget).');
  }
}

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
  assertNuligaScrapingEnabled();
  // Validate URL is from a known nuLiga domain
  const parsed = new URL(url);
  if (!parsed.hostname.endsWith('.liga.nu')) {
    throw new Error(
      `Ungültige nuLiga URL: Domain muss *.liga.nu sein (erhalten: ${parsed.hostname})`
    );
  }

  const response = await fetchWithRetry(url);

  if (!response.ok) {
    throw new Error(`nuLiga antwortete mit HTTP ${response.status}`);
  }

  const html = await response.text();
  const result = parseGroupPageHtml(html, url);

  // A3: leere Tabelle = HTML-Layout möglicherweise geändert → sofort loggen + Sentry-Alarm (T1.3.1)
  if (result.standings.length === 0 && result.matches.length === 0) {
    triggerLayoutAlarm(url, html);
  }

  return result;
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
  const matches = parseMatchSchedule($, sourceUrl);

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
function parseMatchSchedule($: cheerio.CheerioAPI, sourceUrl: string): NuligaMatch[] {
  const matches: NuligaMatch[] = [];

  // Find the Spielplan heading. Die Gruppenseite nennt den Abschnitt "Spielplan",
  // das Mannschaftsportrait "Spieltermine - <Liga> <Jahr>" — gleiche Tabelle,
  // gleiche Spalten, nur eine andere Überschrift.
  const scheduleHeaders = ($('h2, h3, h4, b, strong') as any).filter((_: number, el: any) => {
    const text = $(el).text().trim().toLowerCase();
    if (text.startsWith('spieltermine')) return true;
    return text === 'spielplan' || (text.startsWith('spielplan') && !text.includes('tabelle'));
  });

  if (scheduleHeaders.length === 0) return [];

  // Find the result-set table after the Spielplan heading
  const table = scheduleHeaders.first().nextAll('table.result-set').first();
  if (table.length === 0) return [];

  let currentDate = '';
  const rows = table.find('tr');

  // Spalten über die Kopfzeile finden (colspan aufgelöst). Seit Sommer 2026 hat
  // nuLiga eine Spalte „Spielort" eingeschoben — die festen Indizes unten
  // lasen danach Spielort/Heim statt Heim/Gast, und jede Begegnung fiel weg.
  const col: Record<string, number> = {};
  let pos = 0;
  rows
    .first()
    .find('th')
    .each((_: number, th: any) => {
      const label = $(th).text().trim().toLowerCase();
      if (!(label in col)) col[label] = pos;
      pos += parseInt($(th).attr('colspan') ?? '1', 10) || 1;
    });
  const byHeader = col.heimmannschaft !== undefined && col.gastmannschaft !== undefined;

  rows.each((i: number, row: any) => {
    if (i === 0) return; // skip header row

    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const cellTexts: string[] = [];
    cells.each((_: number, cell: any) => {
      cellTexts.push($(cell).text().trim());
    });

    if (byHeader) {
      const dateCell = cellTexts
        .slice(0, col.heimmannschaft)
        .find((t) => /\d{2}\.\d{2}\.\d{4}/.test(t));
      if (dateCell) currentDate = dateCell;

      const homeTeam = cellTexts[col.heimmannschaft] ?? '';
      const awayTeam = cellTexts[col.gastmannschaft] ?? '';
      if (!homeTeam || !awayTeam) return;

      const score = (label: string) => {
        const v = col[label] !== undefined ? cellTexts[col[label]] : undefined;
        return v && /^\d+:\d+$/.test(v) ? v : null;
      };
      const matchPoints = score('matchpunkte');
      const status: 'completed' | 'pending' = matchPoints ? 'completed' : 'pending';
      const reportHref =
        col.spielbericht !== undefined ? $(cells[col.spielbericht]).find('a').attr('href') : null;

      matches.push({
        date: currentDate,
        homeTeam,
        awayTeam,
        matchPoints,
        sets: status === 'completed' ? score('sätze') : null,
        games: status === 'completed' ? score('spiele') : null,
        status,
        reportUrl: reportHref ? absolutize(reportHref, sourceUrl) : null,
      });
      return;
    }

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

      // Check for Spielbericht link in last column. nuLiga liefert relative
      // hrefs — absolut machen, sonst ist der Link außerhalb von nuLiga tot.
      const lastCell = $(cells[cells.length - 1]);
      const reportLink = lastCell.find('a').attr('href');
      reportUrl = reportLink ? absolutize(reportLink, sourceUrl) : null;
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

// ── Mannschaftsmeldung (Meldeliste / Kader) ──────────────────────────────

export interface NuligaRosterPlayer {
  /** Meldeposition (Spalte "Rang"), 1 = erste Position. */
  position: number;
  /** Klarname in der Form "Vorname Nachname", ohne Jahrgangs-Klammer. */
  name: string;
  /** Leistungsklasse wie angezeigt, z. B. "LK4,6" — null wenn keine gemeldet. */
  lk: string | null;
  /** DTB-ID aus der Spalte "ID-Nummer" — stabiler Schlüssel zum Vereinsmitglied. */
  dtbId: string | null;
  /** Jahrgang aus der Klammer hinter dem Namen — trennt gleichnamige Personen. */
  birthYear: number | null;
}

/**
 * Ergebnis einer Mannschaftsportrait-Seite (`/wa/teamPortrait`).
 *
 * Diese Seite ist die, die ein Sportwart tatsächlich im Browser offen hat, und
 * sie enthält alles Wichtige auf einmal: den eigenen Mannschaftsnamen, NUR die
 * eigenen Spieltermine (kein Filtern nötig) und die Meldeliste mit LK und
 * DTB-ID. Für die Tabelle verlinkt sie zusätzlich auf die Gruppenseite.
 */
export interface NuligaTeamPortrait {
  teamName: string;
  /** z. B. "Damen 30 Südwest-Liga Gr. 005 NO" */
  leagueName: string | null;
  /** Absolute URL der Gruppenseite (für die Tabelle), falls verlinkt. */
  groupPageUrl: string | null;
  matches: NuligaMatch[];
  players: NuligaRosterPlayer[];
  fetchedAt: string;
}

/** Erkennt eine Mannschaftsportrait-URL (im Gegensatz zur Gruppenseite). */
export function isNuligaTeamPortraitUrl(url: string): boolean {
  return /\/wa\/teamPortrait/i.test(url);
}

/**
 * Mannschaftsportrait abrufen und auswerten.
 *
 * Gespeichert wird ausschließlich die Meldeliste der EIGENEN Mannschaft — die
 * Seite enthält keine fremden Spielernamen (siehe Migration 20260815130000).
 */
export async function fetchNuligaTeamPortrait(url: string): Promise<NuligaTeamPortrait> {
  assertNuligaScrapingEnabled();
  const parsed = new URL(url);
  if (!parsed.hostname.endsWith('.liga.nu')) {
    throw new Error(
      `Ungültige nuLiga URL: Domain muss *.liga.nu sein (erhalten: ${parsed.hostname})`
    );
  }

  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error(`nuLiga antwortete mit HTTP ${response.status}`);

  const html = await response.text();
  const portrait = parseTeamPortraitHtml(html, url);

  // Weder Spiele noch Spieler ⇒ Layout hat sich vermutlich geändert.
  if (portrait.matches.length === 0 && portrait.players.length === 0) {
    triggerLayoutAlarm(url, html);
  }
  return portrait;
}

function parseTeamPortraitHtml(html: string, sourceUrl: string): NuligaTeamPortrait {
  const $ = cheerio.load(html);

  // Kopf-Tabelle: zweispaltige Label/Wert-Zeilen (Verein | Mannschaft | Liga | Tabelle).
  let teamName = '';
  let leagueName: string | null = null;
  $('table.result-set tr').each((_: number, row: any) => {
    const cells = $(row).find('th, td');
    if (cells.length !== 2) return;
    const label = $(cells[0]).text().trim().toLowerCase();
    const value = $(cells[1]).text().trim().replace(/\s+/g, ' ');
    if (label === 'mannschaft' && !teamName) teamName = value;
    if (label === 'liga' && !leagueName) leagueName = value;
  });

  if (!teamName) {
    teamName = $('title')
      .text()
      .trim()
      .replace(/^nuLiga\s*[-–]\s*/i, '')
      .trim();
  }

  // Link auf die Gruppenseite — dort steht die Tabelle.
  let groupPageUrl: string | null = null;
  $('a').each((_: number, a: any) => {
    if (groupPageUrl) return;
    const href = $(a).attr('href');
    if (href && /\/wa\/groupPage\?/i.test(href)) groupPageUrl = absolutize(href, sourceUrl);
  });

  return {
    teamName,
    leagueName,
    groupPageUrl,
    matches: parseMatchSchedule($, sourceUrl),
    players: parseRosterTable($),
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Meldeliste parsen.
 *
 * Beobachtete Kopfzeile (RLSW, Sommer 2026):
 *   Rang | LK | ID-Nummer | Name, Vorname | Nation | Info | SG | Einzel | Doppel | gesamt
 *
 * Die Spalten werden über die Kopfzeile gesucht statt über feste Indizes, weil
 * die Reihenfolge zwischen den Verbänden schwankt.
 */
function parseRosterTable($: cheerio.CheerioAPI): NuligaRosterPlayer[] {
  const players: NuligaRosterPlayer[] = [];

  ($('table.result-set') as any).each((_: number, tbl: any) => {
    if (players.length > 0) return; // erste passende Tabelle gewinnt

    const table = $(tbl);
    const headers = table
      .find('tr')
      .first()
      .find('th, td')
      .map((_i: number, c: any) => $(c).text().trim().toLowerCase())
      .get() as string[];

    // "Name, Vorname" trifft, "Heimmannschaft" (Spielplan) bewusst nicht.
    const nameIdx = headers.findIndex((h) => h.includes('name') && !h.includes('mannschaft'));
    if (nameIdx < 0) return;
    const lkIdx = headers.findIndex((h) => h === 'lk' || h.includes('leistungsklasse'));
    const idIdx = headers.findIndex((h) => h.includes('id-nummer') || h === 'id');
    const rankIdx = headers.findIndex((h) => h === 'rang' || h === 'nr.' || h === 'pos');

    table.find('tr').each((i: number, row: any) => {
      if (i === 0) return; // Kopfzeile
      const cells = $(row).find('td');
      if (cells.length <= nameIdx) return;

      const cellTexts = cells.map((_i: number, c: any) => $(c).text().trim()).get() as string[];
      const rawName = cellTexts[nameIdx] ?? '';
      if (!rawName) return;

      const rank = parseInt(cellTexts[rankIdx >= 0 ? rankIdx : 0] ?? '', 10);

      players.push({
        position: isNaN(rank) ? players.length + 1 : rank,
        name: normalizePlayerName(rawName),
        lk: lkIdx >= 0 ? cellTexts[lkIdx] || null : null,
        dtbId: idIdx >= 0 ? cellTexts[idIdx] || null : null,
        birthYear: extractBirthYear(rawName),
      });
    });
  });

  return players;
}

/** "Mustermann, Max (1989)" → 1989. */
export function extractBirthYear(raw: string): number | null {
  const m = raw.match(/\(\s*(\d{4})\s*\)/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * "Mustermann, Max (1989)" → "Max Mustermann".
 * Der Jahrgang in Klammern gehört nicht zum Namen — bliebe er stehen, landete
 * er mitten im Vornamen und jeder Abgleich mit einem Mitglied schlüge fehl.
 */
export function normalizePlayerName(raw: string): string {
  const cleaned = raw
    .replace(/\(\s*\d{4}\s*\)/g, '') // Jahrgang
    .replace(/\s+/g, ' ')
    .trim();
  const comma = cleaned.indexOf(',');
  if (comma < 0) return cleaned;
  const last = cleaned.slice(0, comma).trim();
  const first = cleaned.slice(comma + 1).trim();
  return first ? `${first} ${last}` : last;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function parseIntSafe(value: string): number {
  const parsed = parseInt(value?.trim() || '0', 10);
  return isNaN(parsed) ? 0 : parsed;
}

/** Relativen nuLiga-href gegen die Quell-URL auflösen. */
function absolutize(href: string, sourceUrl: string): string | null {
  try {
    return new URL(href, sourceUrl).toString();
  } catch {
    return null;
  }
}

// ── Retry-Layer (Q1 · 1.3.1) ──────────────────────────────────────────────

interface FetchWithRetryOptions {
  /** Total retry attempts AFTER the initial attempt. 3 ⇒ 4 fetches max. */
  retries?: number;
  /** Initial backoff delay; doubles per attempt (capped at 8s). */
  baseDelayMs?: number;
  /** Per-attempt fetch timeout. */
  perAttemptTimeoutMs?: number;
}

/**
 * Fetch with exponential-backoff retry layer for nuLiga HTTP calls.
 *
 * Retry policy:
 * - 5xx server errors → retry (5xx is transient / upstream infrastructure)
 * - Network errors (fetch throws TypeError), AbortError, TimeoutError → retry
 * - 4xx client errors → NO retry (fail fast — bad URL, page removed, etc.)
 * - Final retry throws an explicit Error with retry-count context so the
 *   caller (and Sentry) can distinguish "first-try 503" from "503 exhausted
 *   4 attempts". Network errors are re-thrown as-is so the original cause
 *   is preserved in the stack trace (fetch failed / AbortError / Timeout).
 */
async function fetchWithRetry(
  url: string,
  {
    retries = 3,
    baseDelayMs = 500,
    perAttemptTimeoutMs = 15_000,
    // Die Vereinssuche ist ein WebObjects-Formular und braucht POST; alles
    // andere holt GET. Deshalb hier optional durchgereicht statt einer
    // zweiten fetch-Implementierung daneben.
    method,
    headers: extraHeaders,
    body,
  }: FetchWithRetryOptions & {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...(method ? { method } : {}),
        ...(body !== undefined ? { body } : {}),
        headers: {
          'User-Agent': 'SwingZ/1.0 (Vereinsmanagement; Kontakt: admin@swingz.de)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'de-DE,de;q=0.9',
          ...(extraHeaders ?? {}),
        },
        signal: AbortSignal.timeout(perAttemptTimeoutMs),
      });
      if (response.ok) return response;
      // 4xx client errors → fail fast, no retry (caller throws).
      if (response.status >= 400 && response.status < 500) return response;
      // 5xx → retry until exhaustion, then throw with retry-count context.
      if (attempt === retries) {
        throw new Error(
          `nuLiga responded with HTTP ${response.status} after ${retries + 1} attempts`
        );
      }
      log.warn('nuLiga-fetch 5xx — retry', { url, attempt, status: response.status });
    } catch (err) {
      // Network / Timeout / AbortError: rethrow as-is so original cause
      // is preserved. Only the helper's own exhausted-retry-error above
      // takes this path on 5xx — for network errors we let the underlying
      // TypeError/AbortError propagate naturally.
      if (attempt === retries) throw err;
      log.warn('nuLiga-fetch network error — retry', {
        url,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    // Exponential backoff: 500ms, 1000ms, 2000ms (hard cap 8s keeps worst-case bounded).
    await new Promise((r) => setTimeout(r, Math.min(baseDelayMs * 2 ** attempt, 8000)));
  }
  // Defensive — every code path above either returns or throws.
  throw new Error('fetchWithRetry: unreachable — loop invariant broken');
}

// ── Layout-Alarm (Q1 · 1.3.1) ──────────────────────────────────────────────

/**
 * Fire an "empty parse" alarm: likely a nuLiga HTML/CSS layout change.
 *
 * Logs to the structured logger AND captures a tagged Sentry exception with
 * a per-host-name fingerprint, so a single layout change surfaces as ONE
 * grouped issue in Sentry (rather than flooding the feed with N copies).
 */
function triggerLayoutAlarm(url: string, html: string): void {
  let hostname = 'unknown';
  try {
    hostname = new URL(url).hostname;
  } catch {
    // URL was already validated by fetchNuligaGroupPage; safe to swallow here.
  }

  // NB: We use log.warn here (not log.error) because lib/logger.error auto-
  // fires Sentry.captureException(new Error(message)). The structured
  // Sentry.withScope(...) capture below is the canonical alarm — calling
  // log.error would create a duplicate Entry in Sentry with no tags.
  log.warn('nuLiga-Parse lieferte leere Ergebnisse — Layout-Alarm', {
    url,
    htmlSnippet: html.slice(0, 300),
  });

  Sentry.withScope((scope) => {
    scope.setTag('component', 'nuliga-scraper');
    scope.setTag('reason', 'layout_empty');
    scope.setTag('nuLiga_host', hostname);
    scope.setFingerprint(['nuliga', 'layout-alarm', hostname]);
    scope.setExtra('html_snippet', html.slice(0, 300));
    scope.setExtra('url', url);
    Sentry.captureException(
      new Error('nuLiga-Layout-Alarm: keine Tabellen + keine Matches geparst')
    );
  });
}

// ── Vereinsseite: alle Mannschaften auf einmal ───────────────────────

/**
 * Eine Mannschaft, wie sie auf der Vereinsseite (`/wa/clubTeams`) steht.
 *
 * Diese Seite ist der Schlüssel zur Automatisierung: Sie listet für einen
 * Verein sämtliche gemeldeten Mannschaften mit Liga, Gruppenseite und
 * Mannschaftsportrait — der Admin muss also keine einzige URL mehr von Hand
 * heraussuchen und eintippen.
 *
 * Beobachtete Kopfzeile (HTV, Sommer 2026):
 *   Mannschaft | Mannschaftsführer | Gruppe | Tab.-Rang | Punkte | Downloads
 *
 * Die Spalte „Mannschaftsführer" enthält Name und Telefonnummer. Sie wird
 * bewusst NICHT übernommen — für den Ligabetrieb in SwingZ ist sie unnötig,
 * und ungenutzte personenbezogene Daten haben in der Datenbank nichts verloren.
 */
export interface NuligaClubTeam {
  /** Mannschaftsname wie gemeldet, z. B. „Herren 40 II". */
  teamName: string;
  /** Volle Ligabezeichnung, z. B. „Herren 40 - Bezirksliga Gr. 042". */
  leagueName: string | null;
  /** Wettbewerb, z. B. „Medenrunde 2026". */
  championship: string | null;
  /** Saisonjahr aus dem Wettbewerb, z. B. 2026. */
  seasonYear: number | null;
  /** Mannschaftsportrait — Spielplan der eigenen Mannschaft + Meldeliste. */
  portraitUrl: string | null;
  /** Gruppenseite — Tabelle und alle Begegnungen der Gruppe. */
  groupUrl: string | null;
}

export interface NuligaClubTeams {
  /** Vereinsnummer aus dem `club`-Parameter. */
  clubNumber: string | null;
  /** Quell-URL, wie sie gespeichert wird. */
  sourceUrl: string;
  teams: NuligaClubTeam[];
  fetchedAt: string;
}

/** Erkennt eine Vereinsseite (Mannschaftsübersicht eines Vereins). */
export function isNuligaClubUrl(url: string): boolean {
  return /\/wa\/(clubTeams|clubPools|clubInfoDisplay|clubMeetings)/i.test(url);
}

/** Vereinsnummer aus einer beliebigen nuLiga-Vereins-URL. */
export function getNuligaClubNumber(url: string): string | null {
  try {
    return new URL(url).searchParams.get('club');
  } catch {
    return null;
  }
}

/**
 * Normalisiert jede Vereins-URL auf die Mannschaftsübersicht.
 *
 * Ein Admin kopiert typischerweise das, was gerade im Browser steht — das kann
 * `clubInfoDisplay`, `clubMeetings` oder `clubPools` sein. Alle tragen dieselbe
 * Vereinsnummer, nur `clubTeams` listet die Mannschaften.
 */
export function toNuligaClubTeamsUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const club = parsed.searchParams.get('club');
    if (!club) return null;
    const base = parsed.pathname.replace(/\/wa\/[A-Za-z]+$/, '/wa/clubTeams');
    return `${parsed.origin}${base}?club=${encodeURIComponent(club)}`;
  } catch {
    return null;
  }
}

/** „Medenrunde 2026" / „Sommer 2026" → 2026. */
function seasonYearFrom(text: string | null | undefined): number | null {
  const match = text?.match(/(20\d{2})/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Alle Mannschaften eines Vereins abrufen.
 *
 * @param url - Beliebige Vereins-URL (`…/wa/clubTeams?club=24949` oder eine
 *              andere Vereinsseite mit `club`-Parameter).
 */
export async function fetchNuligaClubTeams(url: string): Promise<NuligaClubTeams> {
  assertNuligaScrapingEnabled();
  const teamsUrl = toNuligaClubTeamsUrl(url);
  if (!teamsUrl) {
    throw new Error(
      'Die URL enthält keine Vereinsnummer. Erwartet wird eine nuLiga-Vereinsseite mit „?club=…".'
    );
  }
  const parsed = new URL(teamsUrl);
  if (!parsed.hostname.endsWith('.liga.nu')) {
    throw new Error(
      `Ungültige nuLiga URL: Domain muss *.liga.nu sein (erhalten: ${parsed.hostname})`
    );
  }

  const response = await fetchWithRetry(teamsUrl);
  if (!response.ok) throw new Error(`nuLiga antwortete mit HTTP ${response.status}`);

  const teams = parseClubTeamsHtml(await response.text(), teamsUrl);
  return {
    clubNumber: getNuligaClubNumber(teamsUrl),
    sourceUrl: teamsUrl,
    teams,
    fetchedAt: new Date().toISOString(),
  };
}

function parseClubTeamsHtml(html: string, sourceUrl: string): NuligaClubTeam[] {
  const $ = cheerio.load(html);
  const teams: NuligaClubTeam[] = [];

  ($('table.result-set') as any).each((_: number, tbl: any) => {
    const table = $(tbl);
    let championship: string | null = null;

    table.find('tr').each((_i: number, row: any) => {
      const $row = $(row);
      const cells = $row.find('td');

      // Zwischenüberschrift („Medenrunde 2026") — eine einzelne Zelle über die
      // ganze Breite. Sie gilt für alle folgenden Zeilen bis zur nächsten.
      if (cells.length === 1) {
        const text = $(cells[0]).text().trim();
        if (text) championship = text.replace(/\s+/g, ' ');
        return;
      }
      if (cells.length < 3) return; // Kopfzeile

      const teamName = $(cells[0]).text().replace(/\s+/g, ' ').trim();
      if (!teamName) return;

      // Die Links tragen die eigentliche Information — der Zellentext nicht.
      let portraitUrl: string | null = null;
      let groupUrl: string | null = null;
      $row.find('a').each((_j: number, a: any) => {
        const href = $(a).attr('href');
        if (!href) return;
        if (!portraitUrl && /\/wa\/teamPortrait\?/i.test(href)) {
          portraitUrl = absolutize(href, sourceUrl);
        }
        if (!groupUrl && /\/wa\/groupPage\?/i.test(href)) {
          groupUrl = absolutize(href, sourceUrl);
        }
      });

      // Ohne Portrait- und ohne Gruppenlink ist die Zeile für uns wertlos
      // (z. B. eine reine Hinweiszeile).
      if (!portraitUrl && !groupUrl) return;

      const leagueName = $(cells[2]).text().replace(/\s+/g, ' ').trim() || null;
      teams.push({
        teamName,
        leagueName,
        championship,
        seasonYear: seasonYearFrom(championship) ?? seasonYearFrom(leagueName),
        portraitUrl,
        groupUrl,
      });
    });
  });

  return teams;
}

/**
 * Vereinssuche im Verbandsportal.
 *
 * Damit muss ein Admin nicht einmal die Vereins-URL heraussuchen: Er tippt den
 * Vereinsnamen, wir liefern die Treffer samt Vereinsnummer.
 *
 * `clubSearch` ist ein WebObjects-Formular (POST). Die Trefferliste verlinkt
 * pro Verein auf `clubTeams?club=<nr>`.
 */
export async function searchNuligaClubs(
  federationHost: string,
  federation: string,
  searchTerm: string
): Promise<Array<{ name: string; city: string | null; clubNumber: string; teamsUrl: string }>> {
  assertNuligaScrapingEnabled();
  const origin = federationHost.startsWith('http') ? federationHost : `https://${federationHost}`;
  const parsed = new URL(origin);
  if (!parsed.hostname.endsWith('.liga.nu')) {
    throw new Error(
      `Ungültiger Verband: Domain muss *.liga.nu sein (erhalten: ${parsed.hostname})`
    );
  }

  const url = `${parsed.origin}/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/clubSearch`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      federation,
      searchFor: searchTerm,
      region: '',
      WOSubmitAction: 'search',
    }).toString(),
  });
  if (!response.ok) throw new Error(`nuLiga antwortete mit HTTP ${response.status}`);

  const $ = cheerio.load(await response.text());
  const teamsUrlFor = (clubNumber: string) =>
    `${parsed.origin}/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/clubTeams?club=${encodeURIComponent(clubNumber)}`;

  // Fall 1 — mehrere Treffer: Ergebnistabelle mit je einer Zeile pro Verein.
  //   Zellen: „Tennisclub Limeshain 1974 e.V. (05111)" | „Limeshain"
  const results = new Map<
    string,
    { name: string; city: string | null; clubNumber: string; teamsUrl: string }
  >();

  ($('a') as any).each((_: number, a: any) => {
    const href = $(a).attr('href');
    if (!href || !/\/wa\/clubInfoDisplay\?/i.test(href)) return;
    const absolute = absolutize(href, url);
    if (!absolute) return;
    const clubNumber = getNuligaClubNumber(absolute);
    if (!clubNumber || results.has(clubNumber)) return;

    const $row = $(a).closest('tr');
    if ($row.length === 0) return; // Tab-Navigation, keine Ergebniszeile
    const cells = $row.find('td');
    const name = $(cells[0]).text().replace(/\s+/g, ' ').trim();
    if (!name) return;
    const city = cells.length > 1 ? $(cells[1]).text().replace(/\s+/g, ' ').trim() || null : null;
    results.set(clubNumber, { name, city, clubNumber, teamsUrl: teamsUrlFor(clubNumber) });
  });

  if (results.size > 0) return Array.from(results.values());

  // Fall 2 — genau ein Treffer: nuLiga springt direkt auf die Vereinsseite.
  // Dann gibt es keine Ergebnistabelle; der Vereinsname steht in der
  // Überschrift („TC Bad Homburg\n Vereinsinfo"), die Nummer im Tab-Link.
  const directLink = ($('a') as any)
    .toArray()
    .map((a: any) => $(a).attr('href'))
    .find((href: string | undefined) => href && /\/wa\/club(Teams|InfoDisplay)\?/i.test(href));
  const directNumber = directLink ? getNuligaClubNumber(absolutize(directLink, url) ?? '') : null;
  if (!directNumber) return [];

  const heading = $('h1').first().text().replace(/\s+/g, ' ').trim();
  const name = heading.replace(/\s*Vereinsinfo\s*$/i, '').trim() || searchTerm;
  return [{ name, city: null, clubNumber: directNumber, teamsUrl: teamsUrlFor(directNumber) }];
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
 * Wie `parseNuligaDate`, behält aber die Uhrzeit.
 * Input: "Sa. 27.06.2026 10:00" → "2026-06-27T10:00" (lokale Wandzeit, ohne Zone)
 * Ohne Uhrzeit → "2026-06-27". Ohne Datum → null.
 *
 * Getrennt von `parseNuligaDate`, weil dessen date-only-Rückgabe an anderen
 * Stellen erwartet wird. Die Uhrzeit brauchen wir für die Platzsperre.
 */
export function parseNuligaDateTime(dateStr: string): string | null {
  const date = parseNuligaDate(dateStr);
  if (!date) return null;
  const time = dateStr.match(/(\d{1,2}):(\d{2})/);
  if (!time) return date;
  return `${date}T${time[1].padStart(2, '0')}:${time[2]}`;
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
