/**
 * Database Error Classes
 * Standardized error types for database operations
 */

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class NotFoundError extends DatabaseError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DatabaseError {
  constructor(message: string, cause?: unknown) {
    super(message, 'CONFLICT', cause);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends DatabaseError {
  constructor(
    message: string,
    public readonly fields?: Record<string, string>
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends DatabaseError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends DatabaseError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

/**
 * Helper to check if error is a database constraint violation
 */
export function isConstraintViolation(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    // PostgreSQL constraint violation codes
    return code === '23505' || code === '23503' || code === '23502';
  }
  return false;
}

/**
 * Helper to extract constraint name from PostgreSQL error
 */
export function getConstraintName(error: unknown): string | null {
  if (
    error &&
    typeof error === 'object' &&
    'constraint' in error &&
    typeof (error as { constraint: unknown }).constraint === 'string'
  ) {
    return (error as { constraint: string }).constraint;
  }
  return null;
}

/**
 * Helper to map PostgreSQL errors to user-friendly messages
 */
export function mapDatabaseError(error: unknown): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const pgError = error as { code: string; detail?: string; constraint?: string };

    switch (pgError.code) {
      case '23505': // unique_violation
        return new ConflictError(
          pgError.detail || 'A record with this value already exists',
          error
        );
      case '23503': // foreign_key_violation
        return new ValidationError(pgError.detail || 'Referenced record does not exist', {});
      case '23502': // not_null_violation
        return new ValidationError('Required field is missing', {});
      case '42P01': // undefined_table
        return new DatabaseError('Database table not found', 'SCHEMA_ERROR', error);
      default:
        return new DatabaseError('Database operation failed', pgError.code, error);
    }
  }

  if (error instanceof Error) {
    return new DatabaseError(error.message, undefined, error);
  }

  return new DatabaseError('Unknown database error', undefined, error);
}

/**
 * Alias for backward compatibility
 */
export const parsePostgresError = mapDatabaseError;
