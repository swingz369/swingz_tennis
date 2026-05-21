/**
 * Recurring Bookings Service
 * Handles creation and management of recurring court bookings
 * Based on TSOWAPP implementation
 */

import { createClient } from '@/lib/supabase/server';
import type { RecurringPattern } from '@/lib/types/booking-rules';
import { addDays, addWeeks, addMonths, isAfter } from 'date-fns';

interface RecurringBookingInput {
  club_id: string;
  court_id: string;
  user_id: string;
  start_time: Date;
  end_time: Date;
  booking_type?: string;
  number_of_players?: number;
  notes?: string;
  recurring_pattern: RecurringPattern;
}

interface BookingOccurrence {
  start_time: Date;
  end_time: Date;
  occurrence_number: number;
}

/**
 * Generate all occurrences for a recurring booking
 */
export function generateRecurringOccurrences(
  startTime: Date,
  endTime: Date,
  pattern: RecurringPattern
): BookingOccurrence[] {
  const occurrences: BookingOccurrence[] = [];
  const duration = endTime.getTime() - startTime.getTime();

  let currentStart = new Date(startTime);
  let occurrenceNumber = 1;

  // Determine end condition
  const maxOccurrences = pattern.occurrences || 52; // Default max 52 weeks
  const endDate = pattern.end_date ? new Date(pattern.end_date) : addWeeks(startTime, 52);

  while (occurrences.length < maxOccurrences) {
    // Check if we've passed the end date
    if (isAfter(currentStart, endDate)) {
      break;
    }

    // For weekly pattern, check if this day of week is included
    if (pattern.frequency === 'weekly' && pattern.days_of_week) {
      const dayOfWeek = currentStart.getDay();
      if (!pattern.days_of_week.includes(dayOfWeek)) {
        currentStart = addDays(currentStart, 1);
        continue;
      }
    }

    // Add this occurrence
    const currentEnd = new Date(currentStart.getTime() + duration);
    occurrences.push({
      start_time: new Date(currentStart),
      end_time: currentEnd,
      occurrence_number: occurrenceNumber,
    });

    // Move to next occurrence based on frequency
    switch (pattern.frequency) {
      case 'daily':
        currentStart = addDays(currentStart, pattern.interval || 1);
        break;
      case 'weekly':
        currentStart = addWeeks(currentStart, pattern.interval || 1);
        break;
      case 'biweekly':
        currentStart = addWeeks(currentStart, 2 * (pattern.interval || 1));
        break;
      case 'monthly':
        currentStart = addMonths(currentStart, pattern.interval || 1);
        break;
      default:
        // Unknown frequency, stop
        return occurrences;
    }

    occurrenceNumber++;
  }

  return occurrences;
}

/**
 * Create recurring bookings
 * Returns array of created booking IDs
 */
export async function createRecurringBookings(
  input: RecurringBookingInput
): Promise<{ success: boolean; bookingIds: string[]; errors: string[] }> {
  const supabase = await createClient();

  const bookingIds: string[] = [];
  const errors: string[] = [];

  // Generate all occurrences
  const occurrences = generateRecurringOccurrences(
    input.start_time,
    input.end_time,
    input.recurring_pattern
  );

  if (occurrences.length === 0) {
    return {
      success: false,
      bookingIds: [],
      errors: ['No occurrences generated for this pattern'],
    };
  }

  // Create bookings for each occurrence
  for (const occurrence of occurrences) {
    try {
      // Generate booking number
      const { data: bookingNumber } = await (supabase as any).rpc('generate_booking_number', {
        p_club_id: input.club_id,
      });

      // Create booking
      const { data: booking, error } = await supabase
        .from('bookings')
        .insert({
          club_id: input.club_id,
          court_id: input.court_id,
          user_id: input.user_id,
          booking_number:
            (typeof bookingNumber === 'string' ? bookingNumber : null) ||
            `BK-${Date.now()}-${occurrence.occurrence_number}`,
          start_time: occurrence.start_time.toISOString(),
          end_time: occurrence.end_time.toISOString(),
          status: 'confirmed',
          booking_type: input.booking_type || 'regular',
          is_recurring: true,
          recurring_pattern: input.recurring_pattern as unknown as null,
          number_of_players: input.number_of_players || 2,
          notes: input.notes
            ? `${input.notes} (Serie ${occurrence.occurrence_number}/${occurrences.length})`
            : `Serienbuchung ${occurrence.occurrence_number}/${occurrences.length}`,
        } as any)
        .select('id')
        .single();

      if (error) {
        console.error(
          `Error creating booking for occurrence ${occurrence.occurrence_number}:`,
          error
        );
        errors.push(`Buchung ${occurrence.occurrence_number}: ${error.message}`);
      } else if (booking) {
        bookingIds.push(booking.id);
      }
    } catch (error) {
      console.error(
        `Exception creating booking for occurrence ${occurrence.occurrence_number}:`,
        error
      );
      errors.push(`Buchung ${occurrence.occurrence_number}: Unerwarteter Fehler`);
    }
  }

  return {
    success: bookingIds.length > 0,
    bookingIds,
    errors,
  };
}

