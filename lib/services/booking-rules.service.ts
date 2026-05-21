/**
 * Enhanced Booking Rules Service
 * Handles validation and management of booking rules
 * Based on TSOWAPP booking system
 */

import { createClient } from '@/lib/supabase/server';
import type {
  BookingRule,
  BookingValidationResult,
  CreateBookingInput,
  MemberBookingPreferences,
  BookingRestriction,
  UserRole,
} from '@/lib/types/booking-rules';

/**
 * Validate a booking against all rules and restrictions
 */
export async function validateBooking(input: CreateBookingInput): Promise<BookingValidationResult> {
  const supabase = await createClient();

  try {
    // Call the PostgreSQL validation function
    const { data, error } = await (supabase as any).rpc('validate_booking_rules' as any, {
      p_user_id: input.user_id,
      p_club_id: input.club_id,
      p_court_id: input.court_id,
      p_start_time: input.start_time,
      p_end_time: input.end_time,
      p_booking_id: null,
    });

    if (error) {
      console.error('Booking validation error:', error);
      return {
        is_valid: false,
        error_code: 'VALIDATION_ERROR',
        error_message: 'Failed to validate booking',
      };
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        is_valid: false,
        error_code: 'NO_RESPONSE',
        error_message: 'No validation response received',
      };
    }

    return (data as any)[0];
  } catch (error) {
    console.error('Booking validation exception:', error);
    return {
      is_valid: false,
      error_code: 'EXCEPTION',
      error_message: 'An unexpected error occurred during validation',
    };
  }
}

/**
 * Get booking rules for a specific role in a club
 */
export async function getBookingRulesForRole(
  clubId: string,
  role: UserRole
): Promise<BookingRule | null> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('booking_rules')
    .select('*')
    .eq('club_id', clubId)
    .eq('role', role)
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .maybeSingle();

  if (error) {
    console.error('Error fetching booking rules:', error);
    return null;
  }

  return data as BookingRule | null;
}

/**
 * Get all active booking rules for a club
 */
export async function getClubBookingRules(clubId: string): Promise<BookingRule[]> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('booking_rules')
    .select('*')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (error) {
    console.error('Error fetching club booking rules:', error);
    return [];
  }

  return (data as BookingRule[]) || [];
}

/**
 * Get member booking preferences
 */
export async function getMemberBookingPreferences(
  userId: string,
  clubId: string
): Promise<MemberBookingPreferences | null> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('member_booking_preferences' as any)
    .select('*')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching member preferences:', error);
    return null;
  }

  return data;
}

/**
 * Update member booking preferences
 */
export async function updateMemberBookingPreferences(
  userId: string,
  clubId: string,
  preferences: Partial<MemberBookingPreferences>
): Promise<MemberBookingPreferences | null> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('member_booking_preferences' as any)
    .upsert({
      user_id: userId,
      club_id: clubId,
      ...preferences,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating member preferences:', error);
    return null;
  }

  return data;
}

/**
 * Get active booking restrictions for a club
 */
export async function getActiveRestrictions(
  clubId: string,
  courtId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<BookingRestriction[]> {
  const supabase = await createClient();

  let query = (supabase as any)
    .from('booking_restrictions' as any)
    .select('*')
    .eq('club_id', clubId)
    .eq('is_active', true);

  if (courtId) {
    query = query.or(`court_id.is.null,court_id.eq.${courtId}`);
  }

  if (startDate && endDate) {
    query = query
      .gte('end_datetime', startDate.toISOString())
      .lte('start_datetime', endDate.toISOString());
  }

  const { data, error } = await query.order('start_datetime', { ascending: true });

  if (error) {
    console.error('Error fetching booking restrictions:', error);
    return [];
  }

  return data || [];
}

/**
 * Create a booking restriction (admin only)
 */
export async function createBookingRestriction(
  restriction: Omit<BookingRestriction, 'id' | 'created_at' | 'updated_at'>
): Promise<BookingRestriction | null> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('booking_restrictions' as any)
    .insert(restriction)
    .select()
    .single();

  if (error) {
    console.error('Error creating booking restriction:', error);
    return null;
  }

  return data;
}

/**
 * Check if a time slot is available considering all restrictions
 */
export async function isTimeSlotAvailable(
  clubId: string,
  courtId: string,
  startTime: Date,
  endTime: Date
): Promise<{ available: boolean; reason?: string }> {
  const supabase = await createClient();

  // Check for existing bookings
  const { data: existingBookings, error: bookingError } = await supabase
    .from('bookings')
    .select('id')
    .eq('club_id', clubId)
    .eq('court_id', courtId)
    .in('status', ['confirmed', 'pending'])
    .or(`and(start_time.lt.${endTime.toISOString()},end_time.gt.${startTime.toISOString()})`)
    .limit(1);

  if (bookingError) {
    console.error('Error checking booking availability:', bookingError);
    return { available: false, reason: 'Error checking availability' };
  }

  if (existingBookings && existingBookings.length > 0) {
    return { available: false, reason: 'Time slot already booked' };
  }

  // Check for restrictions
  const { data: restrictions, error: restrictionError } = await (supabase as any)
    .from('booking_restrictions' as any)
    .select('name, restriction_type')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .or(`court_id.is.null,court_id.eq.${courtId}`)
    .or(
      `and(start_datetime.lte.${startTime.toISOString()},end_datetime.gte.${startTime.toISOString()}),` +
        `and(start_datetime.lte.${endTime.toISOString()},end_datetime.gte.${endTime.toISOString()}),` +
        `and(start_datetime.gte.${startTime.toISOString()},end_datetime.lte.${endTime.toISOString()})`
    )
    .limit(1);

  if (restrictionError) {
    console.error('Error checking restrictions:', restrictionError);
    return { available: false, reason: 'Error checking restrictions' };
  }

  if (restrictions && restrictions.length > 0) {
    const restriction = restrictions[0];
    return {
      available: false,
      reason: `Blocked: ${restriction.name} (${restriction.restriction_type})`,
    };
  }

  return { available: true };
}

/**
 * Get user's upcoming bookings count for rate limiting
 */
export async function getUserBookingsCount(
  userId: string,
  clubId: string,
  _timeFrame: 'day' | 'week' = 'week'
): Promise<{ daily: number; weekly: number }> {
  const supabase = await createClient();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)

  // Get daily count
  const { count: dailyCount } = await (supabase as any)
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .gte('start_time', today.toISOString())
    .lt('start_time', new Date(today.getTime() + 86400000).toISOString()) // Next day
    .in('status', ['confirmed', 'pending']);

  // Get weekly count
  const { count: weeklyCount } = await (supabase as any)
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .gte('start_time', weekStart.toISOString())
    .lt('start_time', new Date(weekStart.getTime() + 7 * 86400000).toISOString()) // Week end
    .in('status', ['confirmed', 'pending']);

  return {
    daily: dailyCount || 0,
    weekly: weeklyCount || 0,
  };
}
