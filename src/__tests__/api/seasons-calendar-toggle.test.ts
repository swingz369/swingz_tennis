/**
 * Verhaltens-Tests für POST/PATCH /api/seasons/[id]/calendar/toggle —
 * bisher ungetestet trotz Komplexität 29 (Fund 16.09.2026, tokensave
 * test_risk). Der Route-Kommentar dokumentiert einen bereits behobenen Bug
 * (fehlendes `await` vor `verifyRole()` hebelte den Rollen-Guard für jeden
 * angemeldeten Nutzer aus) — der erste Testfall ist die Regressionsprobe
 * dafür.
 *
 * Anders als die Confirm-/Plan-Entries-Routen läuft diese Route komplett
 * über `auth.supabase` (via `@/lib/season-planning/season-calendar.service`,
 * ungemockt) — der Harness aus ../helpers/api-route deckt sie deshalb ohne
 * zusätzlichen Drizzle-Mock vollständig ab.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitOrFail: vi.fn(async () => null),
  RATE_LIMITS: { STANDARD: { max: 100, windowMs: 60000, message: 'Zu viele Anfragen.' } },
}));

const { POST } = await import('@/app/api/seasons/[id]/calendar/toggle/route');

const SEASON_ID = 'season-1';
const MONDAY_1 = '2024-01-01'; // bestätigter Montag
const MONDAY_2 = '2024-01-08';
const TUESDAY = '2024-01-02';

function ctx(id = SEASON_ID) {
  return { params: Promise.resolve({ id }) };
}

function postRequest(body: unknown) {
  return makeApiRequest(`http://localhost/api/seasons/${SEASON_ID}/calendar/toggle`, {
    method: 'POST',
    json: body,
  });
}

describe('POST /api/seasons/[id]/calendar/toggle', () => {
  beforeEach(() => {
    supa.reset();
  });

  it('lehnt Nicht-Admins ab (Regression: verifyRole() muss awaited werden)', async () => {
    supa.setRole('trainer', 'club-1');
    const res = await POST(
      postRequest({ group_id: 'group-1', week_monday: MONDAY_1, is_active: false }),
      ctx()
    );
    expect(res.status).toBe(403);
  });

  it('lehnt ungültiges JSON ab', async () => {
    supa.setRole('admin', 'club-1');
    const req = makeApiRequest(`http://localhost/api/seasons/${SEASON_ID}/calendar/toggle`, {
      method: 'POST',
      body: 'not-json',
    });
    const res = await POST(req, ctx());
    expect(res.status).toBe(400);
  });

  it('lehnt einen Request ohne group_id ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await POST(postRequest({ week_monday: MONDAY_1, is_active: true }), ctx());
    expect(res.status).toBe(400);
  });

  it('lehnt einen Request ohne boolesches is_active ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await POST(
      postRequest({ group_id: 'group-1', week_monday: MONDAY_1, is_active: 'yes' }),
      ctx()
    );
    expect(res.status).toBe(400);
  });

  it('lehnt ab, wenn dem Nutzer kein Verein zugeordnet ist', async () => {
    supa.setRole('admin', null);
    const res = await POST(
      postRequest({ group_id: 'group-1', week_monday: MONDAY_1, is_active: true }),
      ctx()
    );
    expect(res.status).toBe(400);
  });

  it('lehnt ein week_monday ab, das kein Montag ist', async () => {
    supa.setRole('admin', 'club-1');
    const res = await POST(
      postRequest({ group_id: 'group-1', week_monday: TUESDAY, is_active: true }),
      ctx()
    );
    expect(res.status).toBe(400);
  });

  it('legt eine neue Wochenstatus-Zeile an, wenn keine existiert', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('season_group_weeks', (state) => {
      if (state.op === 'select') return { data: null, error: null }; // maybeSingle: keine bestehende Zeile
      return { data: null, error: null }; // insert: kein Fehler
    });
    const res = await POST(
      postRequest({
        group_id: 'group-1',
        week_monday: MONDAY_1,
        is_active: false,
        reason: 'Hallensperrung',
      }),
      ctx()
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.created).toBe(true);
  });

  it('aktualisiert eine bestehende Wochenstatus-Zeile', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('season_group_weeks', (state) => {
      if (state.op === 'select') return { data: { id: 'row-1' }, error: null };
      return { data: null, error: null }; // update: kein Fehler
    });
    const res = await POST(
      postRequest({ group_id: 'group-1', week_monday: MONDAY_1, is_active: true }),
      ctx()
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.created).toBe(false);
  });

  it('lehnt einen Bulk-Request ohne gültige week_mondays ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await POST(
      postRequest({ group_id: 'group-1', week_mondays: [TUESDAY, 'garbage'], is_active: true }),
      ctx()
    );
    expect(res.status).toBe(400);
  });

  it('togglet mehrere Wochen im Bulk-Modus', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('season_group_weeks', () => ({ data: null, error: null }));
    const res = await POST(
      postRequest({ group_id: 'group-1', week_mondays: [MONDAY_1, MONDAY_2], is_active: false }),
      ctx()
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.affected).toBe(2);
  });

  // Der Service fängt den Upsert-Fehler selbst ab und liefert {ok:false},
  // die Route antwortet dabei weiterhin mit HTTP 200 — sie mappt das Service-
  // Ergebnis nicht auf einen Fehlerstatus. Festgehalten als IST-Verhalten,
  // nicht als Soll (außerhalb des Testauftrags für diese Datei).
  it('gibt bei einem Upsert-Fehler im Bulk-Modus ok:false zurück (HTTP bleibt 200)', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('season_group_weeks', () => ({
      data: null,
      error: { message: 'constraint violation' },
    }));
    const res = await POST(
      postRequest({ group_id: 'group-1', week_mondays: [MONDAY_1], is_active: true }),
      ctx()
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.affected).toBe(0);
  });
});
