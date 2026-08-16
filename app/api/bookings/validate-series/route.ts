import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';
import { isDayClosed } from '@/lib/booking/opening-hours';

const log = createLogger('api:bookings:validate-series');

interface ValidateSeriesRequest {
  club_id: string;
  court_id: string;
  bookings: Array<{
    date: string;
    start_time: string;
    end_time: string;
  }>;
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    try {
      const supabase = auth.supabase;

      if (!(await verifyRole(auth, 'member'))) {
        return forbiddenResponse();
      }

      const body: ValidateSeriesRequest = await request.json();
      const { club_id, court_id, bookings } = body;

      if (!club_id || !court_id || !bookings || !Array.isArray(bookings)) {
        return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
      }

      if (!verifyClubAccess(auth, club_id)) {
        return forbiddenResponse('Kein Zugriff auf diesen Verein');
      }

      const { data: court, error: courtError } = await supabase
        .from('courts')
        .select('id')
        .eq('id', court_id)
        .eq('club_id', club_id)
        .maybeSingle();

      if (courtError || !court) {
        return NextResponse.json({ error: 'Platz gehört nicht zu diesem Verein' }, { status: 400 });
      }

      // Geschlossene Tage aus den Vereins-Öffnungszeiten sperren.
      const { data: clubHours } = await supabase
        .from('clubs')
        .select('opening_hours')
        .eq('id', club_id)
        .maybeSingle();

      // Validate each booking
      const results = await Promise.all(
        bookings.map(async (booking) => {
          const startDateTime = new Date(`${booking.date}T${booking.start_time}`);
          const endDateTime = new Date(`${booking.date}T${booking.end_time}`);

          // Geschlossener Tag?
          if (isDayClosed(clubHours?.opening_hours, startDateTime)) {
            return {
              date: booking.date,
              valid: false,
              error: 'Tag ist geschlossen',
            };
          }

          // Check for conflicts
          const { data: conflicts, error } = await supabase
            .from('bookings')
            .select('id, start_time, end_time')
            .eq('court_id', court_id)
            .eq('status', 'confirmed')
            .or(
              `and(start_time.lt.${endDateTime.toISOString()},end_time.gt.${startDateTime.toISOString()})`
            );

          if (error) {
            return {
              date: booking.date,
              valid: false,
              error: 'Validierungsfehler',
            };
          }

          if (conflicts && conflicts.length > 0) {
            return {
              date: booking.date,
              valid: false,
              error: 'Zeitslot bereits gebucht',
            };
          }

          return {
            date: booking.date,
            valid: true,
          };
        })
      );

      const validCount = results.filter((r) => r.valid).length;

      return NextResponse.json({
        results,
        summary: {
          total: bookings.length,
          valid: validCount,
          invalid: bookings.length - validCount,
        },
      });
    } catch (error) {
      log.error('Validation error:', error);
      return internalErrorResponse();
    }
  });
}
