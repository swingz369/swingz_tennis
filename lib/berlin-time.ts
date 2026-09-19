/**
 * lib/berlin-time.ts — Wandzeit → Zeitpunkt
 *
 * Die Saisonplanung arbeitet mit Wandzeiten: "dienstags 17:00" meint 17:00 Uhr
 * im Verein, unabhängig davon, wo der Server steht. `new Date().setHours(17)`
 * benutzt aber die Zeitzone der Laufzeit — lokal Europe/Berlin, auf Vercel UTC.
 * Derselbe Klick des Admins erzeugte dadurch je nach Umgebung einen anderen
 * Zeitpunkt (im Sommer 2 h Versatz). Bis 20.09.2026 war `sessions.timeslot_start`
 * eine Spalte ohne Zeitzone; Schreiben und Anzeigen hoben sich auf der
 * Entwicklermaschine gegenseitig auf, in Produktion nicht. Seit der Migration
 * `20260920100000_sessions_timestamptz` ist die Spalte `timestamptz`: gespeichert
 * wird der Zeitpunkt, der zur gemeinten Berliner Wandzeit gehört. Genau den bauen
 * `berlinWallClock`/`berlinDateTime` — auf jedem Server gleich. Wandzeit zurück
 * (Uhrzeit, Wochentag, Kalendertag) liefert `berlinParts`; `toTimeString()` und
 * `getDay()` auf dem Server sind tabu, sie lesen die Serverzeitzone.
 *
 * ponytail: Intl statt @date-fns/tz — spart eine Abhängigkeit für 15 Zeilen.
 */

const TIME_ZONE = 'Europe/Berlin';

/** Offset von Europe/Berlin zum gegebenen UTC-Zeitpunkt, in Minuten (+120 im Sommer). */
function berlinOffsetMinutes(utcMs: number): number {
  // 'sv-SE' liefert "YYYY-MM-DD HH:mm:ss" — als "…Z" gelesen ergibt die
  // Differenz zum Ausgangszeitpunkt genau den Offset der Zone.
  const asBerlinWallClock = new Date(utcMs).toLocaleString('sv-SE', { timeZone: TIME_ZONE });
  return (new Date(asBerlinWallClock.replace(' ', 'T') + 'Z').getTime() - utcMs) / 60_000;
}

/**
 * Baut den Zeitpunkt, der einer Berliner Wandzeit entspricht.
 *
 * @param base    Tag, dessen Datum übernommen wird (Jahr/Monat/Tag in UTC gelesen).
 * @param hours   Stunde der Wandzeit, z. B. 17.
 * @param minutes Minute der Wandzeit.
 */
export function berlinWallClock(base: Date, hours: number, minutes: number): Date {
  const naive = Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
    hours,
    minutes,
    0,
    0
  );
  // Zweiter Durchgang, damit der Offset am Zeitumstellungs-Wochenende aus der
  // Zielzeit statt aus der Ausgangszeit stammt.
  const firstGuess = naive - berlinOffsetMinutes(naive) * 60_000;
  return new Date(naive - berlinOffsetMinutes(firstGuess) * 60_000);
}

/** "2026-09-19" + "19:00" (Berliner Wandzeit, wie der Client sie schickt) → Zeitpunkt. */
export function berlinDateTime(date: string, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  return berlinWallClock(new Date(`${date}T00:00:00Z`), h, m);
}

/**
 * Berliner Kalenderfelder eines Zeitpunkts — unabhängig von der Serverzeitzone.
 * `dayOfWeek` folgt JS (0 = Sonntag).
 */
export function berlinParts(d: Date): { date: string; time: string; dayOfWeek: number } {
  const [date, time] = d.toLocaleString('sv-SE', { timeZone: TIME_ZONE }).split(' ');
  return { date, time: time.slice(0, 5), dayOfWeek: new Date(`${date}T12:00:00Z`).getUTCDay() };
}
