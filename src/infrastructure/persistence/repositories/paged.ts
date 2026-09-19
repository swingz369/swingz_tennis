/**
 * PostgREST liefert je Abfrage höchstens 1000 Zeilen (`max-rows`) und kappt darüber still —
 * ohne Fehler, ohne Hinweis. Für Listen, die wachsen können (Mitglieder, Einheiten, Zusagen,
 * Planeinträge), liest `fetchAll` deshalb seitenweise, bis eine Seite nicht mehr voll ist.
 *
 * Die Abfrage muss eine stabile Reihenfolge haben (`.order('id')` als letztes Sortierkriterium),
 * sonst können Zeilen zwischen den Seiten doppelt vorkommen oder fehlen.
 */
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:paged');

export const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** `build` muss bei jedem Aufruf einen frischen Query-Builder liefern (er wird je Seite neu gebaut). */
export async function fetchAll<T>(
  build: () => { range(from: number, to: number): Page<T> },
  action: string
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) {
      log.error(action, new Error(error.message));
      throw new Error(action);
    }
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}

/** Wie `fetchAll`, aber für `.in()`-Filter mit vielen IDs: in Blöcken (URL-Länge), je Block seitenweise. */
export async function fetchAllIn<T>(
  ids: string[],
  build: (chunk: string[]) => { range(from: number, to: number): Page<T> },
  action: string,
  size = 100
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    const chunk = ids.slice(i, i + size);
    out.push(...(await fetchAll(() => build(chunk), action)));
  }
  return out;
}
