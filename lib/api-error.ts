/**
 * lib/api-error.ts — strukturierter API-Fehlervertrag (Server-Seite)
 *
 * Ein einziger Fehlervertrag für alle API-Routen:
 *
 *   { error: { code: ErrorCode, message: string, details?: unknown } }
 *
 * Die Auth-Schicht (`lib/api-auth.ts`) und sämtliche Routen antworten mit
 * diesem Shape. Client-seitig extrahiert `extractErrorMessage()` aus
 * `lib/typed-helpers.ts` die Meldung (versteht auch das verschachtelte
 * `{ error: { message } }`); `readApiError()` aus `lib/api-error-client.ts`
 * liefert zusätzlich den maschinenlesbaren `code`.
 *
 * Wichtig: `internalErrorResponse()` ist der einzige zulässige 500-Pfad.
 * Niemals `error.message` roh an den Client geben (Stack-/SQL-Leak).
 */

import { NextResponse } from 'next/server';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'PAYMENT_REQUIRED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PAYMENT_REQUIRED: 402,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/**
 * Programmatisch werfbare Fehlerklasse. Wird von `withAuth`/`withApiAuth` als
 * NextResponse beantwortet, sobald der Fehlervertrag dort angebunden ist.
 */
export class ApiException extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options: { status?: number; details?: unknown } = {}
  ) {
    super(message);
    this.name = 'ApiException';
    this.code = code;
    this.status = options.status ?? STATUS_BY_CODE[code];
    this.details = options.details;
  }
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  options: { status?: number; details?: unknown } = {}
): NextResponse {
  const status = options.status ?? STATUS_BY_CODE[code];
  const body: { error: ApiErrorBody } = {
    error: {
      code,
      message,
      ...(options.details !== undefined ? { details: options.details } : {}),
    },
  };
  return NextResponse.json(body, { status });
}

/**
 * Generischer 500-Pfad. Gibt bewusst KEINE internen Details preis.
 * Der eigentliche Fehler gehört ins Server-Log (`createLogger`).
 */
export function internalErrorResponse(message = 'Interner Serverfehler'): NextResponse {
  return errorResponse('INTERNAL', message);
}

/**
 * Macht aus einem beliebigen Fehler eine Meldung, die dem Nutzer gezeigt
 * werden darf.
 *
 * Grund: Fehler aus Postgres, PostgREST und Drizzle tragen das komplette
 * Statement samt Tabellen- und Spaltennamen in `.message`. Ein 500er hat
 * davon einmal den ganzen Bauplan an den Browser geliefert — für den Nutzer
 * wertlos, für einen Angreifer eine Landkarte.
 *
 * Durchgelassen wird nur, was die Anwendung selbst formuliert hat
 * (`ApiException`). Alles andere bekommt den Ersatztext; das Original gehört
 * ins Server-Log, nicht in die Antwort.
 */
export function safeErrorMessage(err: unknown, fallback = 'Interner Serverfehler'): string {
  if (err instanceof ApiException) return err.message;
  return fallback;
}
