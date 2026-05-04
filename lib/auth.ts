import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

/**
 * Gets authenticated user from Supabase using the server client.
 * Returns the full Supabase User object including user_metadata.
 * Supports demo mode via demo-mode cookie.
 */
async function getAuthenticatedUser(): Promise<User | null> {
  const cookieStore = await cookies();

  // Check for demo mode
  const demoMode = cookieStore.get('demo-mode')?.value === 'true';

  if (demoMode) {
    // Return mock user for demo mode
    return {
      id: 'demo-user-id',
      email: 'demo@swingz.com',
      user_metadata: {
        full_name: 'Demo User',
      },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      app_metadata: {},
    } as User;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not configured. Returning null user.');
    return null;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
            cookieStore.set(name, value, options);
          });
        } catch {
          // Read-only cookie context
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Clears auth cookies and redirects to login.
 * This is a wrapper that re-exports from the Server Action.
 */
export { clearAuthCookiesAndRedirect } from '@/app/actions/auth';

/**
 * Guard: requires authentication. Redirects to /login if not authenticated.
 * Returns the Supabase client (authenticated with JWT for RLS) and the user object.
 * Supports demo mode via demo-mode cookie.
 */
export async function requireAuth() {
  const cookieStore = await cookies();

  // Check for demo mode
  const demoMode = cookieStore.get('demo-mode')?.value === 'true';

  if (demoMode) {
    // Return mock user for demo mode
    const mockUser = {
      id: 'demo-user-id',
      email: 'demo@swingz.com',
      user_metadata: {
        full_name: 'Demo User',
      },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      app_metadata: {},
    } as User;

    // Create a mock supabase client for demo mode
    const mockSupabase = {
      auth: {
        getUser: () => Promise.resolve({ data: { user: mockUser }, error: null }),
      },
      from: (_table: string) => {
        // Mock database queries for demo mode
        return {
          select: (_columns?: string) => ({
            eq: (_column: string, _value: any) => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 'demo-user-id',
                    email: 'demo@swingz.com',
                    full_name: 'Demo User',
                    club_memberships: [
                      {
                        role: 'admin',
                        clubs: {
                          id: 'demo-club-id',
                          name: 'Demo Tennis Club',
                        },
                      },
                    ],
                  },
                  error: null,
                }),
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: 'demo-user-id',
                    email: 'demo@swingz.com',
                    full_name: 'Demo User',
                    club_memberships: [
                      {
                        role: 'admin',
                        clubs: {
                          id: 'demo-club-id',
                          name: 'Demo Tennis Club',
                        },
                      },
                    ],
                  },
                  error: null,
                }),
            }),
          }),
        };
      },
    } as ReturnType<typeof createServerClient>;

    return { supabase: mockSupabase, user: mockUser };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not configured. Falling back to demo mode.');
    const fallbackUser = {
      id: 'demo-user-id',
      email: 'demo@swingz.com',
      user_metadata: { full_name: 'Demo User' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      app_metadata: {},
    } as User;

    const fallbackSupabase = {
      auth: { getUser: () => Promise.resolve({ data: { user: fallbackUser }, error: null }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  id: 'demo-user-id',
                  email: 'demo@swingz.com',
                  full_name: 'Demo User',
                  club_memberships: [
                    { role: 'admin', clubs: { id: 'demo-club-id', name: 'Demo Tennis Club' } },
                  ],
                },
                error: null,
              }),
          }),
        }),
      }),
    } as ReturnType<typeof createServerClient>;

    return { supabase: fallbackSupabase, user: fallbackUser };
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
              cookieStore.set(name, value, options);
            });
          } catch {
            // Read-only cookie context
          }
        },
      },
    });

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
