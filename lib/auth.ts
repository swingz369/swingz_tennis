/**
 * lib/auth.ts — Server Component Authentication
 *
 * ⚠️  DOMAIN: Use ONLY in Server Components (pages, layouts).
 *
 * For API routes (app/api/** /route.ts), use lib/api-auth.ts instead.
 *
 * ┌─────────────────────────┬────────────────────┬──────────────────────┐
 * │ Context                 │ This file          │ lib/api-auth.ts      │
 * ├─────────────────────────┼────────────────────┼──────────────────────┤
 * │ Cookie source           │ cookies()          │ request.cookies      │
 * │ Auth failure behavior   │ redirect('/login') │ NextResponse 401     │
 * │ Return value            │ { supabase, user } │ AuthContext (role,    │
 * │                         │                    │  clubId, memberships) │
 * │ Role resolution         │ ❌ Manual only     │ ✅ Built-in           │
 * │ Club context            │ ❌ Manual only     │ ✅ Built-in           │
 * └─────────────────────────┴────────────────────┴──────────────────────┘
 *
 * Exports:
 *   requireAuth()           — Guard for pages/layouts (redirects on failure)
 *   getAuthenticatedUser()  — Get user without supabase client
 *   getUserFromCookies      — Alias for getAuthenticatedUser
 *   clearAuthCookiesAndRedirect — Re-exported from @/app/actions/auth
 *
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth');

/**
 * Creates a Supabase server client with cookie access.
 */
async function createSupabaseServerClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: { [key: string]: unknown };
        }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            });
          });
        } catch {
          // Read-only cookie context
        }
      },
    },
  });
}

/**
 * Gets authenticated user from Supabase using the server client.
 * Returns the full Supabase User object including user_metadata.
 */
async function getAuthenticatedUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient(cookieStore);
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Clears auth cookies and redirects to login.
 */
export { clearAuthCookiesAndRedirect } from '@/app/actions/auth';

/**
 * Guard: requires authentication. Redirects to /login if not authenticated.
 * Returns the Supabase client (authenticated with JWT for RLS) and the user object.
 */
export async function requireAuth() {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient(cookieStore);

  if (!supabase) {
    log.warn('Supabase credentials not configured');
    redirect('/login');
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      log.error('Auth error in requireAuth', error instanceof Error ? error : undefined);
      redirect('/login');
    }

    return { supabase, user };
  } catch (err) {
    log.error(
      'Failed to initialize Supabase client',
      err instanceof Error ? err : new Error(String(err))
    );
    redirect('/login');
  }
}

// Export both names for compatibility
export const getUserFromCookies = getAuthenticatedUser;
