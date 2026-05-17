import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

/**
 * Creates a Supabase server client with cookie access.
 * Shared helper to avoid code duplication between requireAuth and requireAuthApi.
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
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
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
    console.warn('Supabase credentials not configured.');
    redirect('/login');
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('Auth error in requireAuth:', error);
      redirect('/login');
    }

    return { supabase, user };
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    redirect('/login');
  }
}

// Export both names for compatibility
export const getUserFromCookies = getAuthenticatedUser;

/**
 * API Route Auth Guard — for use in app/api/** /route.ts handlers.
 * Uses createClient() from @/lib/supabase/server (consistent with all API routes).
 * Returns { supabase, user } on success, or NextResponse 401 on failure (NO redirect).
 *
 * Usage:
 *   const auth = await requireAuthApi();
 *   if (auth.error) return auth.error;
 *   const { supabase, user } = auth;
 */
export async function requireAuthApi() {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient(cookieStore);

  if (!supabase) {
    return {
      error: new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      };
    }

    return { supabase, user };
  } catch (err) {
    console.error('requireAuthApi failed:', err);
    return {
      error: new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }
}
