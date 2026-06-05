/**
 * lib/api-fetch.ts — Fetch wrapper with automatic CSRF token injection
 *
 * Drop-in replacement for `fetch()` that automatically includes the
 * CSRF token header for state-changing methods (POST, PUT, PATCH, DELETE).
 *
 * Usage:
 *   import { apiFetch } from '@/lib/api-fetch';
 *
 *   const res = await apiFetch('/api/trainer-profiles/123', {
 *     method: 'PATCH',
 *     body: JSON.stringify({ availability }),
 *   });
 */

import { csrfHeaders } from './csrf-client';

/**
 * Wrapper around fetch that automatically adds:
 * - CSRF token header for state-changing methods
 * - Content-Type: application/json when body is a string
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const headers: Record<string, string> = {
    ...(isMutation ? { 'Content-Type': 'application/json' } : {}),
    ...(isMutation ? csrfHeaders() : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  return fetch(url, {
    ...options,
    headers,
  });
}
