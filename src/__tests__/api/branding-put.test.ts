/**
 * Verhaltens-Tests für PUT /api/branding über den echten withApiAuth/
 * verifyRole/verifyClubAccess-Pfad. Ergänzt die bestehenden Allowlist-
 * Regressionstests in `branding.test.ts` (die `withApiAuth` komplett
 * stubben und daher Rollen-/Club-Zugriffsprüfung NICHT mit abdecken) um
 * genau diese Verzweigungen. Bisher ungetestet über den echten Auth-Pfad
 * (Fund 16.09.2026, tokensave test_risk: Komplexität 35).
 *
 * Nutzt den Harness aus ../helpers/api-route: der ECHTE withApiAuth/
 * verifyRole/verifyClubAccess-Code läuft, nur die Supabase-Antworten sind
 * kontrolliert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.doMock('@/lib/rate-limit', () => ({
  checkRateLimitOrFail: vi.fn(async () => null),
  RATE_LIMITS: { STANDARD: {}, STRICT: {}, BOOKING: {}, SEARCH: {}, UPLOAD: {}, AUTH: {} },
}));

const { PUT } = await import('@/app/api/branding/route');

function putRequest(body: unknown, headers?: Record<string, string>) {
  return makeApiRequest('http://localhost/api/branding', { method: 'PUT', json: body, headers });
}

describe('PUT /api/branding', () => {
  beforeEach(() => {
    supa.reset();
  });

  it('lehnt Nicht-Admins ab', async () => {
    supa.setRole('trainer', 'club-1');
    const res = await PUT(
      putRequest({ brand: { primaryColor: '#112233' } }, { 'x-club-id': 'club-1' })
    );
    expect(res.status).toBe(403);
  });

  it('lehnt Anfragen ohne Club-ID-Header ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PUT(putRequest({ brand: { primaryColor: '#112233' } }));
    expect(res.status).toBe(400);
  });

  it('lehnt ungültige Hex-Farben ab (Zod-Validierung)', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PUT(
      putRequest({ brand: { primaryColor: 'not-a-color' } }, { 'x-club-id': 'club-1' })
    );
    expect(res.status).toBe(400);
  });

  it('lehnt ein Update ohne Felder ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PUT(putRequest({}, { 'x-club-id': 'club-1' }));
    expect(res.status).toBe(400);
  });

  it('lehnt den Zugriff auf einen fremden Verein ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PUT(
      putRequest({ brand: { primaryColor: '#112233' } }, { 'x-club-id': 'club-OTHER' })
    );
    expect(res.status).toBe(403);
  });

  it('aktualisiert das Branding bei gültiger Anfrage', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PUT(
      putRequest(
        { brand: { primaryColor: '#112233' }, customDomain: null },
        { 'x-club-id': 'club-1' }
      )
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
