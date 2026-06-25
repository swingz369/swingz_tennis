/**
 * Turnier-Auslosung: KO-Bracket + Round-Robin.
 * Reine Berechnungsfunktionen — kein DB-Zugriff.
 */

export interface DrawEntry {
  id: string;
  name: string;
  seed?: number; // 1 = gesetzt (Topf 1), undefined = nicht gesetzt
}

export interface KoMatch {
  round: number; // 1 = Finale, 2 = Halbfinale, ...
  position: number; // 1-basiert pro Runde
  player1: DrawEntry | null; // null = Freilos
  player2: DrawEntry | null;
}

export interface RoundRobinMatch {
  round: number;
  player1: DrawEntry;
  player2: DrawEntry;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * KO-Bracket-Auslosung.
 * Gesetzte Spieler an Standardpositionen, ungesetzte zufällig gezogen.
 * Freilose füllen den Bracket auf Zweierpotenz auf.
 */
export function drawKoBracket(entries: DrawEntry[]): KoMatch[] {
  if (entries.length < 2) throw new Error('Mindestens 2 Teilnehmer erforderlich');

  const bracketSize = nextPowerOfTwo(entries.length);
  const seeded = entries.filter((e) => e.seed).sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));
  const unseeded = shuffle(entries.filter((e) => !e.seed));

  // Slots: Gesetzte zuerst, dann Ungesetzte, Rest = Freilos
  const slots: (DrawEntry | null)[] = Array(bracketSize).fill(null);
  [...seeded, ...unseeded].forEach((e, i) => {
    slots[i] = e;
  });

  const rounds = Math.log2(bracketSize);
  const matches: KoMatch[] = [];

  // Erste Runde
  for (let pos = 0; pos < bracketSize / 2; pos++) {
    matches.push({
      round: rounds,
      position: pos + 1,
      player1: slots[pos * 2],
      player2: slots[pos * 2 + 1],
    });
  }
  // Folgerunden (TBD — Sieger wird beim Eintragen gesetzt)
  for (let r = rounds - 1; r >= 1; r--) {
    for (let pos = 1; pos <= Math.pow(2, r - 1); pos++) {
      matches.push({ round: r, position: pos, player1: null, player2: null });
    }
  }

  return matches;
}

/**
 * Round-Robin nach Berger-Tableau (ausgewogene Rundenverteilung).
 * Ungerade Teilnehmerzahl: ein Spieler je Runde hat Freilos.
 */
export function drawRoundRobin(entries: DrawEntry[]): RoundRobinMatch[] {
  if (entries.length < 2) throw new Error('Mindestens 2 Teilnehmer erforderlich');

  const players = [...entries];
  if (players.length % 2 !== 0) players.push({ id: 'bye', name: 'Freilos' });

  const total = players.length;
  const matches: RoundRobinMatch[] = [];

  for (let r = 0; r < total - 1; r++) {
    for (let i = 0; i < total / 2; i++) {
      const p1 = players[i];
      const p2 = players[total - 1 - i];
      if (p1.id !== 'bye' && p2.id !== 'bye') {
        matches.push({ round: r + 1, player1: p1, player2: p2 });
      }
    }
    // Rotation: players[0] fixiert, Rest rotiert
    players.splice(1, 0, players.pop()!);
  }
  return matches;
}
