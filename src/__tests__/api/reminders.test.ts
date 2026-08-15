/**
 * Unit tests for POST /api/reminders/booking-tomorrow
 *
 * Tests auth gating (admin role), rate limiting, input validation, dry-run
 * mode, the happy path (email + audit + push) and failure paths.
 * Modeled after clubs.test.ts (chain mocks for Supabase, configurable mocks).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ════════════════════════════════════════════════════════════
// TEST CONSTANTS & FIXTURES
// ════════════════════════════════════════════════════════════

const USER_ID = 'user-admin-001';

const SESSION = {
  id: 'session-001',
  timeslot_start: '2026-08-14T17:00:00.000Z',
  timeslot_end: '2026-08-14T18:30:00.000Z',
  trainer_id: 'trainer-001',
  court_id: 'court-001',
  trainers: [{ name: 'Coach Müller', email: 'coach@test.com' }],
  courts: [{ name: 'Platz 1' }],
  clubs: [{ name: 'TC Test' }],
};

const BOOKING = {
  id: 'booking-001',
  member_id: 'member-001',
  session_id: 'session-001',
  status: 'confirmed',
};

const MEMBER = { id: 'member-001', email: 'max@test.com', full_name: 'Max Mustermann' };

// ════════════════════════════════════════════════════════════
// MOCK STATE
// ════════════════════════════════════════════════════════════

let mockVerifyRole: any;
const mockSupabase = { from: vi.fn() };

const mockAuthCtx = {
  user: { id: USER_ID, email: 'admin@test.com' },
  role: 'admin',
  clubId: 'club-001',
  memberships: [{ club_id: 'club-001' }],
};

const mockCheckRateLimit = vi.fn().mockResolvedValue(null);
const mockSendEmail = vi.fn().mockResolvedValue(undefined);
const mockAuditLog = vi.fn().mockResolvedValue(undefined);
const mockPushSend = vi.fn().mockResolvedValue({ success: true, sent: 1, failed: 0, cleanedUp: 0 });

// ── Module mocks ────────────────────────────────────────────

vi.mock('@/infrastructure/external/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

// Hinweis: Der 401-Pfad (nicht eingeloggt) lebt in withApiAuth selbst und ist
// auf Route-Ebene bewusst nicht abgedeckt — wie in clubs.test.ts. Hier wird
// nur das Verhalten NACH erfolgreichem Auth-Handshake geprüft.
vi.mock('@/lib/api-auth', () => ({
  withApiAuth: vi.fn((_req: unknown, fn: (auth: unknown) => Promise<Response>) => fn(mockAuthCtx)),
  verifyRole: (...args: unknown[]) => mockVerifyRole(...args),
  forbiddenResponse: (msg?: string) =>
    new Response(JSON.stringify({ error: msg || 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitOrFail: (...args: unknown[]) => mockCheckRateLimit(...args),
  RATE_LIMITS: { STRICT: { max: 5, windowMs: 15 * 60 * 1000 } },
}));

// Real EmailService would silently no-op without RESEND_API_KEY — mock it so we
// can assert that dry-run really skips sending and the happy path really sends.
vi.mock('@/infrastructure/email/email.service', () => ({
  EmailService: class {
    sendBookingReminder = (...args: unknown[]) => mockSendEmail(...args);
  },
}));

// Real AuditServiceImpl writes through Drizzle to a DB — not available here.
vi.mock('@/infrastructure/audit/audit.service', () => ({
  AuditServiceImpl: class {
    log = (...args: unknown[]) => mockAuditLog(...args);
  },
}));

// Push notifications are fire-and-forget in the route; mocking keeps the test
// deterministic and lets us assert the payload.
vi.mock('@/lib/push-notification.service', () => ({
  pushNotificationService: { sendToUser: (...args: unknown[]) => mockPushSend(...args) },
}));

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

/**
 * Chainable Supabase-Query-Mock für die drei Temp*-Repositories der Route:
 * - sessions:  from('sessions').select().gte().lte()      → await (thenable)
 * - bookings:  from('bookings').select().in().eq()        → await (thenable)
 * - users:     from('users').select().eq().single()       → single()
 */
function makeChain(result: { data?: unknown; error?: { message: string } | null }) {
  const { data = [], error = null } = result;
  const chain: Record<string, any> = {
    select: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => ({ data, error })),
    then: (resolve: (v: unknown) => void) => {
      resolve({ data, error });
      return chain;
    },
  };
  return chain;
}

