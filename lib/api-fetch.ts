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
 * - Content-Type: application/json when body is a string (NOT for FormData)
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    // Skip Content-Type for FormData — browser sets multipart/form-data with boundary
    ...(isMutation && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(isMutation ? csrfHeaders() : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Wie `apiFetch`, wirft aber bei einer Fehlerantwort statt sie als Daten
 * zurückzugeben.
 *
 * Grund (PRODUKTIONSREIFE.md 4.5): `apiFetch(...).then(r => r.json())` liefert
 * bei 403 oder 500 ein `{ error: … }`, und `d.items ?? []` macht daraus eine
 * leere Liste. Der Nutzer sieht dann „keine Einträge" — eine Aussage über
 * seinen Verein, die gar nicht geprüft wurde. Ein Fehler, der wie ein
 * Ergebnis aussieht, ist schlimmer als ein Fehler.
 */
export async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(url, options);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: unknown };
    const message =
      typeof body.error === 'string'
        ? body.error
        : typeof (body.error as { message?: string })?.message === 'string'
          ? (body.error as { message: string }).message
          : `Anfrage fehlgeschlagen (${res.status})`;
    throw new Error(message);
  }
  return (await res.json()) as T;
}
