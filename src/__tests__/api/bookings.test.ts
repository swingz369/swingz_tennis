/**
 * Verhaltens-Tests für POST /api/bookings — Buchung erstellen. Bisher
 * ungetestet trotz Komplexität 39 und hoher Änderungsfrequenz (tokensave
 * test_risk, Fund 16.09.2026).
 *
 * Nutzt den Harness aus ../helpers/api-route: der ECHTE withApiAuth/
 * verifyRole-Code läuft, nur die Supabase-Antworten sind kontrolliert.
 *
 * Zwei Seiteneffekt-Module werden gemockt (nicht Teil der zu testenden
 * Business-Logik dieser Route):
 * - '@/lib/supabase/service': createBookingSafe (lib/booking/safe-booking.ts)
 *   und resolveEffectiveMemberId (lib/family/family-auth.ts) rufen beide
 *   createServiceClient() auf — geteilte Tabellen-/RPC-Antworten mit dem
 *   Haupt-Mock über makeFakeSupabaseClient() (siehe JSDoc in api-route.ts).
 * - Der Drizzle-Preisrepository-Zugriff (echte Postgres-Verbindung, kein
 *   Supabase) wird gemockt — die Preisermittlung ist ohnehin non-blocking
 *   (try/catch) und nicht Ziel dieses Tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest, makeFakeSupabaseClient } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.doMock('@/lib/supabase/service', () => ({
  createServiceClient: () => makeFakeSupabaseClient(),
}));

vi.doMock('@/application/services/pricing-rule.service', () => ({
  // `new PricingRuleService()` braucht eine echte (nicht-Arrow-) Funktion,
  // damit sie als Konstruktor aufrufbar ist.
  PricingRuleService: function PricingRuleService() {
    return {
      calculatePrice: vi.fn(async () => ({ pricePerHour: 20, multiplier: 1, source: 'default' })),
    };
  },
}));

const { POST } = await import('@/app/api/bookings/route');

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const CLUB_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_MEMBER_ID = '33333333-3333-3333-3333-333333333333';

function bookingRequest(body: unknown) {
  return makeApiRequest('http://localhost/api/bookings', { method: 'POST', json: body });
}

const validSession = {
  id: SESSION_ID,
  timeslot_start: '2026-09-20T10:00:00.000Z', // Sonntag
  timeslot_end: '2026-09-20T11:00:00.000Z',
  max_participants: 4,
  court_id: null,
  schedule_id: 'schedule-1',
};

describe('POST /api/bookings', () => {
  beforeEach(() => {
    supa.reset();
    process.env.DISABLE_RATE_LIMITING = 'true';
  });

  it('lehnt ungültige Eingaben ab (fehlende Pflichtfelder)', async () => {
    supa.setRole('member', 'club-1');
    const res = await POST(bookingRequest({ sessionId: 'not-a-uuid' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('lehnt Buchungen für ein fremdes Mitglied ohne Familienbeziehung ab (IDOR-Schutz)', async () => {
    supa.setRole('member', 'club-1');
    // Ohne registrierten family_accounts-Eintrag liefert der Default-Handler
    // null -> keine Familiengruppe -> resolveEffectiveMemberId lehnt ab.
    const res = await POST(
      bookingRequest({ sessionId: SESSION_ID, clubId: CLUB_ID, memberId: OTHER_MEMBER_ID })
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Familienberechtigung');
  });

  it('liefert 404, wenn die Session nicht existiert', async () => {
    supa.setRole('member', 'club-1');
    // 'sessions' bleibt unregistriert -> Default-Handler liefert null.
    const res = await POST(bookingRequest({ sessionId: SESSION_ID, clubId: CLUB_ID }));
    expect(res.status).toBe(404);
  });

  it('sperrt Buchungen an einem geschlossenen Tag', async () => {
    supa.setRole('member', 'club-1');
    supa.table('sessions', () => ({ data: validSession, error: null }));
    supa.table('clubs', () => ({
      data: { opening_hours: { sunday: { closed: true } } },
      error: null,
    }));
    const res = await POST(bookingRequest({ sessionId: SESSION_ID, clubId: CLUB_ID }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain('geschlossen');
  });

  it('meldet einen Konflikt, wenn die Session bereits voll ist', async () => {
    supa.setRole('member', 'club-1');
    supa.table('sessions', () => ({ data: validSession, error: null }));
    supa.rpc('create_booking_safe', () => ({
      data: null,
      error: { message: 'Session is already fully booked' },
    }));
    const res = await POST(bookingRequest({ sessionId: SESSION_ID, clubId: CLUB_ID }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe('CONFLICT');
  });

  it('erstellt eine Buchung bei gültiger Anfrage (eigenes Mitglied)', async () => {
    supa.setRole('member', 'club-1');
    supa.table('sessions', () => ({ data: validSession, error: null }));
    supa.rpc('create_booking_safe', () => ({ data: 'booking-1', error: null }));
    const res = await POST(bookingRequest({ sessionId: SESSION_ID, clubId: CLUB_ID }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.bookingId).toBe('booking-1');
    expect(json.status).toBe('confirmed');
  });
});
