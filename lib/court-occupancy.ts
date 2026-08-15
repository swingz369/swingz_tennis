/**
 * Platzbelegung als Wochenraster (Heatmap-Datenquelle für /admin).
 *
 * Warum eigenes Modul und nicht direkt in der Page: die Bucket-Logik ist
 * zeitzonenabhängig und damit die einzige Stelle des Dashboards, die still
 * falsch werden kann, ohne dass ein Typfehler auffällt. Sie steht hier
 * isoliert und hat einen Test daneben (`lib/__tests__/court-occupancy.test.ts`).
 *
 * Zeitzone: die Buckets werden in `Europe/Berlin` gebildet, nicht in der
 * Server-Zeitzone. Auf Vercel läuft der Node-Prozess in UTC — ein Slot um
 * 00:30 MESZ landet dort sonst im Vortag und im falschen Stundenbucket.
 * Gleiche Begründung wie in `lib/utils/admin-date.ts`.
 */

const TIME_ZONE = 'Europe/Berlin';

/** Öffnungsfenster der Heatmap. Slots ausserhalb werden verworfen. */
export const OCCUPANCY_FIRST_HOUR = 7;
export const OCCUPANCY_LAST_HOUR = 22;

export type OccupancyEntry = {
  /** ISO-Timestamp des Slot-Beginns. */
  start: string;
  /** Platz-ID. `null` = Slot ohne Platzzuordnung, zählt nicht mit. */
  courtId: string | null;
};

export type OccupancyGrid = {
  /** Stundenachse, z. B. [7, 8, …, 22]. */
  hours: number[];
  /** Eine Zeile pro Wochentag, Mo–So. */
  days: {
    /** Kurzlabel, z. B. `Mo`. */
    label: string;
    /** Belegungsgrad 0–1 je Stunde, gleiche Länge wie `hours`. */
    cells: number[];
  }[];
  /** Anzahl aktiver Plätze — der Nenner. */
  courtCount: number;
  /** true, wenn in der ganzen Woche nichts belegt ist. */
  isEmpty: boolean;
};

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/**
 * Liefert Wochentag (0 = Montag) und Stunde eines Zeitpunkts in Europe/Berlin.
 * `Intl` statt `getDay()`/`getHours()`, weil letztere die Server-Zeitzone
 * verwenden würden.
 */
function berlinDayAndHour(iso: string): { day: number; hour: number } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hourRaw = parts.find((p) => p.type === 'hour')?.value;
  if (!weekday || !hourRaw) return null;

  // en-GB 'short' liefert Mon/Tue/… — Index 0 = Montag, passend zu DAY_LABELS.
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday);
  if (day < 0) return null;

  // '24' kommt bei hour12:false für Mitternacht vor (Intl-Eigenheit).
  const hour = Number(hourRaw) % 24;
  if (!Number.isFinite(hour)) return null;

  return { day, hour };
}

/**
 * Baut das Wochenraster aus Slots.
 *
 * Belegungsgrad einer Zelle = Anzahl *verschiedener* belegter Plätze in dieser
 * Stunde / Anzahl aktiver Plätze. Doppelzählung ist damit ausgeschlossen: eine
 * Session und eine Buchung auf demselben Platz zur selben Stunde ergeben 1
 * belegten Platz, nicht 2. Genau dafür sind es Sets und keine Zähler.
 */
export function buildOccupancyGrid(entries: OccupancyEntry[], courtCount: number): OccupancyGrid {
  const hours: number[] = [];
  for (let h = OCCUPANCY_FIRST_HOUR; h <= OCCUPANCY_LAST_HOUR; h++) hours.push(h);

  // [Tag][Stundenindex] → Set der belegten Platz-IDs
  const buckets: Set<string>[][] = DAY_LABELS.map(() => hours.map(() => new Set<string>()));

  for (const entry of entries) {
    if (!entry.courtId) continue;
    const slot = berlinDayAndHour(entry.start);
    if (!slot) continue;
    const hourIndex = slot.hour - OCCUPANCY_FIRST_HOUR;
    if (hourIndex < 0 || hourIndex >= hours.length) continue;
    buckets[slot.day][hourIndex].add(entry.courtId);
  }

  // Ohne Plätze gibt es keinen sinnvollen Nenner — dann ist alles 0 und die
  // Karte zeigt ihren Leerzustand, statt durch 0 zu teilen.
  const denominator = courtCount > 0 ? courtCount : 0;
  let occupied = 0;

  const days = DAY_LABELS.map((label, dayIndex) => ({
    label,
    cells: buckets[dayIndex].map((set) => {
      if (set.size > 0) occupied++;
      if (denominator === 0) return 0;
      return Math.min(1, set.size / denominator);
    }),
  }));

  return { hours, days, courtCount, isEmpty: occupied === 0 };
}

/**
 * Montag 00:00 und Montag+7 00:00 der Woche, in der `now` liegt — als
 * ISO-Strings für die Supabase-Range-Filter.
 *
 * ponytail: Wochengrenze in Server-Zeit, nicht in Europe/Berlin. Der Fehler
 * ist maximal ±2 h an genau zwei Zeitpunkten pro Woche und betrifft nur, ob
 * ein Randslot noch mitgeladen wird — die Einsortierung ins Raster darüber
 * ist zeitzonenrichtig. Wenn das mal stört: `Intl` wie oben, statt setDate().
 */
export function currentWeekRange(now: Date = new Date()): { from: string; to: string } {
  const start = new Date(now);
  // getDay(): 0 = Sonntag. Auf Montag als Wochenstart umrechnen.
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return { from: start.toISOString(), to: end.toISOString() };
}
