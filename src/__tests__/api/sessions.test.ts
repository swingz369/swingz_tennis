/**
 * Verhaltens-Tests für GET /api/sessions — Eingabevalidierung (clubId),
 * den Familien-Guard für `actingAsMemberId` und die Datenschutz-Regel für
 * Buchenden-Klarnamen ("nur Admin, oder Trainer für eigene Sessions", siehe
 * Kommentar im Handler). Bisher ungetestet (Fund 16.09.2026, tokensave
 * test_risk: Komplexität 33, keine Tests).
 *
 * Nutzt den Harness aus ../helpers/api-route: der ECHTE withApiAuth/
 * verifyRole-Code läuft, nur die Supabase-Antworten sind kontrolliert.
 * `createServiceClient()` wird gemockt (Trainer-/Nutzer-Namen, Buchungen,
 * Familien-Lookup laufen alle darüber, da RLS die anon-scoped Abfrage sonst
 * blockiert) — Registrierungen teilen sich den Zustand mit `auth.supabase`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest, makeFakeSupabaseClient } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.doMock('@/lib/rate-limit', () => ({
  checkRateLimitOrFail: vi.fn(async () => null),
  RATE_LIMITS: { STANDARD: {}, STRICT: {}, BOOKING: {}, SEARCH: {}, UPLOAD: {}, AUTH: {} },
}));

vi.doMock('@/lib/supabase/service', () => ({
  createServiceClient: () => makeFakeSupabaseClient(),
}));

const { GET } = await import('@/app/api/sessions/route');

function sessionsRequest(query: string) {
  return makeApiRequest(`http://localhost/api/sessions${query}`, { method: 'GET' });
}

const baseSession = {
  id: 'session-1',
  timeslot_start: '2026-09-20T10:00:00.000Z',
  timeslot_end: '2026-09-20T11:00:00.000Z',
  max_participants: 4,
  trainer_id: 'trainer-1',
  court_id: 'court-1',
  week_number: 1,
  session_type: 'training',
  notes: null,
  cancelled_at: null,
  cancellation_reason: null,
  plan_entry_id: null,
  schedules: { club_id: 'club-1' },
  courts: { name: 'Platz 1' },
};

function registerHappyPathTables(bookerMemberId: string) {
  supa.table('sessions', () => ({ data: [baseSession], error: null }));
  supa.table('trainers', () => ({
    data: [{ id: 'trainer-1', name: 'Trainer Eins', email: 't@example.de' }],
    error: null,
  }));
  supa.table('users', () => ({
    data: [{ id: 'trainer-1', full_name: 'Trainer Eins' }],
    error: null,
  }));
  supa.table('bookings', () => ({
    data: [
      {
        id: 'booking-1',
        session_id: 'session-1',
        status: 'confirmed',
        member_id: bookerMemberId,
        users: { full_name: 'Max Mitglied' },
      },
    ],
    error: null,
  }));
  supa.table('session_rsvps', () => ({ data: [], error: null }));
}

describe('GET /api/sessions', () => {
  beforeEach(() => {
    supa.reset();
  });

  it('lehnt eine Anfrage ohne clubId ab', async () => {
    supa.setRole('member', 'club-1');
    const res = await GET(sessionsRequest(''));
    expect(res.status).toBe(400);
  });

  it('lehnt actingAsMemberId ohne Familienberechtigung ab', async () => {
    supa.setRole('member', 'club-1');
    const res = await GET(sessionsRequest('?clubId=club-1&actingAsMemberId=other-user'));
    expect(res.status).toBe(403);
  });

  it('verbirgt die Namen der Buchenden für einfache Mitglieder (Datenschutz)', async () => {
    supa.setRole('member', 'club-1');
    registerHappyPathTables('user-99');
    const res = await GET(sessionsRequest('?clubId=club-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json[0].currentBookings).toBe(1);
    expect(json[0].hasActiveBooking).toBe(true);
    expect(json[0].bookerNames).toEqual([]);
  });

  it('zeigt die Namen der Buchenden für Admins', async () => {
    supa.setRole('admin', 'club-1');
    registerHappyPathTables('user-99');
    const res = await GET(sessionsRequest('?clubId=club-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json[0].bookerNames).toEqual(['Max Mitglied']);
  });
});
