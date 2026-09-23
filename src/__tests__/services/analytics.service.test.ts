/**
 * AnalyticsService (ADR-005): Mapping der Buchungen und Umsatz-Filter.
 * Mockt das AnalyticsRepository per Prototyp-Spy.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fakeAuth } from '../helpers/auth';
import { AnalyticsService } from '@/application/services/analytics.service';
import {
  AnalyticsRepository,
  type BookingWithSession,
} from '@/infrastructure/persistence/repositories/analytics.repository';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const booking = (id: string, status: string, start: Date | null): BookingWithSession => ({
  id,
  memberId: 'm-' + id,
  status,
  session: start
    ? { start, end: new Date(start.getTime() + 90 * 60_000), courtId: 'court-1' }
    : null,
});

describe('AnalyticsService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mappt Buchungen mit Termin und ohne Termin', async () => {
    vi.spyOn(AnalyticsRepository.prototype, 'findBookingsWithSession').mockResolvedValue([
      booking('a', 'confirmed', daysAgo(1)),
      booking('b', 'pending', null),
    ]);
    const [a, b] = await new AnalyticsService(fakeAuth()).listBookings('club-1');
    expect(a).toMatchObject({ courtName: 'court-1', duration: 90, status: 'confirmed' });
    expect(b).toMatchObject({ courtName: 'TBD', date: '', duration: 0 });
  });

  it('summiert ausschließlich echte abgeschlossene Zahlungen', async () => {
    vi.spyOn(AnalyticsRepository.prototype, 'findPaidPayments').mockResolvedValue([
      {
        id: 'pay-1',
        memberId: 'member-1',
        amount: 23.5,
        paidAt: '2026-09-20T10:00:00Z',
        method: 'stripe',
      },
      {
        id: 'pay-2',
        memberId: 'member-2',
        amount: 10,
        paidAt: '2026-09-21T11:00:00Z',
        method: 'cash',
      },
    ]);
    const r = await new AnalyticsService(fakeAuth()).revenue('club-1');
    expect(r.payments.map((p) => p.id)).toEqual(['pay-1', 'pay-2']);
    expect(r.totalRevenue).toBe(33.5);
    expect(r.monthlyBreakdown).toEqual([{ month: '2026-09', revenue: 33.5 }]);
  });
});
