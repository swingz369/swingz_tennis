/**
 * Fremde Vereine dürfen über ID/Body-Feld weder Zahlungen umbuchen, Rechnungen versenden
 * noch Plätze buchen (Audit 20.09.2026). Der Aufrufer ist Admin/Mitglied in club-1.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installSupabaseMock, makeApiRequest, makeFakeSupabaseClient } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.doMock('@/lib/supabase/service', () => ({
  createServiceClient: () => makeFakeSupabaseClient(),
}));

const PAYMENT_ID = '11111111-1111-1111-1111-111111111111';
const FOREIGN_CLUB = '99999999-9999-9999-9999-999999999999';

const { PATCH } = await import('@/app/api/payments/[id]/status/route');
const { POST: sendInvoiceEmail } = await import('@/app/api/billing/invoices/[id]/send-email/route');
const { POST: directBooking } = await import('@/app/api/bookings/direct/route');

const ctx = { params: Promise.resolve({ id: PAYMENT_ID }) };

describe('Mandantentrennung bei schreibenden Routen', () => {
  beforeEach(() => {
    supa.reset();
    process.env.DISABLE_RATE_LIMITING = 'true';
    supa.table('payments', (s) =>
      s.op === 'update'
        ? { data: { id: PAYMENT_ID, status: 'completed' }, error: null }
        : { data: { id: PAYMENT_ID, invoice_id: 'inv-1' }, error: null }
    );
    supa.table('invoices', () => ({
      data: { id: 'inv-1', club_id: FOREIGN_CLUB, member_id: 'm-1', items: [] },
      error: null,
    }));
  });

  it('Zahlungsstatus: Admin eines anderen Vereins bekommt 404', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PATCH(
      makeApiRequest('http://localhost/api/payments/x/status', {
        method: 'PATCH',
        json: { status: 'completed' },
      }),
      ctx
    );
    expect(res.status).toBe(404);
  });

  it('Zahlungsstatus: ungültiger Status wird abgelehnt', async () => {
    supa.setRole('admin', 'club-1');
    const res = await PATCH(
      makeApiRequest('http://localhost/api/payments/x/status', {
        method: 'PATCH',
        json: { status: 'hacked' },
      }),
      ctx
    );
    expect(res.status).toBe(400);
  });

  it('Rechnung versenden: Admin eines anderen Vereins bekommt 404', async () => {
    supa.setRole('admin', 'club-1');
    const res = await sendInvoiceEmail(
      makeApiRequest('http://localhost/api/billing/invoices/x/send-email', { method: 'POST' }),
      { params: Promise.resolve({ id: 'inv-1' }) }
    );
    expect(res.status).toBe(404);
  });

  it('Direktbuchung: clubId eines fremden Vereins wird abgelehnt', async () => {
    supa.setRole('member', 'club-1');
    const res = await directBooking(
      makeApiRequest('http://localhost/api/bookings/direct', {
        method: 'POST',
        json: {
          courtId: PAYMENT_ID,
          date: '2099-01-01',
          startTime: '10:00',
          endTime: '11:00',
          clubId: FOREIGN_CLUB,
        },
      })
    );
    expect(res.status).toBe(403);
  });
});
