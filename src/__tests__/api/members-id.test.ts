/**
 * Verhaltens-Tests für PATCH /api/members/[id] — Rollen-Gate (Trainer/Admin),
 * Eingabevalidierung und den Admin-only-Guard für E-Mail-Änderungen (E-Mail
 * betrifft den Auth-Login, siehe Kommentar im Handler). Bisher ungetestet
 * (Fund 16.09.2026, tokensave test_risk: Komplexität 43, keine Tests).
 *
 * Nutzt den Harness aus ../helpers/api-route: der ECHTE withApiAuth/
 * verifyRole-Code läuft, nur die Supabase-Antworten sind kontrolliert.
 * `memberService` (In-Memory/DB-Adapter) und der modul-weite Service-Client
 * (`serviceClient = createServiceClient()` auf Top-Level des Routen-Moduls)
 * werden gemockt, weil sie außerhalb des Harness-Scopes liegen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.doMock('@/lib/audit', () => ({ logAudit: vi.fn(async () => {}) }));

vi.doMock('@/lib/rate-limit', () => ({
  checkRateLimitOrFail: vi.fn(async () => null),
  RATE_LIMITS: { STANDARD: {}, STRICT: {}, BOOKING: {}, SEARCH: {}, UPLOAD: {}, AUTH: {} },
}));

// serviceClient = createServiceClient() läuft am Modul-Top-Level der Route —
// muss VOR dem dynamischen Import stehen, damit der Mock beim Erstauswerten greift.
const fakeServiceClient = {
  auth: { admin: { updateUserById: vi.fn(async () => ({ error: null })) } },
  from: vi.fn(() => ({
    update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
  })),
};
vi.doMock('@/lib/supabase/service', () => ({ createServiceClient: () => fakeServiceClient }));

const updateMemberMock = vi.fn();
vi.doMock('@/src/application/services/member-service.adapter', () => ({
  memberService: {
    updateMember: updateMemberMock,
    getMemberById: vi.fn(),
  },
}));

const { PATCH } = await import('@/app/api/members/[id]/route');

function makeParams(id = 'membership-1') {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(body: unknown) {
  return makeApiRequest('http://localhost/api/members/membership-1', {
    method: 'PATCH',
    json: body,
  });
}

describe('PATCH /api/members/[id]', () => {
  beforeEach(() => {
    supa.reset();
    updateMemberMock.mockReset();
    fakeServiceClient.auth.admin.updateUserById.mockClear();
    supa.table('user_club_memberships', () => ({ data: { user_id: 'user-42' }, error: null }));
  });

  it('lehnt Zugriff ohne Trainer-/Admin-Rolle ab', async () => {
    supa.setRole('member', 'club-1');
    const res = await PATCH(patchRequest({ firstName: 'Neu' }), makeParams());
    expect(res.status).toBe(403);
  });

  it('lehnt ein ungültiges Beitrittsdatum ab', async () => {
    supa.setRole('trainer', 'club-1');
    const res = await PATCH(patchRequest({ joinedAt: 'not-a-date' }), makeParams());
    expect(res.status).toBe(400);
    expect(updateMemberMock).not.toHaveBeenCalled();
  });

  it('liefert 404, wenn das Mitglied nicht existiert', async () => {
    supa.setRole('trainer', 'club-1');
    updateMemberMock.mockResolvedValueOnce(null);
    const res = await PATCH(patchRequest({ firstName: 'Neu' }), makeParams());
    expect(res.status).toBe(404);
  });

  it('lehnt eine E-Mail-Änderung durch einen Trainer ab (nur Admins)', async () => {
    supa.setRole('trainer', 'club-1');
    updateMemberMock.mockResolvedValueOnce({ id: 'membership-1' });
    const res = await PATCH(patchRequest({ email: 'neu@example.de' }), makeParams());
    expect(res.status).toBe(403);
    expect(fakeServiceClient.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it('lehnt eine ungültige E-Mail-Adresse ab', async () => {
    supa.setRole('admin', 'club-1');
    updateMemberMock.mockResolvedValueOnce({ id: 'membership-1' });
    const res = await PATCH(patchRequest({ email: 'ungueltig' }), makeParams());
    expect(res.status).toBe(400);
  });

  it('aktualisiert ein Mitglied bei gültiger Anfrage und ändert die Auth-E-Mail', async () => {
    supa.setRole('admin', 'club-1');
    updateMemberMock.mockResolvedValueOnce({ id: 'membership-1', firstName: 'Neu' });
    const res = await PATCH(
      patchRequest({ firstName: 'Neu', email: 'neu@example.de', is_active: true }),
      makeParams()
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(fakeServiceClient.auth.admin.updateUserById).toHaveBeenCalledWith('user-42', {
      email: 'neu@example.de',
    });
  });
});
