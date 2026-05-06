/**
 * Database Constraint Error Handling
 * Converts Postgres constraint violations into user-friendly errors
 */

export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class BookingConflictError extends DatabaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'BOOKING_CONFLICT', details);
    this.name = 'BookingConflictError';
  }
}

export class UniqueConstraintError extends DatabaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'UNIQUE_VIOLATION', details);
    this.name = 'UniqueConstraintError';
  }
}

/**
 * Parse Postgres error codes and convert to domain errors
 *
 * Common Postgres error codes:
 * - 23505: unique_violation
 * - 23503: foreign_key_violation
 * - 23502: not_null_violation
 * - 23514: check_violation
 * - 23P01: exclusion_violation (GIST constraint)
 */
export function parsePostgresError(error: any): DatabaseError {
  const code = error.code;
  const constraint = error.constraint;
  const detail = error.detail;

  // GIST Exclusion Constraint (booking overlap)
  if (code === '23P01' && constraint === 'bookings_no_court_overlap') {
    return new BookingConflictError(
      'Der Platz ist zu dieser Zeit bereits gebucht. Bitte wählen Sie eine andere Zeit.',
      {
        constraint,
        detail,
        message: error.message,
      }
    );
  }

  // Unique Constraint
  if (code === '23505') {
    const field = constraint?.replace(/_unique$/, '').replace(/_key$/, '');
    return new UniqueConstraintError(
      `Ein Eintrag mit diesem ${field || 'Wert'} existiert bereits.`,
      {
        constraint,
        detail,
        field,
      }
    );
  }

  // Foreign Key Violation
  if (code === '23503') {
    return new DatabaseError(
      'Referenzierte Daten existieren nicht oder wurden gelöscht.',
      'FOREIGN_KEY_VIOLATION',
      { constraint, detail }
    );
  }

  // Not Null Violation
  if (code === '23502') {
    const column = error.column;
    return new DatabaseError(
      `Pflichtfeld '${column}' darf nicht leer sein.`,
      'NOT_NULL_VIOLATION',
      { column, constraint }
    );
  }

  // Check Constraint Violation
  if (code === '23514') {
    return new DatabaseError(
      'Die eingegebenen Daten erfüllen nicht die Validierungsregeln.',
      'CHECK_VIOLATION',
      { constraint, detail }
    );
  }

  // Generic database error
  return new DatabaseError(
    error.message || 'Ein Datenbankfehler ist aufgetreten.',
    code || 'UNKNOWN',
    { detail, constraint }
  );
}

/**
 * Usage in Repository:
 *
 * ```ts
 * import { parsePostgresError, BookingConflictError } from '@/lib/database-errors';
 *
 * async save(booking: Booking): Promise<void> {
 *   const db = getDb();
 *   try {
 *     await db.insert(bookings).values({
 *       court_id: booking.courtId,
 *       start_time: booking.startTime,
 *       end_time: booking.endTime,
 *       status: 'confirmed',
 *     });
 *   } catch (error) {
 *     throw parsePostgresError(error);
 *   }
 * }
 * ```
 *
 * Usage in API Route:
 *
 * ```ts
 * import { BookingConflictError } from '@/lib/database-errors';
 *
 * export async function POST(req: NextRequest) {
 *   try {
 *     await bookingRepo.save(booking);
 *     return NextResponse.json({ success: true });
 *   } catch (error) {
 *     if (error instanceof BookingConflictError) {
 *       return NextResponse.json(
 *         { error: error.message, code: error.code },
 *         { status: 409 }  // Conflict
 *       );
 *     }
 *     throw error;
 *   }
 * }
 * ```
 */