function buildRequest(body: unknown = {}) {
  return new NextRequest('http://localhost/api/reminders/booking-tomorrow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════

describe('POST /api/reminders/booking-tomorrow', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/reminders/booking-tomorrow/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRole = vi.fn().mockResolvedValue(true);
    mockCheckRateLimit.mockResolvedValue(null);
    mockSendEmail.mockResolvedValue(undefined);
    mockAuditLog.mockResolvedValue(undefined);
    mockPushSend.mockResolvedValue({ success: true, sent: 1, failed: 0, cleanedUp: 0 });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') return makeChain({ data: [SESSION] });
      if (table === 'bookings') return makeChain({ data: [BOOKING] });
      if (table === 'users') return makeChain({ data: MEMBER });
      return makeChain({});
    });
  });

  // ── Auth & Rate Limit ──────────────────────────────────

  it('returns 403 when the user is not an admin', async () => {
    mockVerifyRole.mockResolvedValueOnce(false);

    const res = await POST(buildRequest());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Zugriff nur für Admins');
    // verifyRole muss wirklich mit der Rolle 'admin' befragt werden
    expect(mockVerifyRole).toHaveBeenCalledWith(mockAuthCtx, 'admin');
  });

  it('returns 429 when the strict rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValueOnce(
      new NextResponse(JSON.stringify({ error: 'Too many requests' }), { status: 429 })
    );

    const res = await POST(buildRequest());

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('Too many requests');
  });

  // ── Input validation ───────────────────────────────────

  it('returns 500 when the body is invalid', async () => {
    const res = await POST(buildRequest({ dryRun: 'not-a-boolean' }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('dryRun');
  });

  // ── Dry run ────────────────────────────────────────────

  it('does not send emails, audit entries or push notifications in dry-run mode', async () => {
    const res = await POST(buildRequest({ dryRun: true }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.dryRun).toBe(true);
    expect(body.total).toBe(1);
    expect(body.sent).toBe(0);
    expect(body.failed).toBe(0);
    expect(body.results[0].status).toBe('skipped');

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
    expect(mockPushSend).not.toHaveBeenCalled();
  });

  // ── Happy path ─────────────────────────────────────────

  it('sends reminder emails, writes an audit log and triggers push for confirmed bookings', async () => {
    const res = await POST(buildRequest({ dryRun: false }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.dryRun).toBe(false);
    expect(body.total).toBe(1);
    expect(body.sent).toBe(1);
    expect(body.failed).toBe(0);
    expect(body.results[0].status).toBe('sent');

    // E-Mail mit Mitgliedsadresse und Termin-/Kontext-Daten
    expect(mockSendEmail).toHaveBeenCalledWith(
      'max@test.com',
      expect.objectContaining({
        memberName: 'Max Mustermann',
        sessionDate: expect.any(String),
        sessionTime: expect.any(String),
        courtName: 'Platz 1',
        clubName: 'TC Test',
      })
    );

    // Audit-Eintrag je Booking
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'booking',
        entityId: 'booking-001',
        details: expect.objectContaining({ type: 'booking_reminder' }),
      })
    );

    // Push für jedes erfolgreich erinnerte Mitglied
    expect(mockPushSend).toHaveBeenCalledWith(
      'member-001',
      expect.objectContaining({
        title: 'Training morgen',
        url: '/bookings',
        tag: 'reminder-session-001',
      })
    );
  });

  // ── Edge cases ─────────────────────────────────────────

  it('returns 500 when the session query fails (DB errors are not swallowed)', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') return makeChain({ error: { message: 'connection refused' } });
      return makeChain({});
    });

    const res = await POST(buildRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Failed to load sessions');
  });

  it('does not send any reminder when no sessions exist for tomorrow', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') return makeChain({ data: [] });
      return makeChain({});
    });

    const res = await POST(buildRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(0);
    expect(body.sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('marks a booking as failed when the member cannot be found', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') return makeChain({ data: [SESSION] });
      if (table === 'bookings') return makeChain({ data: [BOOKING] });
      if (table === 'users') return makeChain({ data: null });
      return makeChain({});
    });

    const res = await POST(buildRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.sent).toBe(0);
    expect(body.results[0].status).toBe('failed');
    expect(body.results[0].error).toBe('Member not found');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
