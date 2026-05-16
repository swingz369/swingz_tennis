/**
 * Helper function to create booking using safe database RPC
 * This function uses the create_booking_safe RPC which provides:
 * - Row-level locking to prevent race conditions
 * - Atomic validation of max participants
 * - Unique constraint enforcement
 *
 * SECURITY FIX: This replaces the previous check-then-insert pattern
 * which had a race condition window (see ARCHITECTURE_ANALYSIS.md section 8.3)
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

export interface CreateBookingSafeParams {
  memberId: string;
  sessionId: string;
  clubId: string;
  scheduleId: string;
}

export interface CreateBookingSafeResult {
  bookingId: string;
  success: boolean;
  error?: string;
}

/**
 * Create a booking using the safe database RPC
 * This prevents race conditions and validates max participants atomically
 */
export async function createBookingSafe(
  params: CreateBookingSafeParams
): Promise<CreateBookingSafeResult> {
  try {
    const { data: bookingId, error } = await supabase.rpc('create_booking_safe', {
      p_member_id: params.memberId,
      p_session_id: params.sessionId,
      p_club_id: params.clubId,
      p_schedule_id: params.scheduleId,
    });

    if (error) {
      // Map PostgreSQL errors to user-friendly messages
      let errorMessage = error.message;

      if (error.message.includes('Session is full')) {
        errorMessage = 'This session is already fully booked';
      } else if (error.message.includes('already has an active booking')) {
        errorMessage = 'You have already booked this session';
      } else if (error.message.includes('Cannot book past sessions')) {
        errorMessage = 'This session has already started';
      } else if (error.message.includes('Session not found')) {
        errorMessage = 'Session not found';
      } else if (error.code === '23505') {
        // Unique constraint violation
        errorMessage = 'You have already booked this session';
      }

      return {
        bookingId: '',
        success: false,
        error: errorMessage,
      };
    }

    if (!bookingId) {
      return {
        bookingId: '',
        success: false,
        error: 'Failed to create booking',
      };
    }

    return {
      bookingId,
      success: true,
    };
  } catch (error) {
    console.error('Error in createBookingSafe:', error);
    return {
      bookingId: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get current booking count for a session
 * Useful for displaying availability to users
 */
export async function getSessionBookingCount(sessionId: string): Promise<number> {
  const { count, error } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .in('status', ['confirmed', 'pending']);

  if (error) {
    console.error('Error getting booking count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Check if a member has already booked a session
 */
export async function hasExistingBooking(memberId: string, sessionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('member_id', memberId)
    .eq('session_id', sessionId)
    .not('status', 'eq', 'cancelled')
    .maybeSingle();

  if (error) {
    console.error('Error checking existing booking:', error);
    return false;
  }

  return !!data;
}
