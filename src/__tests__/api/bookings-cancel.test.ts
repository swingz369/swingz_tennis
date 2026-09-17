/**
 * Verhaltens-Tests für POST /api/bookings/[id]/cancel — Buchung stornieren.
 * Bisher ungetestet trotz Komplexität 41 (tokensave test_risk, Fund
 * 16.09.2026): Eigentums-Check (nur eigene Buchung oder Admin), Stornofrist,
 * Admin-Override.
 *
 * Nutzt den Harness aus ../helpers/api-route: der ECHTE withApiAuth/
 * verifyRole-Code läuft, nur die Supabase-Antworten sind kontrolliert.
 *
 * '@/lib/supabase/service' wird gemockt (makeFakeSupabaseClient, geteilte
 * Tabellen-/RPC-Antworten mit dem Haupt-Mock, siehe JSDoc in api-route.ts) —
 * die Route ruft createServiceClient() direkt für den Last-Minute-Alert, die
 * Trainer-Benachrichtigung und die Wartelisten-Promotion auf. Alle drei
 * Zweige sind im Route-Code non-fatal (try/catch); mit unregistrierten
 * Tabellen (Default-Handler liefert null) bleiben sie No-ops, ohne den Test
 * zu verfälschen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest, makeFakeSupabaseClient } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.doMock('@/lib/supabase/service', () => ({
  createServiceClient: () => makeFakeSupabaseClient(),
}));

const { POST } = await import('@/app/api/bookings/[id]/cancel/route');

function makeParams(id = 'booking-1') {
  return { params: Promise.resolve({ id }) };
}

function cancelRequest() {
  return makeApiRequest('http://localhost/api/bookings/booking-1/cancel', { method: 'POST' });
}

const baseBooking = {
  id: 'booking-1',
  member_id: 'user-1',
  status: 'confirmed',
  session_start_time: '2099-01-01T10:00:00.000Z', // weit in der Zukunft
  club_id: 'club-1',
  session_id: null,
  schedule_id: null,
  court_id: 'court-1',
};

describe('POST /api/bookings/[id]/cancel', () => {
  beforeEach(() => {
    supa.reset();
  });

  it('lehnt die Stornierung einer fremden Buchung durch ein Mitglied ab', async () => {
    supa.setRole('member', 'club-1');
    supa.table('bookings', () => ({
      data: { ...baseBooking, member_id: 'other-user' },
      error: null,
    }));
    const res = await POST(cancelRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it('liefert 404, wenn die Buchung nicht existiert', async () => {
    supa.setRole('member', 'club-1');
    // 'bookings' bleibt unregistriert -> Default-Handler liefert null.
    const res = await POST(cancelRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it('lehnt die Stornierung einer bereits stornierten Buchung ab', async () => {
    supa.setRole('member', 'club-1');
    supa.table('bookings', () => ({ data: { ...baseBooking, status: 'cancelled' }, error: null }));
    const res = await POST(cancelRequest(), makeParams());
    expect(res.status).toBe(409);
  });

  it('lehnt die Stornierung innerhalb der Stornofrist ab', async () => {
    supa.setRole('member', 'club-1');
    supa.table('bookings', (state) => {
      if (state.op === 'select') {
        return {
          data: {
            ...baseBooking,
            session_start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // in 1h
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    supa.table('booking_rules', () => ({ data: { cancellation_hours_before: 24 }, error: null }));
    const res = await POST(cancelRequest(), makeParams());
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain('Stornierung');
  });

  it('erlaubt einem Admin die Stornierung trotz Stornofrist (Override)', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('bookings', (state) => {
      if (state.op === 'select') {
        return {
          data: {
            ...baseBooking,
            member_id: 'other-user',
            session_start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // in 1h
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    supa.table('booking_rules', () => ({ data: { cancellation_hours_before: 24 }, error: null }));
    const res = await POST(cancelRequest(), makeParams());
    expect(res.status).toBe(200);
  });

  it('storniert die eigene Buchung bei gültiger Anfrage', async () => {
    supa.setRole('member', 'club-1');
    supa.table('bookings', () => ({ data: baseBooking, error: null }));
    const res = await POST(cancelRequest(), makeParams());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.bookingId).toBe('booking-1');
  });
});
