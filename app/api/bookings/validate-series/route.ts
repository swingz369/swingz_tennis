import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ValidateSeriesRequest = await request.json();
    const { club_id, court_id, bookings } = body;

    if (!club_id || !court_id || !bookings || !Array.isArray(bookings)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Validate each booking
    const results = await Promise.all(
      bookings.map(async (booking) => {
        const startDateTime = new Date(`${booking.date}T${booking.start_time}`);
        const endDateTime = new Date(`${booking.date}T${booking.end_time}`);

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
            error: 'Validation error',
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
    console.error('Validation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
