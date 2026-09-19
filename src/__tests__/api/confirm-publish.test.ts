/**
 * Route-Test für POST /api/seasons/[id]/planning/confirm. Termin-Berechnung: publish-plan.test.ts;
 * Atomarität: Datenbankfunktion publish_season_plan (siehe Migration).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ApiException } from '@/lib/api-error';

const mockSeason = vi.fn();
const mockEntries = vi.fn();
const mockPublish = vi.fn();
const mockDetect = vi.fn();
const mockRelease = vi.fn();
const mockRateLimit = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  withApiAuth: (_req: unknown, fn: (a: unknown) => Promise<Response>) =>
    fn({ user: { id: 'u1' }, role: 'admin', memberships: [] }),
}));
vi.mock('@/lib/csrf', () => ({
  withCSRFProtection: (_req: unknown, fn: () => Promise<Response>) => fn(),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitOrFail: (...a: unknown[]) => mockRateLimit(...a),
  releaseRateLimitSlot: (...a: unknown[]) => mockRelease(...a),
}));
vi.mock('@/application/services/season-planning.service', () => ({
  SeasonPlanningService: vi.fn(function (this: Record<string, unknown>) {
    this.season = mockSeason;
    this.planEntries = mockEntries;
    this.publish = mockPublish;
  }),
}));
vi.mock('@/infrastructure/persistence/repositories/conflict-detection.repository', () => ({
  conflictRepositoryFor: () => ({}),
}));
vi.mock('@/lib/season-planning/conflict-detector', () => ({
  detectConflictsForSeason: (...a: unknown[]) => mockDetect(...a),
}));
vi.mock('@/lib/season-planning/season-confirmation-email.service', () => ({
  seasonConfirmationEmailService: { buildRecipients: vi.fn(), sendConfirmationEmails: vi.fn() },
}));
vi.mock('@/lib/env', () => ({ env: { RESEND_API_KEY: undefined } }));

import { POST } from '@/app/api/seasons/[id]/planning/confirm/route';

const call = () =>
  POST(
    new NextRequest('http://localhost/api/seasons/s1/planning/confirm', {
      method: 'POST',
      body: JSON.stringify({ adminNotes: 'x' }),
    }),
    { params: Promise.resolve({ id: 's1' }) }
  );

const published = {
  publishedCount: 2,
  publishedIds: ['a', 'b'],
  bookingsCreated: 4,
  removedSessions: 0,
  isRepublish: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue(null);
  mockSeason.mockResolvedValue({ id: 's1', club_id: 'c1' });
  mockEntries.mockResolvedValue([{ id: 'e1', expected_participants: [] }]);
  mockDetect.mockResolvedValue({ conflicts: [], summary: {} });
  mockPublish.mockResolvedValue(published);
});

describe('POST /api/seasons/[id]/planning/confirm', () => {
  it('veröffentlicht und meldet die Zahlen', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      publishedSessions: 2,
      bookingsCreated: 4,
      republish: false,
    });
    expect(mockPublish).toHaveBeenCalledWith(expect.anything(), expect.anything(), [], 'x');
  });

  it('gibt das Rate-Limit-Ergebnis unverändert zurück', async () => {
    mockRateLimit.mockResolvedValue(new Response('too many', { status: 429 }));
    expect((await call()).status).toBe(429);
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('liefert 400 ohne Planeinträge', async () => {
    mockEntries.mockResolvedValue([]);
    expect((await call()).status).toBe(400);
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('liefert 409 bei offenen kritischen Konflikten und gibt das Kontingent frei', async () => {
    mockDetect.mockResolvedValue({
      conflicts: [{ id: 'k1', type: 't', severity: 'critical', status: 'open', description: 'd' }],
      summary: {},
    });
    const res = await call();
    expect(res.status).toBe(409);
    expect(mockRelease).toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('lässt einen als gelöst markierten kritischen Konflikt durch', async () => {
    mockDetect.mockResolvedValue({
      conflicts: [
        { id: 'k1', type: 't', severity: 'critical', status: 'resolved', description: 'd' },
      ],
      summary: {},
    });
    expect((await call()).status).toBe(200);
  });

  it('übernimmt Fehlerstatus des Service (403) und gibt das Kontingent frei', async () => {
    mockSeason.mockRejectedValue(new ApiException('FORBIDDEN', 'Kein Zugriff auf diese Saison'));
    const res = await call();
    expect(res.status).toBe(403);
    expect(mockRelease).toHaveBeenCalled();
  });

  it('liefert 500 mit verständlichem Text, wenn das Schreiben scheitert', async () => {
    mockPublish.mockRejectedValue(new Error('Veröffentlichen des Plans fehlgeschlagen'));
    const res = await call();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('nicht veröffentlicht');
    expect(mockRelease).toHaveBeenCalled();
  });
});
