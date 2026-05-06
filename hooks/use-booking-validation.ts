/**
 * Booking Validation Hook
 * Client-side wrapper for booking rules validation
 */

'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
  BookingValidationResult,
  CreateBookingInput,
  BookingRule,
} from '@/lib/types/booking-rules';

interface UseBookingValidationResult {
  validateBooking: (input: CreateBookingInput) => Promise<BookingValidationResult>;
  isValidating: boolean;
  lastValidation: BookingValidationResult | null;
  getBookingRules: (clubId: string, role: string) => Promise<BookingRule | null>;
}

/**
 * Hook for booking validation on the client side
 */
export function useBookingValidation(): UseBookingValidationResult {
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidation, setLastValidation] = useState<BookingValidationResult | null>(null);

  const validateBooking = useCallback(
    async (input: CreateBookingInput): Promise<BookingValidationResult> => {
      setIsValidating(true);

      try {
        const supabase = createClient();

        // Call the validation function
        const { data, error } = await supabase.rpc('validate_booking_rules', {
          p_user_id: input.user_id,
          p_club_id: input.club_id,
          p_court_id: input.court_id,
          p_start_time: input.start_time,
          p_end_time: input.end_time,
          p_booking_id: null,
        });

        if (error) {
          console.error('Booking validation error:', error);
          const result = {
            is_valid: false,
            error_code: 'VALIDATION_ERROR',
            error_message: error.message || 'Failed to validate booking',
          };
          setLastValidation(result);
          return result;
        }

        if (!data || data.length === 0) {
          const result = {
            is_valid: false,
            error_code: 'NO_RESPONSE',
            error_message: 'No validation response received',
          };
          setLastValidation(result);
          return result;
        }

        const result = data[0] as BookingValidationResult;
        setLastValidation(result);
        return result;
      } catch (error) {
        console.error('Booking validation exception:', error);
        const result = {
          is_valid: false,
          error_code: 'EXCEPTION',
          error_message: 'An unexpected error occurred during validation',
        };
        setLastValidation(result);
        return result;
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  const getBookingRules = useCallback(
    async (clubId: string, role: string): Promise<BookingRule | null> => {
      try {
        const supabase = createClient();

        const { data, error } = await supabase
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

        return data;
      } catch (error) {
        console.error('Exception fetching booking rules:', error);
        return null;
      }
    },
    []
  );

  return {
    validateBooking,
    isValidating,
    lastValidation,
    getBookingRules,
  };
}

/**
 * Format validation error message for user display
 */
export function formatValidationError(result: BookingValidationResult): string {
  if (result.is_valid) {
    return '';
  }

  // User-friendly error messages based on error code
  const errorMessages: Record<string, string> = {
    NO_MEMBERSHIP: 'Sie haben keine aktive Mitgliedschaft in diesem Club.',
    NO_RULES: 'Keine Buchungsregeln für diesen Club konfiguriert.',
    DURATION_TOO_SHORT: result.error_message || 'Die Buchungsdauer ist zu kurz.',
    DURATION_TOO_LONG: result.error_message || 'Die Buchungsdauer ist zu lang.',
    TOO_FAR_ADVANCE: result.error_message || 'Sie können nicht so weit im Voraus buchen.',
    TOO_SOON: result.error_message || 'Sie müssen früher buchen.',
    WEEKEND_NOT_ALLOWED: 'Wochenend-Buchungen sind nicht erlaubt.',
    MAX_DAILY_BOOKINGS: result.error_message || 'Maximale Anzahl Buchungen pro Tag erreicht.',
    MAX_WEEKLY_BOOKINGS: result.error_message || 'Maximale Anzahl Buchungen pro Woche erreicht.',
    TIME_RESTRICTED: result.error_message || 'Dieser Zeitslot ist gesperrt.',
    TIME_CONFLICT: 'Dieser Zeitslot ist bereits gebucht.',
    VALIDATION_ERROR: 'Fehler bei der Validierung.',
  };

  return errorMessages[result.error_code || ''] || result.error_message || 'Unbekannter Fehler';
}

/**
 * Get user-friendly booking rules summary
 */
export function getBookingRulesSummary(rule: BookingRule | null): string[] {
  if (!rule) {
    return ['Keine Buchungsregeln verfügbar'];
  }

  const summary: string[] = [];

  // Duration
  summary.push(
    `⏱️ Dauer: ${rule.min_booking_duration_minutes}-${rule.max_booking_duration_minutes} Minuten`
  );

  // Advance booking
  summary.push(`📅 Buchung möglich: ${rule.advance_booking_days} Tage im Voraus`);

  // Frequency limits
  summary.push(
    `🔢 Limits: Max. ${rule.max_bookings_per_day} Buchungen/Tag, ${rule.max_bookings_per_week}/Woche`
  );

  // Weekend booking
  if (!rule.allow_weekend_booking) {
    summary.push('🚫 Keine Wochenend-Buchungen erlaubt');
  }

  // Approval required
  if (rule.require_approval) {
    summary.push('✋ Buchungen müssen genehmigt werden');
  }

  // Recurring
  if (rule.allow_recurring) {
    summary.push(`🔄 Serienbuchungen möglich (max. ${rule.max_recurring_weeks} Wochen)`);
  }

  return summary;
}
