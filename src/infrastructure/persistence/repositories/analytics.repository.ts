/**
 * Lesezugriff für Auswertungen/Exporte (ADR-005): Buchungen eines Vereins
 * samt Termin. Supabase-Client mit Nutzer-Token, RLS entscheidet, was der
 * Aufrufer sieht.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';
import { fetchAll } from './paged';

const log = createLogger('infrastructure:analytics.repository');

export interface BookingWithSession {
  id: string;
  memberId: string;
  status: string;
  session: { start: Date; end: Date; courtId: string | null } | null;
}

export interface PaidPayment {
  id: string;
  memberId: string | null;
  amount: number;
  paidAt: string;
  method: string;
}

export class AnalyticsRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async findPaidPayments(clubId: string): Promise<PaidPayment[]> {
    const rows = await fetchAll(
      () =>
        this.db
          .from('payments')
          .select('id, amount, paid_at, payment_method, invoices!inner(club_id, member_id)')
          .eq('invoices.club_id', clubId)
          .eq('status', 'completed')
          .not('paid_at', 'is', null)
          .order('id'),
      'Lesen der bezahlten Zahlungen fehlgeschlagen'
    );
    return rows.map((row) => ({
      id: row.id,
      memberId: row.invoices.member_id,
      amount: Number(row.amount),
      paidAt: row.paid_at!,
      method: row.payment_method ?? '',
    }));
  }

  async findBookingsWithSession(clubId: string): Promise<BookingWithSession[]> {
    const { data, error } = await this.db
      .from('bookings')
      .select('id, member_id, status, session:sessions(timeslot_start, timeslot_end, court_id)')
      .eq('club_id', clubId);
    if (error) {
      log.error('Lesen der Buchungen fehlgeschlagen', new Error(error.message));
      throw new Error('Lesen der Buchungen fehlgeschlagen');
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      memberId: row.member_id,
      status: row.status,
      session: row.session
        ? {
            start: new Date(row.session.timeslot_start),
            end: new Date(row.session.timeslot_end),
            courtId: row.session.court_id,
          }
        : null,
    }));
  }
}
