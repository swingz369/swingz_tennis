/**
 * Verhaltens-Tests für PATCH /api/seasons/[id]/plan-entries/[entryId] —
 * bisher ungetestet trotz Komplexität 53 (Fund 16.09.2026, tokensave
 * test_risk). Deckt Rollen-/Club-Guards, Validierung (Wertebereich,
 * Sonntags-Sperre, Zeitfenster, "keine bekannten Felder"), Terminkonflikt-
 * erkennung und die Nachrück-Logik von der Saison-Warteliste ab.
 *
 * Route → SeasonPlanService → Repository (ADR-005); das Repository ist
 * gemockt, Auth/Rollen laufen über den Harness aus ../helpers/api-route.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.mock('@/lib/csrf', () => ({
  withCSRFProtection: vi.fn((_req: unknown, fn: () => Promise<Response>) => fn()),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitOrFail: vi.fn(async () => null),
  RATE_LIMITS: { STANDARD: { max: 100, windowMs: 60000, message: 'Zu viele Anfragen.' } },
}));

// Repository gemockt: getestet werden Route + Service (Rollen, Validierung, Konflikte,
// Nachrücken). Die Abfragen selbst laufen gegen RLS und sind per test:tenant abgedeckt.
const repo = {
  findSeason: vi.fn(),
  findEntry: vi.fn(),
  findConflicts: vi.fn(),
  updateEntry: vi.fn(),
  updateEntries: vi.fn(),
  deleteEntry: vi.fn(),
  listEntries: vi.fn(),
  listWaiting: vi.fn(),
  markWaitlistAccepted: vi.fn(),
};
vi.mock('@/infrastructure/persistence/repositories/season-plan.repository', () => ({
  SeasonPlanRepository: class {
    constructor() {
      return repo;
    }
  },
}));

const { PATCH, DELETE } = await import('@/app/api/seasons/[id]/plan-entries/[entryId]/route');

const SEASON_ID = 'season-1';
const ENTRY_ID = 'entry-1';

const BASE_ENTRY = {
  id: ENTRY_ID,
  season_id: SEASON_ID,
  club_id: 'club-1',
  trainer_id: 'trainer-1',
  court_id: 'court-1',
  group_id: 'group-1',
  day_of_week: 2,
  start_time: '17:00:00',
  end_time: '18:00:00',
  duration_minutes: 60,
  entry_type: 'training',
  max_participants: 8,
  expected_participants: ['member-1', 'member-2'],
  status: 'draft',
};

function makeParams(id = SEASON_ID, entryId = ENTRY_ID) {
  return { params: Promise.resolve({ id, entryId }) };
}

function patchRequest(body: unknown) {
  return makeApiRequest(`http://localhost/api/seasons/${SEASON_ID}/plan-entries/${ENTRY_ID}`, {
    method: 'PATCH',
    json: body,
  });
}

describe('PATCH /api/seasons/[id]/plan-entries/[entryId]', () => {
  beforeEach(() => {
    supa.reset();
    Object.values(repo).forEach((m) => m.mockReset());
    repo.findSeason.mockResolvedValue({ id: SEASON_ID, club_id: 'club-1' });
    repo.findEntry.mockResolvedValue(BASE_ENTRY);
    repo.findConflicts.mockResolvedValue([]);
    repo.updateEntry.mockResolvedValue({ ...BASE_ENTRY, notes: 'aktualisiert' });
    repo.listEntries.mockResolvedValue([]);
    repo.listWaiting.mockResolvedValue([]);
  });

  it('lehnt Nicht-Admins ab', async () => {
    supa.setRole('trainer', 'club-1');
    const res = await PATCH(patchRequest({ notes: 'x' }), makeParams());
    expect(res.status).toBe(403);
  });

  it('liefert 404, wenn der Plan-Eintrag nicht existiert', async () => {
    supa.setRole('admin', 'club-1');
    repo.findEntry.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ notes: 'x' }), makeParams());
    expect(res.status).toBe(404);
  });

  it('lehnt Zugriff auf einen Plan-Eintrag eines anderen Vereins ab', async () => {
    supa.setRole('admin', 'club-1');
    repo.findSeason.mockResolvedValue({ id: SEASON_ID, club_id: 'club-OTHER' });
    const res = await PATCH(patchRequest({ notes: 'x' }), makeParams());
    expect(res.status).toBe(403);
  });

  it('lehnt einen day_of_week außerhalb 0-6 ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PATCH(patchRequest({ day_of_week: 9 }), makeParams());
    expect(res.status).toBe(400);
  });

  it('lehnt Trainingsstunden an einem Sonntag ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PATCH(patchRequest({ day_of_week: 6 }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(JSON.stringify(body)).toContain('Sonntag');
  });

  it('lehnt einen Request ohne bekannte Felder ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PATCH(patchRequest({ unknownField: 'x' }), makeParams());
    expect(res.status).toBe(400);
  });

  it('lehnt start_time >= end_time ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PATCH(
      patchRequest({ start_time: '19:00:00', end_time: '18:00:00' }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it('liefert 409 bei einem erkannten Terminkonflikt', async () => {
    supa.setRole('admin', 'club-1');
    repo.findConflicts.mockResolvedValue([
      { id: 'other-entry', day_of_week: 2, start_time: '17:00:00', end_time: '18:00:00' },
    ]);
    const res = await PATCH(patchRequest({ trainer_id: 'trainer-2' }), makeParams());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(JSON.stringify(body)).toContain('Terminkonflikt');
  });

  it('aktualisiert einen Plan-Eintrag bei gültiger Anfrage', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PATCH(patchRequest({ notes: 'Neue Notiz' }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.entry.notes).toBe('aktualisiert');
    expect(body.promoted).toEqual([]);
  });

  // Wird die Teilnehmerliste kleiner, rückt die Saison-Warteliste nach —
  // sonst bliebe ein frei gewordener Platz leer, obwohl jemand wartet.
  it('rückt bei kleinerer Teilnehmerliste von der Warteliste nach', async () => {
    supa.setRole('admin', 'club-1');
    repo.updateEntry.mockResolvedValue({ ...BASE_ENTRY, expected_participants: ['member-1'] });
    // Gruppe hat 8 Plätze, 1 belegt → Platz für den Wartenden
    repo.listEntries.mockResolvedValue([{ ...BASE_ENTRY, expected_participants: ['member-1'] }]);
    repo.listWaiting.mockResolvedValue([{ id: 'w1', member_id: 'member-3', position: 1 }]);

    const res = await PATCH(patchRequest({ expected_participants: ['member-1'] }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.promoted).toEqual([{ memberId: 'member-3', position: 1 }]);
    expect(repo.markWaitlistAccepted).toHaveBeenCalledWith('w1');
  });

  it('rückt NICHT nach, wenn die Teilnehmerliste größer wird', async () => {
    supa.setRole('admin', 'club-1');
    repo.updateEntry.mockResolvedValue({
      ...BASE_ENTRY,
      expected_participants: ['member-1', 'member-2', 'member-3'],
    });
    const res = await PATCH(
      patchRequest({ expected_participants: ['member-1', 'member-2', 'member-3'] }),
      makeParams()
    );
    expect(res.status).toBe(200);
    expect(repo.listWaiting).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/seasons/[id]/plan-entries/[entryId]', () => {
  it('lehnt veröffentlichte Einträge ab', async () => {
    supa.setRole('admin', 'club-1');
    repo.findSeason.mockResolvedValue({ id: SEASON_ID, club_id: 'club-1' });
    repo.findEntry.mockResolvedValue({ ...BASE_ENTRY, status: 'published' });
    const res = await DELETE(
      makeApiRequest('http://localhost/x', { method: 'DELETE' }),
      makeParams()
    );
    expect(res.status).toBe(400);
    expect(repo.deleteEntry).not.toHaveBeenCalled();
  });
});

describe('SeasonPlanService.applySlots', () => {
  const slot = (over: Record<string, unknown>) => ({
    id: 'group-1',
    groupName: 'Gruppe A',
    trainerId: 'kein-uuid', // muss ignoriert werden, sonst kippt der FK den Save
    dayOfWeek: 3,
    startTime: '09:30',
    endTime: '10:30',
    durationMin: 60,
    courtId: 'court-1',
    memberIds: ['m1'],
    ...over,
  });

  it('schreibt Zeit als HH:MM:SS, ignoriert Nicht-UUID-Trainer und meldet fehlende Gruppen', async () => {
    supa.setRole('admin', 'club-1');
    repo.findSeason.mockResolvedValue({ id: SEASON_ID, club_id: 'club-1' });
    repo.listEntries.mockResolvedValue([{ id: 'e1', group_id: 'group-1' }]);
    const { SeasonPlanService } = await import('@/application/services/season-plan.service');
    const auth = {
      role: 'admin',
      user: { id: 'user-1' },
      memberships: [{ club_id: 'club-1', role: 'admin' }],
    };

    const result = await new SeasonPlanService(auth as never).applySlots(SEASON_ID, [
      slot({}),
      slot({ id: 'weg', groupName: 'Weg' }),
    ] as never);

    expect(result).toEqual({ applied: 1, missingGroupNames: ['Weg'] });
    const [ids, patch] = repo.updateEntries.mock.calls[0];
    expect(ids).toEqual(['e1']);
    expect(patch).toMatchObject({ start_time: '09:30:00', end_time: '10:30:00', day_of_week: 3 });
    expect(patch).not.toHaveProperty('trainer_id');
  });
});
