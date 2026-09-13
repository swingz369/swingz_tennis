import { describe, it, expect } from 'vitest';
import { TrialTrainingRepository } from '@/infrastructure/persistence/repositories/trial-training.repository';

type Row = Record<string, unknown>;

/**
 * Minimaler Supabase-Client-Stub für `.from(table).select().eq(...).order(...)`
 * bzw. `.maybeSingle()`. Reicht für die Multi-Tenant-Regression unten —
 * kein Ersatz für die Integrationstests gegen die echte lokale DB.
 */
function makeDbStub(tables: Record<string, Row[]>) {
  function builder(table: string, filters: Array<[string, unknown]> = []) {
    const rows = tables[table] ?? [];
    const applyFilters = (data: Row[]) =>
      filters.reduce((acc, [col, val]) => acc.filter((r) => r[col] === val), data);

    const chain: any = {
      select: () => chain,
      eq: (col: string, val: unknown) => builder(table, [...filters, [col, val]]),
      order: () => chain,
      maybeSingle: async () => {
        const result = applyFilters(rows);
        return { data: result[0] ?? null, error: null };
      },
      then: (resolve: (v: { data: Row[]; error: null }) => void) =>
        resolve({ data: applyFilters(rows), error: null }),
    };
    return chain;
  }

  return { from: (table: string) => builder(table) } as any;
}

const rowFor = (id: string, clubId: string): Row => ({
  id,
  club_id: clubId,
  participant_id: `p-${id}`,
  participant_first_name: 'Max',
  participant_last_name: 'Mustermann',
  participant_email: 'max@example.com',
  participant_phone: '+49 123',
  participant_date_of_birth: '1990-01-01',
  scheduled_date: '2026-10-01',
  scheduled_time: '10:00',
  duration: 60,
  trainer_id: 'trainer-1',
  trainer_name: 'Trainer',
  court_id: 'court-1',
  court_name: 'Platz 1',
  status: 'scheduled',
  notes: null,
  feedback_rating: null,
  feedback_comments: null,
  feedback_would_recommend: null,
  converted_to_member_id: null,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
});

describe('TrialTrainingRepository.findById', () => {
  it('findet ein Probetraining eines anderen Vereins nicht', async () => {
    const db = makeDbStub({
      trial_trainings: [rowFor('tt-1', 'club-1')],
    });
    const repo = new TrialTrainingRepository(db);

    const result = await repo.findById('tt-1', 'club-2');

    expect(result).toBeNull();
  });

  it('findet ein Probetraining des eigenen Vereins', async () => {
    const db = makeDbStub({
      trial_trainings: [rowFor('tt-1', 'club-1')],
    });
    const repo = new TrialTrainingRepository(db);

    const result = await repo.findById('tt-1', 'club-1');

    expect(result?.participant.email).toBe('max@example.com');
  });
});

describe('TrialTrainingRepository.findAll', () => {
  it('schließt Probetrainings eines anderen Vereins aus', async () => {
    const db = makeDbStub({
      trial_trainings: [rowFor('tt-1', 'club-1'), rowFor('tt-2', 'club-2')],
    });
    const repo = new TrialTrainingRepository(db);

    const result = await repo.findAll('club-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tt-1');
  });
});
