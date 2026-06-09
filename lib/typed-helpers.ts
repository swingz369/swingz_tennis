/**
 * Centralized Typed Helpers
 *
 * Single source of truth for common patterns that were previously duplicated
 * across the codebase:
 *
 *   • getErrorMessage(err: unknown): string
 *       Safe error message extraction from unknown thrown values
 *       (Error instances, strings, plain objects with .message, etc.)
 *
 *   • extractErrorMessage(data: unknown): string | null
 *       Pulls an error message out of an API response body (string,
 *       `{error: string}`, `{message: string}`, `{data: {error: ...}}`).
 *
 *   • unwrapJoin<T>(value: T | T[] | null | undefined): T | null
 *       Normalizes Supabase single / many / null join results.
 *
 *   • unwrapJoins<T>(value): T[]
 *       Same as unwrapJoin but always returns an array (empty when missing).
 *
 *   • DEFAULT_COURT, DEFAULT_USER, DEFAULT_TRAINER, DEFAULT_SESSION
 *       Typed fallback objects for unwrapJoin when a join returns null.
 *
 * Consumed by:
 *   • lib/fetch-utils.ts        — extractErrorMessage
 *   • components/trainer-availability-manager.tsx — getErrorMessage
 *   • app/api/admin/bookings/route.ts — unwrapJoin, DEFAULT_*
 *   • Any new code that needs to normalize Supabase joins or extract errors
 */

// =============================================================================
// ERROR HELPERS
// =============================================================================

/**
 * Safely extract a human-readable error message from any thrown value.
 * Handles `Error`, strings, plain objects with `.message`, and falls back
 * to a generic German message for unknown shapes.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (
    err !== null &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return 'Unbekannter Fehler';
}

/**
 * Pull an error message out of an API response body. Returns null if no
 * recognizable error field is present.
 *
 * Recognized shapes:
 *   - `string` (returned as-is)
 *   - `{ error: string }` / `{ message: string }`
 *   - `{ data: { error: string } | string }`
 *   - `{ error: { message: string } }`
 */
export function extractErrorMessage(data: unknown): string | null {
  if (typeof data === 'string') return data;
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;

  if (typeof obj.error === 'string') return obj.error;
  if (typeof obj.message === 'string') return obj.message;

  if (obj.error && typeof obj.error === 'object') {
    const nested = obj.error as Record<string, unknown>;
    if (typeof nested.message === 'string') return nested.message;
  }

  if (obj.data) {
    if (typeof obj.data === 'string') return obj.data;
    if (typeof obj.data === 'object') {
      return extractErrorMessage(obj.data);
    }
  }

  return null;
}

// =============================================================================
// JOIN HELPERS (Supabase single/many normalization)
// =============================================================================

/**
 * Supabase returns joins as either a single object, an array, or null
 * (e.g. when the foreign key is nullable or RLS hides the row).
 * This normalizes all three to `T | null`.
 */
export function unwrapJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    return (value[0] ?? null) as T | null;
  }
  return value;
}

/**
 * Same as unwrapJoin, but always returns an array (empty when missing).
 * Useful for `pricing_rules` or `group_ids` where an array is expected.
 */
export function unwrapJoins<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

// =============================================================================
// TYPED DEFAULTS (for unwrapJoin fallbacks)
// =============================================================================

/** Minimal court shape used as a fallback when the joined court is null. */
export interface DefaultCourtShape {
  name: string | null;
  surface: string | null;
  number: number | null;
}

export const DEFAULT_COURT: DefaultCourtShape = {
  name: null,
  surface: null,
  number: null,
};

/** Minimal user shape used as a fallback when the joined user is null. */
export interface DefaultUserShape {
  id: string;
  email: string | null;
  full_name: string | null;
}

export const DEFAULT_USER: DefaultUserShape = {
  id: '',
  email: null,
  full_name: null,
};

/** Minimal trainer shape used as a fallback when the joined trainer is null. */
export interface DefaultTrainerShape {
  name: string | null;
}

export const DEFAULT_TRAINER: DefaultTrainerShape = {
  name: null,
};

/** Minimal session shape used as a fallback when the joined session is null. */
export interface DefaultSessionShape {
  id: string;
  timeslot_start: string | null;
  timeslot_end: string | null;
}

export const DEFAULT_SESSION: DefaultSessionShape = {
  id: '',
  timeslot_start: null,
  timeslot_end: null,
};
