/**
 * Verhaltens-Tests für POST /api/messages — Eingabevalidierung, den
 * Admin-only-Guard für Rundnachrichten (Broadcast), die Club-Auflösung für
 * Broadcasts und die Selbst-Empfänger-Kante bei Mehrfachnachrichten. Bisher
 * ungetestet (Fund 16.09.2026, tokensave test_risk: Komplexität 45, keine
 * Tests).
 *
 * Nutzt den Harness aus ../helpers/api-route: der ECHTE withApiAuth/
 * verifyRole-Code läuft, nur die Supabase-Antworten sind kontrolliert.
 * `createServiceClient()` (für Broadcast/Mehrfachversand) und
 * `pushNotificationService` (VAPID-Push, braucht echte Keys) sind gemockt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest, makeFakeSupabaseClient } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.doMock('@/lib/supabase/service', () => ({
  createServiceClient: () => makeFakeSupabaseClient(),
}));

vi.doMock('@/lib/push-notification.service', () => ({
  pushNotificationService: { sendToUser: vi.fn(async () => {}) },
}));

const { POST } = await import('@/app/api/messages/route');

function postRequest(body: unknown) {
  return makeApiRequest('http://localhost/api/messages', { method: 'POST', json: body });
}

describe('POST /api/messages', () => {
  beforeEach(() => {
    supa.reset();
  });

  it('lehnt eine Anfrage ohne subject/content ab', async () => {
    supa.setRole('member', 'club-1');
    const res = await POST(postRequest({ receiverId: 'user-2', subject: '', content: 'Hallo' }));
    expect(res.status).toBe(400);
  });

  it('lehnt eine Anfrage ohne Empfängerangabe ab', async () => {
    supa.setRole('member', 'club-1');
    const res = await POST(postRequest({ subject: 'Hi', content: 'Hallo' }));
    expect(res.status).toBe(400);
  });

  it('lehnt Rundnachrichten durch Nicht-Admins ab', async () => {
    supa.setRole('member', 'club-1');
    const res = await POST(
      postRequest({ broadcastType: 'all', subject: 'Hi', content: 'Hallo', clubId: 'club-1' })
    );
    expect(res.status).toBe(403);
  });

  it('lehnt eine Rundnachricht ohne auflösbare clubId ab', async () => {
    // superadmin/owner haben laut Harness-Mock immer clubId=null, solange
    // kein Club per Cookie ausgewählt ist.
    supa.setRole('superadmin', null);
    const res = await POST(postRequest({ broadcastType: 'all', subject: 'Hi', content: 'Hallo' }));
    expect(res.status).toBe(400);
  });

  it('liefert ein leeres Ergebnis, wenn bei Mehrfachempfängern nur der Absender übrig bleibt', async () => {
    supa.setRole('member', 'club-1');
    const res = await POST(
      postRequest({ receiverIds: ['user-1'], subject: 'Hi', content: 'Hallo' })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.count).toBe(0);
  });

  it('sendet eine Direktnachricht erfolgreich', async () => {
    supa.setRole('member', 'club-1');
    supa.table('messages', (state) => {
      if (state.op === 'insert') {
        return { data: { id: 'msg-1', ...(state.payload as object) }, error: null };
      }
      return { data: null, error: null };
    });
    const res = await POST(
      postRequest({ receiverId: 'user-2', subject: 'Hi', content: 'Hallo dort' })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.message.id).toBe('msg-1');
    expect(json.count).toBe(1);
  });

  it('sendet eine Rundnachricht an alle aktiven Vereinsmitglieder', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('user_club_memberships', () => ({
      data: [{ user_id: 'user-2' }, { user_id: 'user-3' }],
      error: null,
    }));
    supa.table('messages', (state) => {
      if (state.op === 'insert') {
        return { data: [{ id: 'msg-1', receiver_id: 'user-2' }], error: null };
      }
      return { data: null, error: null };
    });
    const res = await POST(
      postRequest({
        broadcastType: 'all',
        subject: 'Rundmail',
        content: 'An alle',
        clubId: 'club-1',
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.count).toBe(2);
  });
});
