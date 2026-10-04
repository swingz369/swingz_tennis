/**
 * `expected_participants` ist jsonb. supabase-js macht aus `.contains(col, [id])` ein
 * Postgres-Array-Literal `{id}` — PostgREST antwortet dann mit "invalid input syntax for type
 * json" (in Produktion am 04.10.2026: /api/user/member/groups lieferte 500). Der Filter muss JSON sein.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { SeasonPlanRepository } =
  await import('@/infrastructure/persistence/repositories/season-plan.repository');

describe('SeasonPlanRepository.listParticipantEntries', () => {
  it('filtert expected_participants mit JSON, nicht mit einem PG-Array', async () => {
    const calls: unknown[][] = [];
    const chain: Record<string, unknown> = {};
    for (const m of ['from', 'select', 'eq', 'order']) chain[m] = () => chain;
    chain.contains = (...args: unknown[]) => {
      calls.push(args);
      return chain;
    };
    chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });

    await new SeasonPlanRepository(chain as never).listParticipantEntries('club-1', 'user-1');
    expect(calls).toEqual([['expected_participants', '["user-1"]']]);
  });
});
