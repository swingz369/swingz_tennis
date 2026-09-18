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

  it('zählt nur bestätigte Buchungen der letzten 6 Monate', async () => {
    vi.spyOn(AnalyticsRepository.prototype, 'findBookingsWithSession').mockResolvedValue([
      booking('ok', 'confirmed', daysAgo(2)),
      booking('alt', 'confirmed', daysAgo(400)),
      booking('zukunft', 'confirmed', daysAgo(-5)),
      booking('storniert', 'cancelled', daysAgo(2)),
      booking('ohne', 'confirmed', null),
    ]);
    const r = await new AnalyticsService(fakeAuth()).revenue('club-1');
    expect(r.payments.map((p) => p.id)).toEqual(['pay-ok']);
    expect(r.totalRevenue).toBe(15);
    expect(r.monthlyBreakdown).toHaveLength(1);
  });
});
