/**
 * Error Handling Utilities for SwingZ API
 */

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends APIError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends APIError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends APIError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends APIError {
  constructor(message: string = 'Not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends APIError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends APIError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
    this.name = 'RateLimitError';
  }
}

/**
 * Format error response consistently
 */
export function formatErrorResponse(error: unknown) {
  if (error instanceof APIError) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      error: error.message,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
  }

  return {
    error: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  };
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(body: Record<string, any>, requiredFields: string[]): void {
  const missingFields = requiredFields.filter(
    (field) => body[field] === undefined || body[field] === null || body[field] === ''
  );

  if (missingFields.length > 0) {
    throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`, {
      missingFields,
    });
  }
}

/**
 * Validate date range
 */
export function validateDateRange(startDate: string, endDate: string): void {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ValidationError('Invalid date format');
  }

  if (start >= end) {
    throw new ValidationError('Start date must be before end date');
  }
}

/**
 * Validate time range
 */
export function validateTimeRange(startTime: string, endTime: string): void {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ValidationError('Invalid time format');
  }

  if (start >= end) {
    throw new ValidationError('Start time must be before end time');
  }
}

/**
 * Check user permissions
 */
export async function checkPermissions(userRole: string, allowedRoles: string[]): Promise<void> {
  if (!allowedRoles.includes(userRole)) {
    throw new ForbiddenError(
      `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`
    );
  }
}

/**
 * Validate UUID format
 */
export function validateUUID(id: string, fieldName: string = 'ID'): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }
}

/**
 * Sanitize error message for user display
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof APIError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Don't expose internal error details to users
    if (error.message.includes('database') || error.message.includes('SQL')) {
      return 'A database error occurred. Please try again later.';
    }

    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Log error with context
 */
export function logError(
  error: unknown,
  context: {
    endpoint: string;
    method: string;
    userId?: string;
    [key: string]: any;
  }
): void {
  console.error('[API Error]', {
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  });
}

/**
 * User-friendly error messages for common error codes
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // Auth errors
  UNAUTHORIZED: 'Sie müssen angemeldet sein, um diese Aktion auszuführen.',
  FORBIDDEN: 'Sie haben keine Berechtigung für diese Aktion.',

  // Validation errors
  VALIDATION_ERROR: 'Die eingegebenen Daten sind ungültig.',
  MISSING_FIELDS: 'Bitte füllen Sie alle erforderlichen Felder aus.',
  INVALID_DATE: 'Das angegebene Datum ist ungültig.',
  INVALID_TIME: 'Die angegebene Zeit ist ungültig.',

  // Booking errors
  TIME_SLOT_UNAVAILABLE: 'Dieser Zeitslot ist nicht mehr verfügbar.',
  BOOKING_CONFLICT: 'Es gibt einen Konflikt mit einer anderen Buchung.',
  MAX_BOOKINGS_REACHED: 'Sie haben die maximale Anzahl an Buchungen erreicht.',
  BOOKING_TOO_FAR_ADVANCE: 'Sie können nicht so weit im Voraus buchen.',
  BOOKING_TOO_SOON: 'Sie müssen früher buchen.',
  DURATION_INVALID: 'Die Buchungsdauer entspricht nicht den Regeln.',

  // Trainer errors
  TRAINER_UNAVAILABLE: 'Der Trainer ist zu diesem Zeitpunkt nicht verfügbar.',
  TRAINER_CONFLICT: 'Es gibt einen Konflikt mit der Trainer-Verfügbarkeit.',
  ABSENCE_OVERLAP: 'Es gibt eine Überschneidung mit einer anderen Abwesenheit.',

  // Series booking errors
  MAX_OCCURRENCES_EXCEEDED: 'Maximale Anzahl an Wiederholungen überschritten.',
  SERIES_CREATION_FAILED: 'Fehler beim Erstellen der Serienbuchung.',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'Sie haben zu viele Anfragen gesendet. Bitte warten Sie einen Moment.',

  // General errors
  NOT_FOUND: 'Die angeforderte Ressource wurde nicht gefunden.',
  INTERNAL_ERROR: 'Ein interner Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
  DATABASE_ERROR: 'Ein Datenbankfehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
};

/**
 * Get user-friendly error message
 */
export function getUserFriendlyError(code: string, fallbackMessage?: string): string {
  return ERROR_MESSAGES[code] || fallbackMessage || ERROR_MESSAGES.INTERNAL_ERROR;
}
