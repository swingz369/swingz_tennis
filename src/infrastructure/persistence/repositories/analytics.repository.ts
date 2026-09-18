/**
 * Lesezugriff für Auswertungen/Exporte (ADR-005): Buchungen eines Vereins
 * samt Termin. Supabase-Client mit Nutzer-Token, RLS entscheidet, was der
 * Aufrufer sieht.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:analytics.repository');

export interface BookingWithSession {
  id: string;
  memberId: string;
  status: string;
  session: { start: Date; end: Date; courtId: string | null } | null;
}

export class AnalyticsRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

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
