import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { isDayClosed } from '@/lib/booking/opening-hours';

interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  interval: number;
  days_of_week?: number[];
  occurrences?: number;
  end_date?: string;
}

interface CreateSeriesBookingRequest {
  club_id: string;
  court_id: string;
  start_time: string;
  end_time: string;
  recurring_pattern: RecurringPattern;
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const supabase = auth.supabase;
    const user = auth.user;

    const body: CreateSeriesBookingRequest = await request.json();
    const { club_id, court_id, start_time, end_time, recurring_pattern } = body;

    // Validate input
    if (!club_id || !court_id || !start_time || !end_time || !recurring_pattern) {
      return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 });
    }

    // Validate max occurrences
    const maxOccurrences = recurring_pattern.occurrences || 52;
    if (maxOccurrences > 52) {
      return NextResponse.json({ error: 'Maximal 52 Wiederholungen erlaubt' }, { status: 400 });
    }

    // Generate all booking dates
    const bookings: Array<{ start_time: Date; end_time: Date }> = [];
    const startDate = new Date(start_time);
    const baseStartTime = new Date(start_time);
    const baseEndTime = new Date(end_time);
    const endDate = recurring_pattern.end_date
      ? new Date(recurring_pattern.end_date)
      : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

    let currentDate = new Date(startDate);
    let count = 0;

    while (count < maxOccurrences && currentDate <= endDate) {
      let shouldAdd = false;

      if (recurring_pattern.frequency === 'daily') {
        shouldAdd = true;
      } else if (recurring_pattern.frequency === 'weekly') {
        shouldAdd = recurring_pattern.days_of_week?.includes(currentDate.getDay()) || false;
      } else if (recurring_pattern.frequency === 'biweekly') {
        const weeksDiff = Math.floor(
          (currentDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        shouldAdd =
          weeksDiff % 2 === 0 &&
          (recurring_pattern.days_of_week?.includes(currentDate.getDay()) || false);
      } else if (recurring_pattern.frequency === 'monthly') {
        shouldAdd = currentDate.getDate() === startDate.getDate();
      }

      if (shouldAdd && currentDate >= startDate) {
        // Create booking times for this date
        const bookingStart = new Date(currentDate);
        bookingStart.setHours(baseStartTime.getHours(), baseStartTime.getMinutes(), 0, 0);

        const bookingEnd = new Date(currentDate);
        bookingEnd.setHours(baseEndTime.getHours(), baseEndTime.getMinutes(), 0, 0);

        bookings.push({
          start_time: bookingStart,
          end_time: bookingEnd,
        });

        count++;
      }

      // Move to next day
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);

      // Safety break
      if (bookings.length >= 52) break;
    }

    // Geschlossene Tage aus den Vereins-Öffnungszeiten sperren.
    const { data: clubHours } = await supabase
      .from('clubs')
      .select('opening_hours')
      .eq('id', club_id)
      .maybeSingle();

    // Create all bookings
    const bookingIds: string[] = [];
    const errors: Array<{ date: string; error: string }> = [];

    for (const booking of bookings) {
      try {
        // Geschlossener Tag?
        if (isDayClosed(clubHours?.opening_hours, booking.start_time)) {
          errors.push({
            date: booking.start_time.toISOString(),
            error: 'Tag ist geschlossen',
          });
          continue;
        }

        // Check availability
        const { data: conflicts } = await supabase
          .from('bookings')
          .select('id')
          .eq('court_id', court_id)
          .eq('status', 'confirmed')
          .or(
            `and(start_time.lte.${booking.end_time.toISOString()},end_time.gte.${booking.start_time.toISOString()})`
          )
          .limit(1);

        if (conflicts && conflicts.length > 0) {
          errors.push({
            date: booking.start_time.toISOString(),
            error: 'Zeitslot bereits gebucht',
          });
          continue;
        }

        // Create booking
        const { data, error } = await supabase
          .from('bookings')
          .insert({
            club_id,
            court_id,
            user_id: user.id,
            start_time: booking.start_time.toISOString(),
            end_time: booking.end_time.toISOString(),
            status: 'confirmed',
            booking_type: 'recurring',
          } as any)
          .select('id')
          .single();

        if (error) {
          errors.push({
            date: booking.start_time.toISOString(),
            error: 'Buchung konnte nicht erstellt werden',
          });
        } else if (data) {
          bookingIds.push(data.id);
        }
      } catch (_err) {
        errors.push({
          date: booking.start_time.toISOString(),
          error: 'Buchung konnte nicht erstellt werden',
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        bookingIds,
        errors,
        message: `Created ${bookingIds.length} bookings${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      },
      { status: 201 }
    );
  });
}
