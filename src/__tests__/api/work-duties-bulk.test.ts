/**
 * Verhaltens-Tests für POST /api/work-duties/bulk — Dienste aus einer
 * Vorlage über einen Datumsbereich anlegen. Bisher ungetestet trotz
 * Komplexität 47 (tokensave test_risk, Fund 16.09.2026): Datumsgenerierung
 * je nach Wiederholungsmuster, Validierung, Fehlerpfad beim Insert.
 *
 * Nutzt den Harness aus ../helpers/api-route: der ECHTE withApiAuth/
 * verifyRole-Code läuft, nur die Supabase-Antworten sind kontrolliert.
 *
 * '@/lib/csrf' wird gemockt — die Route wrappt mit withCSRFProtection,
 * das echte Double-Submit-Cookie-Verfahren ist nicht Teil der hier zu
 * testenden Business-Logik (Rollen-Check, Validierung, Datumsgenerierung).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.doMock('@/lib/csrf', () => ({
  withCSRFProtection: (_req: unknown, handler: () => Promise<Response>) => handler(),
}));

const { POST } = await import('@/app/api/work-duties/bulk/route');

function bulkRequest(body: unknown) {
  return makeApiRequest('http://localhost/api/work-duties/bulk', { method: 'POST', json: body });
}

const validTemplate = { title: 'Platzpflege', duty_type: 'court_maintenance' };

describe('POST /api/work-duties/bulk', () => {
  beforeEach(() => {
    supa.reset();
    process.env.DISABLE_RATE_LIMITING = 'true';
  });

  it('lehnt Nicht-Admins ab', async () => {
    supa.setRole('trainer', 'club-1');
    const res = await POST(
      bulkRequest({
        template: validTemplate,
        start_date: '2026-10-01',
        end_date: '2026-10-03',
        recurrence: 'daily',
      })
    );
    expect(res.status).toBe(403);
  });

  it('lehnt Anfragen ohne zugeordneten Verein ab (Superadmin ohne gewählten Club)', async () => {
    supa.setRole('superadmin', null);
    const res = await POST(
      bulkRequest({
        template: validTemplate,
        start_date: '2026-10-01',
        end_date: '2026-10-03',
        recurrence: 'daily',
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Verein');
  });

  it('lehnt eine Vorlage ohne Titel ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await POST(
      bulkRequest({
        template: { duty_type: 'court_maintenance' },
        start_date: '2026-10-01',
        end_date: '2026-10-03',
        recurrence: 'daily',
      })
    );
    expect(res.status).toBe(400);
  });

  it('lehnt start_date nach end_date ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await POST(
      bulkRequest({
        template: validTemplate,
        start_date: '2026-10-10',
        end_date: '2026-10-01',
        recurrence: 'daily',
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('start_date');
  });

  it('lehnt Wochentags-Wiederholung ohne weekdays-Array ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await POST(
      bulkRequest({
        template: validTemplate,
        start_date: '2026-10-01',
        end_date: '2026-10-14',
        recurrence: 'weekdays',
      })
    );
    expect(res.status).toBe(400);
  });

  it('generiert nur die passenden Wochentage und überspringt exclude_dates', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('work_duties', (state) => {
      const rows = state.payload as Array<{ scheduled_date: string }>;
      return {
        data: rows.map((r, i) => ({ id: `duty-${i}`, scheduled_date: r.scheduled_date })),
        error: null,
      };
    });
    // 2026-10-01 (Do) bis 2026-10-14 (Mi), nur Montag(1) + Mittwoch(3),
    // 2026-10-07 (Mi) ausgeschlossen.
    const res = await POST(
      bulkRequest({
        template: validTemplate,
        start_date: '2026-10-01',
        end_date: '2026-10-14',
        recurrence: 'weekdays',
        weekdays: [1, 3],
        exclude_dates: ['2026-10-07'],
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.dates).toEqual(['2026-10-05', '2026-10-12', '2026-10-14']);
    expect(json.created).toBe(3);
  });

  it('erstellt tägliche Dienste bei gültiger Anfrage', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('work_duties', (state) => {
      const rows = state.payload as Array<{ scheduled_date: string }>;
      return {
        data: rows.map((r, i) => ({ id: `duty-${i}`, scheduled_date: r.scheduled_date })),
        error: null,
      };
    });
    const res = await POST(
      bulkRequest({
        template: validTemplate,
        start_date: '2026-10-01',
        end_date: '2026-10-03',
        recurrence: 'daily',
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.created).toBe(3);
    expect(json.dates).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });

  it('liefert 500, wenn der Insert fehlschlägt (kein Partial-Success)', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('work_duties', () => ({ data: null, error: { message: 'db down' } }));
    const res = await POST(
      bulkRequest({
        template: validTemplate,
        start_date: '2026-10-01',
        end_date: '2026-10-03',
        recurrence: 'daily',
      })
    );
    expect(res.status).toBe(500);
  });
});
