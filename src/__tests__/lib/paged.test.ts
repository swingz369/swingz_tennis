/**
 * fetchAll/fetchAllIn: PostgREST kappt Antworten still bei 1000 Zeilen — die Helfer müssen
 * seitenweise weiterlesen, bis eine Seite nicht mehr voll ist, und Fehler werfen statt verschlucken.
 */
import { describe, it, expect } from 'vitest';
import { fetchAll, fetchAllIn, PAGE_SIZE } from '@/infrastructure/persistence/repositories/paged';

/** Fake-Builder über `total` Zeilen, der wie PostgREST auf `max-rows` kappt. */
function fakeTable(total: number, error: { message: string } | null = null) {
  const calls: [number, number][] = [];
  const build = () => ({
    range: (from: number, to: number) => {
      calls.push([from, to]);
      const rows = Array.from(
        { length: Math.max(0, Math.min(to, total - 1) - from + 1) },
        (_, i) => ({
          id: from + i,
        })
      );
      return Promise.resolve({ data: error ? null : rows, error });
    },
  });
  return { build, calls };
}

describe('fetchAll', () => {
  it('liest über die 1000er-Grenze hinaus vollständig und ohne Duplikate', async () => {
    const t = fakeTable(2500);
    const rows = await fetchAll(t.build, 'x');
    expect(rows).toHaveLength(2500);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2500);
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('macht bei genau einer vollen Seite eine weitere (leere) Abfrage', async () => {
    const t = fakeTable(PAGE_SIZE);
    expect(await fetchAll(t.build, 'x')).toHaveLength(PAGE_SIZE);
    expect(t.calls).toHaveLength(2);
  });

  it('wirft mit dem Aktionstext statt still zu kürzen', async () => {
    await expect(
      fetchAll(fakeTable(5, { message: 'boom' }).build, 'Lesen fehlgeschlagen')
    ).rejects.toThrow('Lesen fehlgeschlagen');
  });
});

describe('fetchAllIn', () => {
  it('teilt IDs in Blöcke und liest jeden Block seitenweise', async () => {
    const seen: string[][] = [];
    const rows = await fetchAllIn(
      Array.from({ length: 250 }, (_, i) => String(i)),
      (chunk) => {
        seen.push(chunk);
        return fakeTable(1200).build();
      },
      'x'
    );
    // build läuft je Seite neu (frischer Builder) — Blöcke also ohne Wiederholung betrachten
    const chunks = [...new Map(seen.map((c) => [c[0], c.length])).values()];
    expect(chunks).toEqual([100, 100, 50]);
    expect(rows).toHaveLength(3 * 1200);
  });
});
