/**
 * 1.3.3 — nuLiga CSV-Import-Fallback
 * Parst Semikolon-getrennte UTF-8-Exporte (Tabelle + Spielplan).
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('nuliga-csv-parser');

export class NuligaCsvParseError extends Error {
  constructor(
    message: string,
    public readonly row?: number
  ) {
    super(message);
    this.name = 'NuligaCsvParseError';
  }
}

// ── Standings (Tabelle) ──────────────────────────────────────────────────────

export interface ParsedStanding {
  rank: number;
  name: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

/**
 * Parst nuLiga-Tabellen-CSV.
 * Erwartet Spalten (Reihenfolge flexibel, Semikolon-Trenner):
 * Rang;Mannschaft;Spiele;S;U;N;Punkte  (+ optionale Zusatzspalten)
 */
export function parseStandingsCsv(csv: string): ParsedStanding[] {
  const lines = csv
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim());

  if (lines.length < 2) throw new NuligaCsvParseError('CSV hat keine Datenzeilen');

  const header = lines[0].split(';').map((h) => h.trim().toLowerCase());

  const col = (names: string[]) => {
    const idx = names.map((n) => header.indexOf(n)).find((i) => i >= 0);
    if (idx === undefined)
      throw new NuligaCsvParseError(`Spalte ${names[0]} nicht gefunden in: ${header.join(';')}`);
    return idx;
  };

  const rankIdx = col(['rang', 'platz', 'pos', '#']);
  const nameIdx = col(['mannschaft', 'team', 'verein', 'name']);
  const playedIdx = col(['spiele', 'sp', 'ges', 'gespielt']);
  const winsIdx = col(['s', 'siege', 'sieg', 'w']);
  const drawsIdx = col(['u', 'unentschieden', 'remis', 'd']);
  const lossIdx = col(['n', 'niederlagen', 'niederlage', 'l']);
  const ptsIdx = col(['punkte', 'pkt', 'pts', 'p']);

  return lines.slice(1).flatMap((line, i) => {
    const cells = line.split(';').map((c) => c.trim());
    if (cells.every((c) => !c)) return [];
    const num = (idx: number) => {
      const v = parseInt(cells[idx] ?? '', 10);
      if (isNaN(v))
        throw new NuligaCsvParseError(`Zeile ${i + 2}: "${cells[idx]}" ist keine Zahl`, i + 2);
      return v;
    };
    return [
      {
        rank: num(rankIdx),
        name: cells[nameIdx] ?? '',
        matchesPlayed: num(playedIdx),
        wins: num(winsIdx),
        draws: num(drawsIdx),
        losses: num(lossIdx),
        points: num(ptsIdx),
      },
    ];
  });
}

// ── Matches (Spielplan) ──────────────────────────────────────────────────────

export interface ParsedMatch {
  matchdayNumber: number;
  opponent: string;
  scheduledDate: Date | null;
  isHome: boolean;
}

/**
 * Parst nuLiga-Spielplan-CSV.
 * Erwartet Spalten: Spieltag;Datum;Heim;Gast  (+ optionale Spalten)
 * Der eigene Teamname (ourTeam) dient zur Erkennung Heim/Auswärts.
 */
export function parseMatchesCsv(csv: string, ourTeam: string): ParsedMatch[] {
  const lines = csv
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim());

  if (lines.length < 2) throw new NuligaCsvParseError('CSV hat keine Datenzeilen');

  const header = lines[0].split(';').map((h) => h.trim().toLowerCase());

  const col = (names: string[], required = true) => {
    const idx = names.map((n) => header.indexOf(n)).find((i) => i >= 0);
    if (idx === undefined && required)
      throw new NuligaCsvParseError(`Spalte ${names[0]} nicht gefunden in: ${header.join(';')}`);
    return idx ?? -1;
  };

  const dayIdx = col(['spieltag', 'st', 'runde', 'matchday']);
  const dateIdx = col(['datum', 'date', 'tag']);
  const homeIdx = col(['heimmannschaft', 'heim', 'home']);
  const guestIdx = col(['gastmannschaft', 'gast', 'guest', 'auswärts']);

  const lower = ourTeam.toLowerCase();

  return lines.slice(1).flatMap((line, i) => {
    const cells = line.split(';').map((c) => c.trim());
    if (cells.every((c) => !c)) return [];

    const matchdayNumber = parseInt(cells[dayIdx] ?? '', 10);
    if (isNaN(matchdayNumber)) {
      log.info('Überspringe Zeile ohne Spieltag-Nummer', { row: i + 2, raw: cells[dayIdx] });
      return [];
    }

    const homeTeam = cells[homeIdx] ?? '';
    const guestTeam = cells[guestIdx] ?? '';
    const isHome = homeTeam.toLowerCase().includes(lower);
    const opponent = isHome ? guestTeam : homeTeam;

    let scheduledDate: Date | null = null;
    const rawDate = cells[dateIdx];
    if (rawDate) {
      const parts = rawDate.includes('.') ? rawDate.split('.').reverse() : rawDate.split('-');
      const parsed = new Date(
        `${parts[0]}-${parts[1]?.padStart(2, '0')}-${parts[2]?.padStart(2, '0')}`
      );
      if (!isNaN(parsed.getTime())) scheduledDate = parsed;
    }

    return [{ matchdayNumber, opponent, scheduledDate, isHome }];
  });
}
