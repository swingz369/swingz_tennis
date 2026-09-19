/**
 * GET /api/members — Rollen-Gate. Die Liste enthält E-Mail, Telefon, Adresse und Geburtsdatum
 * aller Vereinsmitglieder; ein einfaches Mitglied darf sie nicht abrufen (Fund 19.09.2026,
 * Rollentest). Namenslisten für Auswahlfelder liefert /api/members/directory.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.doMock('@/lib/rate-limit', () => ({
  checkRateLimitOrFail: vi.fn(async () => null),
  RATE_LIMITS: { STANDARD: {}, STRICT: {}, BOOKING: {}, SEARCH: {}, UPLOAD: {}, AUTH: {} },
}));

const queryMembers = vi.fn(async () => [{ id: 'm1' }]);
vi.doMock('@/src/application/services/member-service.adapter', () => ({
  memberService: { queryMembers },
}));

const { GET } = await import('@/app/api/members/route');

const listRequest = () => makeApiRequest('http://localhost/api/members?active=true');

describe('GET /api/members', () => {
  beforeEach(() => {
    supa.reset();
    queryMembers.mockClear();
  });

  it('lehnt ein einfaches Mitglied ab, ohne Daten zu lesen', async () => {
    supa.setRole('member', 'club-1');
    const res = await GET(listRequest());
    expect(res.status).toBe(403);
    expect(queryMembers).not.toHaveBeenCalled();
  });

  it.each(['trainer', 'admin'] as const)('erlaubt %s', async (role) => {
    supa.setRole(role, 'club-1');
    const res = await GET(listRequest());
    expect(res.status).toBe(200);
    expect(queryMembers).toHaveBeenCalled();
  });
});
