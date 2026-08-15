/**
 * lib/api-error-client.ts — strukturierter API-Fehlervertrag (Client-Seite)
 *
 * Normalisiert die Antwort eines `!res.ok`-Calls zu einem einheitlichen
 * `ApiError` mit Code + Meldung. Versteht sowohl das strukturierte Shape
 * (`{ error: { code, message } }`) als auch Alt-Shapes (`{ error: string }`,
 * `{ message: string }`), damit der Übergang schrittweise erfolgen kann.
 *
 * Kein `next/server`-Import — dieser Helfer darf in Client-Bundles landen.
 */

import { extractErrorMessage } from '@/lib/typed-helpers';
import type { ErrorCode } from '@/lib/api-error';

export interface ApiError {
  code: ErrorCode | 'UNKNOWN';
  message: string;
  status: number;
  details?: unknown;
}

/**
 * Liest den Fehlervertrag aus einer fehlgeschlagenen `Response`.
 * Wirft ein `ApiError` mit der deutschen Meldung und dem Code.
 */
export async function readApiError(res: Response): Promise<ApiError> {
  const status = res.status;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Kein JSON-Body — auf den HTTP-Status zurückfallen.
    return { code: 'UNKNOWN', message: `HTTP ${status}`, status };
  }

  const obj = (data ?? {}) as Record<string, unknown>;
  const err = obj.error;

  let code: ApiError['code'] = 'UNKNOWN';
  if (err && typeof err === 'object') {
    const nested = err as Record<string, unknown>;
    if (typeof nested.code === 'string') code = nested.code as ApiError['code'];
  }

  const message = extractErrorMessage(data) ?? `HTTP ${status}`;
  const details =
    err && typeof err === 'object' && 'details' in (err as object)
      ? (err as { details?: unknown }).details
      : undefined;

  return { code, message, status, details };
}

/**
 * Synchrone Variante für bereits geparste Bodies.
 */
export function apiErrorFromBody(data: unknown, status = 0): ApiError {
  const obj = (data ?? {}) as Record<string, unknown>;
  const err = obj.error;

  let code: ApiError['code'] = 'UNKNOWN';
  if (err && typeof err === 'object') {
    const nested = err as Record<string, unknown>;
    if (typeof nested.code === 'string') code = nested.code as ApiError['code'];
  }

  return {
    code,
    message: extractErrorMessage(data) ?? 'Unbekannter Fehler',
    status,
  };
}
