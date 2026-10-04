/**
 * SeasonPlanService.reschedule — Zeiten als Berliner Wandzeit, Konfliktprüfung, Schreibweg.
 * Vorher rechnete die Route mit setHours in der Serverzeitzone (Vercel: UTC), eine Gruppe
 * "18:00" landete in Produktion um 20:00 Berliner Zeit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/infrastructure/db', () => ({ getUserDb: () => ({}), systemDb: () => ({}) }));

const ENTRY_ID = '11111111-1111-4111-8111-111111111111';
const SEASON = { id: 'season-1', club_id: 'club-1' };
const TRAINER = '22222222-2222-4222-8222-222222222222';

const repo = {
  findEntryById: vi.fn(),
  findSeason: vi.fn(async () => SEASON),
  listSessionsFrom: vi.fn(),
  listOccupyingSessions: vi.fn(async () => [] as unknown[]),
  reschedule: vi.fn(async (_id: string, _e: unknown, moves: unknown[]) => moves.length),
};
vi.mock('@/infrastructure/persistence/repositories/season-plan.repository', () => ({
  SeasonPlanRepository: class {
    constructor() {
      return repo;
    }
  },
}));

const { SeasonPlanService } = await import('@/application/services/season-plan.service');

const auth = {
  role: 'admin',
  user: { id: 'u1' },
  memberships: [{ club_id: 'club-1', role: 'admin' }],
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  repo.findEntryById.mockResolvedValue({
    id: ENTRY_ID,
    season_id: 'season-1',
    day_of_week: 0,
    start_time: '17:00:00',
    end_time: '18:00:00',
    trainer_id: TRAINER,
    court_id: null,
    entry_type: 'training',
    admin_notes: null,
  });
  // Montag 19.10.2026 17:00 (Sommerzeit) und Montag 26.10.2026 17:00 (Winterzeit), UTC-Zeitpunkte.
  repo.listSessionsFrom.mockResolvedValue([
    {
      id: 's1',
      schedule_id: 'sch',
      timeslot_start: '2026-10-19T15:00:00Z',
      timeslot_end: '2026-10-19T16:00:00Z',
    },
    {
      id: 's2',
      schedule_id: 'sch',
      timeslot_start: '2026-10-26T16:00:00Z',
      timeslot_end: '2026-10-26T17:00:00Z',
    },
  ]);
});

describe('SeasonPlanService.reschedule', () => {
  it('legt Termine auf Mittwoch 18:00 Berliner Zeit — über die Zeitumstellung hinweg', async () => {
    const moved = await new SeasonPlanService(auth).reschedule(ENTRY_ID, {
      day_of_week: 2,
      start_time: '18:00',
      end_time: '19:30',
    });
    expect(moved).toBe(2);
    const [, entry, moves] = repo.reschedule.mock.calls[0];
    expect(moves).toEqual([
      { id: 's1', start: '2026-10-21T16:00:00.000Z', end: '2026-10-21T17:30:00.000Z' },
      { id: 's2', start: '2026-10-28T17:00:00.000Z', end: '2026-10-28T18:30:00.000Z' },
    ]);
    expect(entry).toMatchObject({ day_of_week: 2, start_time: '18:00:00', end_time: '19:30:00' });
  });

  it('meldet einen Konflikt mit einem anderen Termin von Trainer oder Platz', async () => {
    repo.listOccupyingSessions.mockResolvedValueOnce([
      { id: 'other', timeslot_start: '2026-10-21T16:30:00Z', timeslot_end: '2026-10-21T17:30:00Z' },
      // Der eigene Termin zählt nicht als Konflikt.
      { id: 's2', timeslot_start: '2026-10-26T16:00:00Z', timeslot_end: '2026-10-26T17:00:00Z' },
    ]);
    await expect(
      new SeasonPlanService(auth).reschedule(ENTRY_ID, {
        day_of_week: 2,
        start_time: '18:00',
        end_time: '19:00',
      })
    ).rejects.toMatchObject({ code: 'CONFLICT', details: expect.stringContaining('21.10.2026') });
    expect(repo.reschedule).not.toHaveBeenCalled();
  });

  it('lehnt Sonntag für Trainingsstunden ab', async () => {
    await expect(
      new SeasonPlanService(auth).reschedule(ENTRY_ID, { day_of_week: 6 })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('verweigert Admins anderer Vereine', async () => {
    const foreign = {
      ...(auth as object),
      memberships: [{ club_id: 'club-2', role: 'admin' }],
    } as never;
    await expect(
      new SeasonPlanService(foreign).reschedule(ENTRY_ID, { day_of_week: 2 })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
