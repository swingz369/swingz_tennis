/**
 * Verhaltens-Tests für POST /api/email-campaigns — Rollen-/Club-Guards und
 * der Kampagnen-Versand-Pfad (Komplexität 42, tokensave test_risk:
 * ungetestet, 16.09.2026).
 *
 * Nutzt den Standard-Harness (installSupabaseMock): der echte withApiAuth/
 * verifyRole-Code läuft, nur DB-Antworten (inkl. createServiceClient, siehe
 * JSDoc in ../helpers/api-route) und der Resend-Versand sind kontrolliert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Der Versandpfad braucht einen API-Key; ohne .env.local (CI) fehlt er.
vi.hoisted(() => {
  process.env.RESEND_API_KEY ??= 'test-resend-key';
});
import { installSupabaseMock, makeApiRequest, makeFakeSupabaseClient } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.doMock('@/lib/supabase/service', () => ({
  createServiceClient: () => makeFakeSupabaseClient(),
}));

const sendMock = vi.fn(async () => ({ data: { id: 'email-1' }, error: null }));
class FakeResend {
  emails = { send: sendMock };
}
vi.doMock('resend', () => ({ Resend: FakeResend }));

const { POST, GET } = await import('@/app/api/email-campaigns/route');

function campaignRequest(body: unknown) {
  return makeApiRequest('http://localhost/api/email-campaigns', { method: 'POST', json: body });
}

describe('POST /api/email-campaigns', () => {
  beforeEach(() => {
    supa.reset();
    sendMock.mockClear();
  });

  it('lehnt Nicht-Admins ab (verifyRole)', async () => {
    supa.setRole('trainer', 'club-1');
    const res = await POST(campaignRequest({ subject: 'Hallo', body: 'Text' }));
    expect(res.status).toBe(403);
  });

  it('lehnt eine Anfrage ohne zugewiesenen Club ab', async () => {
    supa.setRole('admin', null);
    const res = await POST(campaignRequest({ subject: 'Hallo', body: 'Text' }));
    expect(res.status).toBe(400);
  });

  it('lehnt fehlenden Betreff oder Inhalt ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await POST(campaignRequest({ subject: '', body: '' }));
    expect(res.status).toBe(400);
  });

  it('liefert 400, wenn keine Empfänger gefunden werden', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('user_club_memberships', () => ({ data: [], error: null }));
    const res = await POST(
      campaignRequest({ subject: 'Hallo', body: 'Text', targetGroup: 'members' })
    );
    expect(res.status).toBe(400);
  });

  it('versendet die Kampagne an gefundene Empfänger und legt Warteschlange + Kampagne an', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('user_club_memberships', (state) => {
      if (state.op === 'select') {
        return {
          data: [
            {
              user_id: 'user-2',
              role: 'member',
              users: { email: 'member@example.de', full_name: 'Max Mustermann' },
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });
    supa.table('email_campaigns', (state) => {
      if (state.op === 'insert') return { data: { id: 'campaign-1' }, error: null };
      return { data: null, error: null };
    });
    supa.table('email_queue', (state) => {
      if (state.op === 'insert') {
        return { data: [{ id: 'queue-1', recipient_email: 'member@example.de' }], error: null };
      }
      return { data: null, error: null };
    });

    const res = await POST(
      campaignRequest({
        subject: 'Saisonstart',
        body: 'Willkommen zur neuen Saison',
        targetGroup: 'members',
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.sentCount).toBe(1);
    expect(json.failedCount).toBe(0);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/email-campaigns', () => {
  beforeEach(() => {
    supa.reset();
  });

  it('lehnt Nicht-Admins ab', async () => {
    supa.setRole('member', 'club-1');
    const res = await GET(makeApiRequest('http://localhost/api/email-campaigns'));
    expect(res.status).toBe(403);
  });

  it('liefert die Kampagnenliste des Clubs für Admins', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('email_campaigns', () => ({
      data: [{ id: 'campaign-1', subject: 'Saisonstart', status: 'sent' }],
      error: null,
    }));
    const res = await GET(makeApiRequest('http://localhost/api/email-campaigns'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.campaigns).toHaveLength(1);
  });
});
