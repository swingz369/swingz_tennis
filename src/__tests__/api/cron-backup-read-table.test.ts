import { describe, expect, it } from 'vitest';
import { readTablePage } from '@/app/api/cron/backup/route';

// Regression: readTablePage löste `from` vom Client und verlor `this` —
// jedes Backup war leer („reading 'rest'"). Der Fake liest wie supabase-js
// über `this` und bricht, sobald die Bindung wieder fehlt.
class FakeClient {
  rest = {
    from: (table: string) => ({
      select: () => ({
        range: async (from: number, to: number) => ({
          data: [{ table, from, to }],
          error: null,
          count: 1,
        }),
      }),
    }),
  };
  from(table: string) {
    return this.rest.from(table);
  }
}

describe('cron backup readTablePage', () => {
  it('ruft from() am Client auf, nicht losgelöst', async () => {
    const client = new FakeClient() as unknown as Parameters<typeof readTablePage>[0];
    const result = await readTablePage(client, 'trainer_club', 0, 999);
    expect(result.data).toEqual([{ table: 'trainer_club', from: 0, to: 999 }]);
  });
});
