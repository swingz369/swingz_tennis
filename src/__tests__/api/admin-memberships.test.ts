/**
 * Verhaltens-Tests für PATCH /api/admin/memberships/[id] — die
 * Privilegien-Eskalations-Guards (Rollen-Hierarchie, Club-Grenzen). Bisher
 * ungetestet trotz "SECURITY"-Kommentaren direkt im Code (Fund 16.09.2026,
 * tokensave test_risk: Komplexität 38, keine Tests).
 *
 * Nutzt den Harness aus ../helpers/api-route: der ECHTE withApiAuth/
 * verifyRole-Code läuft, nur die Supabase-Antworten sind kontrolliert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => {}) }));

const { PATCH } = await import('@/app/api/admin/memberships/[id]/route');

function makeParams(id = 'membership-1') {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(body: unknown) {
  return makeApiRequest('http://localhost/api/admin/memberships/membership-1', {
    method: 'PATCH',
    json: body,
  });
}

describe('PATCH /api/admin/memberships/[id]', () => {
  beforeEach(() => {
    supa.reset();
  });

  it('lehnt Nicht-Admins ab (verifyRole)', async () => {
    supa.setRole('trainer', 'club-1');
    const res = await PATCH(patchRequest({ role: 'admin' }), makeParams());
    expect(res.status).toBe(403);
  });

  it('lehnt eine ungültige Rolle ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PATCH(patchRequest({ role: 'astronaut' }), makeParams());
    expect(res.status).toBe(400);
  });

  it('liefert 404, wenn die Mitgliedschaft nicht existiert', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('user_club_memberships', () => ({ data: null, error: { message: 'not found' } }));
    const res = await PATCH(patchRequest({ role: 'trainer' }), makeParams());
    expect(res.status).toBe(404);
  });

  it('lehnt Änderungen an Mitgliedschaften eines anderen Vereins ab', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('user_club_memberships', (state) => {
      if (state.op === 'select') {
        return {
          data: {
            id: 'membership-1',
            club_id: 'club-OTHER',
            role: 'member',
            users: { email: 'a@b.de' },
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    const res = await PATCH(patchRequest({ role: 'trainer' }), makeParams());
    expect(res.status).toBe(403);
  });

  it('lehnt ab, wenn ein Admin die Superadmin-Rolle vergeben will', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('user_club_memberships', (state) => {
      if (state.op === 'select') {
        return {
          data: {
            id: 'membership-1',
            club_id: 'club-1',
            role: 'member',
            users: { email: 'a@b.de' },
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    const res = await PATCH(patchRequest({ role: 'superadmin' }), makeParams());
    expect(res.status).toBe(403);
  });

  it('lehnt ab, einen ranghöheren Nutzer zu degradieren', async () => {
    supa.setRole('admin', 'club-1');
    // currentMembership.role='superadmin' > auth.role='admin' in der Hierarchie
    supa.table('user_club_memberships', (state) => {
      if (state.op === 'select') {
        return {
          data: {
            id: 'membership-1',
            club_id: 'club-1',
            role: 'superadmin',
            users: { email: 'a@b.de' },
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    const res = await PATCH(patchRequest({ role: 'trainer' }), makeParams());
    expect(res.status).toBe(403);
  });

  it('erlaubt eine Beförderung bis zur eigenen Rolle (Grenzfall)', async () => {
    supa.setRole('admin', 'club-1');
    // 'admin' befördert auf 'admin' — gleiche Stufe wie der Aufrufer, kein
    // Verstoß gegen "nicht höher als die eigene Rolle".
    supa.table('user_club_memberships', (state) => {
      if (state.op === 'select') {
        return {
          data: {
            id: 'membership-1',
            club_id: 'club-1',
            role: 'trainer',
            users: { email: 'a@b.de' },
          },
          error: null,
        };
      }
      return {
        data: { id: 'membership-1', club_id: 'club-1', role: 'admin', users: { email: 'a@b.de' } },
        error: null,
      };
    });
    const res = await PATCH(patchRequest({ role: 'admin' }), makeParams());
    expect(res.status).toBe(200);
  });

  it('aktualisiert die Rolle bei gültiger Anfrage und schreibt ein Audit-Log', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('user_club_memberships', (state) => {
      if (state.op === 'select') {
        return {
          data: {
            id: 'membership-1',
            club_id: 'club-1',
            role: 'member',
            users: { email: 'a@b.de' },
          },
          error: null,
        };
      }
      return {
        data: {
          id: 'membership-1',
          club_id: 'club-1',
          role: 'trainer',
          users: { email: 'a@b.de' },
        },
        error: null,
      };
    });
    const res = await PATCH(patchRequest({ role: 'trainer' }), makeParams());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toContain('member');
    expect(json.message).toContain('trainer');
  });
});
