/**
 * Base class for all domain errors.
 * Extend this to create specific error types with structured data.
 */
export abstract class DomainError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
    };
  }
}

/**
 * Entity not found errors.
 */
export class EntityNotFoundError extends DomainError {
  public readonly entityName: string;
  public readonly id: string;

  constructor(entityName: string, id: string, code: string = 'ENTITY_NOT_FOUND') {
    super(`${entityName} with id "${id}" was not found`, code);
    this.entityName = entityName;
    this.id = id;
  }
}

export class BookingNotFoundError extends EntityNotFoundError {
  constructor(bookingId: string) {
    super('Booking', bookingId, 'BOOKING_NOT_FOUND');
  }
}

export class MemberNotFoundError extends EntityNotFoundError {
  constructor(memberId: string) {
    super('Member', memberId, 'MEMBER_NOT_FOUND');
  }
}

export class SessionNotFoundError extends EntityNotFoundError {
  constructor(sessionId: string) {
    super('Session', sessionId, 'SESSION_NOT_FOUND');
  }
}

export class ClubNotFoundError extends EntityNotFoundError {
  constructor(clubId: string) {
    super('Club', clubId, 'CLUB_NOT_FOUND');
  }
}

export class CourtNotFoundError extends EntityNotFoundError {
  constructor(courtId: string) {
    super('Court', courtId, 'COURT_NOT_FOUND');
  }
}

export class ScheduleNotFoundError extends EntityNotFoundError {
  constructor(scheduleId: string) {
    super('Schedule', scheduleId, 'SCHEDULE_NOT_FOUND');
  }
}

/**
 * Business rule violation errors.
 */
export class BusinessRuleViolationError extends DomainError {
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'BUSINESS_RULE_VIOLATION',
    details?: Record<string, unknown>
  ) {
    super(message, code);
    this.details = details ?? {};
  }
}

export class DoubleBookingError extends BusinessRuleViolationError {
  constructor(memberId: string, sessionId: string) {
    super('Member has already booked this session', 'DOUBLE_BOOKING', { memberId, sessionId });
  }
}

export class SessionFullError extends BusinessRuleViolationError {
  constructor(sessionId: string, capacity: number, booked: number) {
    super('Session is already at full capacity', 'SESSION_FULL', { sessionId, capacity, booked });
  }
}

export class MemberInactiveError extends BusinessRuleViolationError {
  constructor(memberId: string) {
    super('Member account is inactive and cannot make bookings', 'MEMBER_INACTIVE', { memberId });
  }
}

export class CancellationNotAllowedError extends BusinessRuleViolationError {
  constructor(bookingId: string, reason: string) {
    super(`Cancellation not allowed: ${reason}`, 'CANCELLATION_NOT_ALLOWED', { bookingId });
  }
}

export class InvalidCancellationReasonError extends BusinessRuleViolationError {
  constructor(reason: string) {
    super(`Invalid cancellation reason: ${reason}`, 'INVALID_CANCELLATION_REASON');
  }
}

export class OutsideBookingWindowError extends BusinessRuleViolationError {
  constructor(hours: number) {
    super(`Booking can only be made up to ${hours} hours in advance`, 'OUTSIDE_BOOKING_WINDOW', {
      hours,
    });
  }
}

export class TooCloseToSessionError extends BusinessRuleViolationError {
  constructor(minutes: number) {
    super(
      `Booking must be made at least ${minutes} minutes before session start`,
      'TOO_CLOSE_TO_SESSION',
      { minutes }
    );
  }
}

/**
 * Validation errors.
 */
export class ValidationError extends DomainError {
  public readonly field: string;
  public readonly invalidValue: unknown;

  constructor(
    field: string,
    invalidValue: unknown,
    message?: string,
    code: string = 'VALIDATION_ERROR'
  ) {
    super(message || `Invalid value for field "${field}": ${String(invalidValue)}`, code);
    this.field = field;
    this.invalidValue = invalidValue;
  }
}

export class InvalidEmailError extends ValidationError {
  constructor(email: string) {
    super('email', email, `Invalid email format: "${email}"`, 'INVALID_EMAIL');
  }
}

export class InvalidTimeSlotError extends ValidationError {
  constructor(start: Date, end: Date) {
    super(
      'timeSlot',
      { start, end },
      'Session end time must be after start time',
      'INVALID_TIME_SLOT'
    );
  }
}

export class PastSessionError extends ValidationError {
  constructor(sessionTime: Date) {
    super('sessionTime', sessionTime, 'Cannot book a session in the past', 'PAST_SESSION');
  }
}

/**
 * Authentication & Authorization errors.
 */
export class AuthError extends DomainError {
  constructor(message: string, code: string = 'AUTH_ERROR') {
    super(message, code);
  }
}

export class UnauthorizedError extends AuthError {
  constructor(resource?: string) {
    super(resource ? `Unauthorized access to ${resource}` : 'Unauthorized', 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AuthError {
  constructor(action: string) {
    super(`Forbidden: insufficient permissions to ${action}`, 'FORBIDDEN');
  }
}

/**
 * Repository / Infrastructure errors.
 */
export class RepositoryError extends DomainError {
  constructor(
    message: string,
    code: string = 'REPOSITORY_ERROR',
    public readonly cause?: Error
  ) {
    super(message, code);
  }
}

export class DatabaseError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'DATABASE_ERROR', cause);
  }
}

/**
 * Configuration errors.
 */
export class ConfigurationError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
  }
}

/**
 * Helper factory functions for common error scenarios.
 */
export const Errors = {
  booking: {
    notFound: (id: string) => new BookingNotFoundError(id),
    alreadyBooked: (memberId: string, sessionId: string) =>
      new DoubleBookingError(memberId, sessionId),
    cancellationNotAllowed: (bookingId: string, reason: string) =>
      new CancellationNotAllowedError(bookingId, reason),
  },

  member: {
    notFound: (id: string) => new MemberNotFoundError(id),
    inactive: (id: string) => new MemberInactiveError(id),
  },

  session: {
    notFound: (id: string) => new SessionNotFoundError(id),
    full: (sessionId: string, capacity: number, booked: number) =>
      new SessionFullError(sessionId, capacity, booked),
    past: (time: Date) => new PastSessionError(time),
  },

  club: {
    notFound: (id: string) => new ClubNotFoundError(id),
  },

  court: {
    notFound: (id: string) => new CourtNotFoundError(id),
  },

  schedule: {
    notFound: (id: string) => new ScheduleNotFoundError(id),
  },

  validation: {
    email: (email: string) => new InvalidEmailError(email),
    timeSlot: (start: Date, end: Date) => new InvalidTimeSlotError(start, end),
  },

  auth: {
    unauthorized: (resource?: string) => new UnauthorizedError(resource),
    forbidden: (action: string) => new ForbiddenError(action),
  },

  repo: {
    database: (message: string, cause?: Error) => new DatabaseError(message, cause),
  },
};
