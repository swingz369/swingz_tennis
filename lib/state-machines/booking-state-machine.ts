/**
 * Booking State Machine
 *
 * Defines valid state transitions for bookings to ensure data integrity
 * and business rule compliance.
 */

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

/**
 * Valid state transitions for bookings
 * Each key represents the current status, and the value is an array of allowed next statuses
 */
const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [], // Terminal state
  cancelled: [], // Terminal state
  no_show: [], // Terminal state
};

/**
 * Checks if a status transition is valid according to business rules
 *
 * @param from - Current booking status
 * @param to - Target booking status
 * @returns true if transition is allowed, false otherwise
 */
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  const allowedTransitions = BOOKING_TRANSITIONS[from];
  return allowedTransitions ? allowedTransitions.includes(to) : false;
}

/**
 * Validates a status transition and throws an error if invalid
 *
 * @param from - Current booking status
 * @param to - Target booking status
 * @throws Error if transition is not allowed
 */
export function validateTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid booking status transition: ${from} -> ${to}. ` +
        `Allowed transitions from ${from}: ${BOOKING_TRANSITIONS[from].join(', ') || 'none (terminal state)'}`
    );
  }
}

/**
 * Gets all possible next statuses for a given current status
 *
 * @param currentStatus - Current booking status
 * @returns Array of allowed next statuses
 */
export function getAllowedTransitions(currentStatus: BookingStatus): BookingStatus[] {
  return BOOKING_TRANSITIONS[currentStatus] || [];
}

/**
 * Checks if a status is a terminal state (no further transitions possible)
 *
 * @param status - Booking status to check
 * @returns true if status is terminal
 */
export function isTerminalState(status: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[status].length === 0;
}

/**
 * Business logic for automatic status transitions
 */
export const AUTOMATIC_TRANSITIONS = {
  /**
   * Transition from 'confirmed' to 'completed' after session end time
   */
  confirmedToCompleted: (sessionEndTime: Date): boolean => {
    return new Date() > sessionEndTime;
  },

  /**
   * Check if booking can still be cancelled based on cancellation policy
   */
  canCancel: (sessionStartTime: Date, cancellationHours: number = 24): boolean => {
    const now = new Date();
    const hoursUntilSession = (sessionStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilSession > cancellationHours;
  },
};
