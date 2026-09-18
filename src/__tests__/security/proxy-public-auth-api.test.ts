/**
 * Regression: Auth-Endpunkte, die ein NICHT eingeloggter Nutzer aufruft, müssen
 * durch proxy.ts kommen. Öffentliche Seiten setzen kein CSRF-Cookie — ohne
 * Eintrag in PUBLIC_ROUTES lief „Passwort zurücksetzen" in
 * „Invalid or missing CSRF token" (403).
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  }),
}));

const { proxy } = await import('@/proxy');

const PUBLIC_POST_ENDPOINTS = [
  '/api/auth/forgot-password',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/register-interest',
  '/api/auth/join',
];

describe('proxy: öffentliche Auth-API ohne CSRF-Cookie', () => {
  it.each(PUBLIC_POST_ENDPOINTS)('%s wird nicht mit 403/401 abgewiesen', async (path) => {
    const res = await proxy(
      new NextRequest(`http://localhost${path}`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(res.status).toBe(200);
  });
});
