/**
 * @vitest-environment node
 *
 * jsdom (Projekt-Default) liefert eigene File/FormData-Polyfills, die nicht
 * mit dem undici-basierten NextRequest.formData() zusammenspielen (File-Uploads
 * schlugen damit unabhängig vom Testinhalt mit 500 fehl) — diese Datei läuft
 * deshalb im node-Environment, das Node/undicis echte Implementierungen nutzt.
 *
 * Verhaltens-Tests für POST /api/members/bulk-import — bisher ungetestet
 * trotz Komplexität 68 (Fund 16.09.2026, tokensave test_risk). Deckt
 * Rollen-/Club-Guard, Datei-/CSV-Validierung (fehlende Datei, falscher Typ,
 * Parse-Fehler, leer, >500 Zeilen), den Import-Erfolgspfad inkl. Zeilen-
 * Validierung/Trainer-Sync und den generischen 500-Pfad bei einem DB-Fehler.
 *
 * Der Route-eigene Admin-Client (`createServerClient(url, serviceKey, ...)`)
 * nutzt denselben `@supabase/ssr`-Import, den `installSupabaseMock()` mockt
 * — `supa.table(...)` steuert deshalb auch dessen Antworten mit.
 *
 * Bekannte Harness-Grenze (siehe Testfälle unten): `user_club_memberships`
 * wird vom Harness fest auf die Auth-Kontext-Form
 * `[{ club_id, role }]` (ohne `user_id`) gemappt — für JEDE Query gegen
 * diese Tabelle, unabhängig vom Operationstyp. Das ist nötig, damit
 * `withApiAuth`/`buildAuthContext` funktioniert, macht aber die Route-eigene
 * `existingMemberships`-Abfrage (und damit den "bereits Mitglied → skip"-Pfad)
 * sowie einen simulierten Insert-Fehler auf dieser Tabelle über den
 * gemeinsamen Harness nicht gezielt testbar — beide Fälle sind hier bewusst
 * ausgelassen statt mit einem nicht aussagekräftigen Test vorgetäuscht.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { installSupabaseMock } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitOrFail: vi.fn(async () => null),
  RATE_LIMITS: { STRICT: { max: 5, windowMs: 900000, message: 'Zu viele Versuche.' } },
}));

const mockLogAudit = vi.fn(async () => {});
vi.mock('@/lib/audit', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

const { POST } = await import('@/app/api/members/bulk-import/route');

function csvRequest(
  csv: string | null,
  opts: { filename?: string; query?: string } = {}
): NextRequest {
  const form = new FormData();
  if (csv !== null) {
    form.append('file', new File([csv], opts.filename ?? 'members.csv', { type: 'text/csv' }));
  }
  const url = `http://localhost/api/members/bulk-import${opts.query ?? ''}`;
  return new NextRequest(url, { method: 'POST', body: form });
}

describe('POST /api/members/bulk-import', () => {
  beforeEach(() => {
    supa.reset();
    mockLogAudit.mockClear();
  });

  it('lehnt Nicht-Admins ab', async () => {
    supa.setRole('trainer', 'club-1');
    const res = await POST(csvRequest('email,full_name,role\nmax@test.de,Max Muster,member'));
    expect(res.status).toBe(403);
  });

  it('lehnt Requests ohne zugeordneten Verein ab', async () => {
    supa.setRole('admin', null);
    const res = await POST(csvRequest('email,full_name,role\nmax@test.de,Max Muster,member'));
    expect(res.status).toBe(400);
  });

  it('lehnt fehlende Datei ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await POST(csvRequest(null));
    expect(res.status).toBe(400);
  });

  it('lehnt Nicht-CSV-Dateien ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await POST(
      csvRequest('email,full_name,role\nmax@test.de,Max Muster,member', { filename: 'members.txt' })
    );
    expect(res.status).toBe(400);
  });

  it('lehnt eine nicht parsbare CSV-Datei ab', async () => {
    supa.setRole('admin', 'club-1');
    // Nicht geschlossenes Anführungszeichen — csv-parse/sync wirft.
    const res = await POST(csvRequest('email,full_name,role\n"unterminated,Max,member'));
    expect(res.status).toBe(400);
  });

  it('lehnt eine CSV ohne Datensätze ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await POST(csvRequest('email,full_name,role'));
    expect(res.status).toBe(400);
  });

  it('lehnt mehr als 500 Datensätze ab', async () => {
    supa.setRole('admin', 'club-1');
    const rows = Array.from(
      { length: 501 },
      (_, i) => `member${i}@test.de,Member ${i},member`
    ).join('\n');
    const res = await POST(csvRequest(`email,full_name,role\n${rows}`));
    expect(res.status).toBe(400);
  });

  it('importiert gültige Zeilen und trennt ungültige in `invalid` ab', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('users', (state) => {
      if (state.op === 'select') {
        // Nutzer existiert bereits — Phase 1 (auth.admin.createUser) entfällt.
        return { data: [{ id: 'user-max', email: 'max@test.de' }], error: null };
      }
      return { data: null, error: null }; // upsert: kein Fehler
    });

    const csv = [
      'email,full_name,role',
      'max@test.de,Max Muster,member',
      'invalid-email,X,member', // ungültige E-Mail
    ].join('\n');

    const res = await POST(csvRequest(csv));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.invalid).toHaveLength(1);
    expect(body.imported).toBe(1);
    expect(mockLogAudit).toHaveBeenCalledTimes(1);
  });

  it('weist per ?defaultRole=trainer die Trainer-Rolle zu und legt einen Trainer-Datensatz an', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('users', (state) => {
      if (state.op === 'select') {
        return { data: [{ id: 'user-anna', email: 'anna@test.de' }], error: null };
      }
      return { data: null, error: null };
    });
    const trainerUpsert = vi.fn();
    supa.table('trainers', (state) => {
      if (state.op === 'select') return { data: [], error: null }; // kein bestehender Trainer-Datensatz
      trainerUpsert(state);
      return { data: null, error: null };
    });

    const csv = 'email,full_name\nanna@test.de,Anna Trainer';
    const res = await POST(csvRequest(csv, { query: '?defaultRole=trainer' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(1);
    expect(trainerUpsert).toHaveBeenCalledTimes(1);
    expect(trainerUpsert.mock.calls[0][0].op).toBe('upsert');
  });

  it('antwortet mit einem generischen 500er, wenn der Profil-Sync in der DB fehlschlägt', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('users', (state) => {
      if (state.op === 'select') {
        return { data: [{ id: 'user-max', email: 'max@test.de' }], error: null };
      }
      // upsert schlägt fehl — die Route wirft, withApiAuth fängt den Fehler
      // und darf die rohe DB-Meldung NICHT durchreichen (safeErrorMessage-Pflicht).
      return { data: null, error: { message: 'constraint violation on users_pkey' } };
    });

    const res = await POST(csvRequest('email,full_name,role\nmax@test.de,Max Muster,member'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('constraint violation');
  });
});