/**
 * Cancel all future occurrences of a recurring booking
 */
export async function cancelRecurringBookings(
  userId: string,
  clubId: string,
  courtId: string,
  fromDate: Date
): Promise<{ success: boolean; cancelledCount: number; errors: string[] }> {
  const supabase = await createClient();

  // Find all future bookings matching the pattern
  const { data: bookings, error: fetchError } = await (supabase as any)
    .from('bookings')
    .select('id')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .eq('court_id', courtId)
    .eq('is_recurring', true)
    .gte('start_time', fromDate.toISOString())
    .in('status', ['confirmed', 'pending']);

  if (fetchError) {
    return {
      success: false,
      cancelledCount: 0,
      errors: [fetchError.message],
    };
  }

  if (!bookings || bookings.length === 0) {
    return {
      success: true,
      cancelledCount: 0,
      errors: [],
    };
  }

  // Cancel each booking
  const bookingIds = bookings.map((b: { id: string }) => b.id);
  const { error: cancelError } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'Serienbuchung storniert',
    })
    .in('id', bookingIds);

  if (cancelError) {
    return {
      success: false,
      cancelledCount: 0,
      errors: [cancelError.message],
    };
  }

  return {
    success: true,
    cancelledCount: bookings.length,
    errors: [],
  };
}

/**
 * Get all bookings that are part of a recurring series
 */
export async function getRecurringBookingSeries(
  userId: string,
  clubId: string,
  courtId: string,
  _referenceDate: Date
): Promise<any[]> {
  const supabase = await createClient();

  const { data: bookings, error } = await (supabase as any)
    .from('bookings')
    .select('*')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .eq('court_id', courtId)
    .eq('is_recurring', true)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching recurring booking series:', error);
    return [];
  }

  return bookings || [];
}

/**
 * Validate recurring booking pattern
 */
export function validateRecurringPattern(pattern: RecurringPattern): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check frequency
  if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(pattern.frequency)) {
    errors.push('Ungültige Frequenz');
  }

  // Check interval
  if (pattern.interval && (pattern.interval < 1 || pattern.interval > 12)) {
    errors.push('Intervall muss zwischen 1 und 12 liegen');
  }

  // Check days of week for weekly pattern
  if (pattern.frequency === 'weekly') {
    if (!pattern.days_of_week || pattern.days_of_week.length === 0) {
      errors.push('Für wöchentliche Buchungen müssen Wochentage angegeben werden');
    }
    if (pattern.days_of_week?.some((d) => d < 0 || d > 6)) {
      errors.push('Ungültige Wochentage (0-6)');
    }
  }

  // Check end condition
  if (!pattern.end_date && !pattern.occurrences) {
    errors.push('Enddatum oder Anzahl der Wiederholungen muss angegeben werden');
  }

  // Check occurrences limit
  if (pattern.occurrences && (pattern.occurrences < 1 || pattern.occurrences > 52)) {
    errors.push('Anzahl der Wiederholungen muss zwischen 1 und 52 liegen');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
