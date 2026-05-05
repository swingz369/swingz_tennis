/**
 * Invoice State Machine
 *
 * Defines valid state transitions for invoices to ensure data integrity
 * and business rule compliance.
 */

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'dunning' | 'cancelled';

/**
 * Valid state transitions for invoices
 * Each key represents the current status, and the value is an array of allowed next statuses
 */
const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled'],
  overdue: ['paid', 'dunning', 'cancelled'],
  dunning: ['paid', 'cancelled'],
  paid: [], // Terminal state - no transitions allowed
  cancelled: [], // Terminal state - no transitions allowed
};

/**
 * Checks if a status transition is valid according to business rules
 *
 * @param from - Current invoice status
 * @param to - Target invoice status
 * @returns true if transition is allowed, false otherwise
 *
 * @example
 * canTransition('draft', 'sent') // true
 * canTransition('paid', 'draft') // false
 */
export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  const allowedTransitions = INVOICE_TRANSITIONS[from];
  return allowedTransitions ? allowedTransitions.includes(to) : false;
}

/**
 * Validates a status transition and throws an error if invalid
 *
 * @param from - Current invoice status
 * @param to - Target invoice status
 * @throws Error if transition is not allowed
 */
export function validateTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid invoice status transition: ${from} -> ${to}. ` +
        `Allowed transitions from ${from}: ${INVOICE_TRANSITIONS[from].join(', ') || 'none (terminal state)'}`
    );
  }
}

/**
 * Gets all possible next statuses for a given current status
 *
 * @param currentStatus - Current invoice status
 * @returns Array of allowed next statuses
 */
export function getAllowedTransitions(currentStatus: InvoiceStatus): InvoiceStatus[] {
  return INVOICE_TRANSITIONS[currentStatus] || [];
}

/**
 * Checks if a status is a terminal state (no further transitions possible)
 *
 * @param status - Invoice status to check
 * @returns true if status is terminal
 */
export function isTerminalState(status: InvoiceStatus): boolean {
  return INVOICE_TRANSITIONS[status].length === 0;
}

/**
 * Business logic for automatic status transitions
 * These transitions can happen automatically based on business rules
 */
export const AUTOMATIC_TRANSITIONS = {
  /**
   * Transition from 'sent' to 'overdue' when due date is passed
   */
  sentToOverdue: (dueDate: Date): boolean => {
    return new Date() > dueDate;
  },

  /**
   * Transition from 'overdue' to 'dunning' after grace period
   * Grace period is 14 days after due date
   */
  overdueToDunning: (dueDate: Date, graceDays: number = 14): boolean => {
    const gracePeriod = new Date(dueDate);
    gracePeriod.setDate(gracePeriod.getDate() + graceDays);
    return new Date() > gracePeriod;
  },
};
