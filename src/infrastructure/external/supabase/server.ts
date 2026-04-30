/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const createClient = async () => {
  // Check for demo mode cookie (set by login page)
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');

  if (hasDemoMode) {
    console.log('✅ Demo mode active - returning mock Supabase client');
    return {
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: 'demo-user-123',
              email: 'demo@swingz.com',
              user_metadata: { full_name: 'Demo User' },
              aud: 'authenticated',
              role: 'authenticated',
            },
          },
        }),
        signOut: async () => ({ error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            limit: () =>
              Promise.resolve([
                { club_id: 'demo-club', clubs: { id: 'demo-club', name: 'Demo Tennis Club' } },
              ]),
          }),
        }),
      }),
    } as any;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Development fallback: use mock client if no env vars
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Supabase credentials not set. Running in development demo mode.');
      return {
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: 'demo-user-123',
                email: 'demo@swingz.com',
                user_metadata: { full_name: 'Demo User' },
                aud: 'authenticated',
                role: 'authenticated',
              },
            },
          }),
          signOut: async () => ({ error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              limit: () =>
                Promise.resolve([
                  { club_id: 'demo-club', clubs: { id: 'demo-club', name: 'Demo Tennis Club' } },
                ]),
            }),
          }),
        }),
      } as any;
    }
    throw new Error(
      'Supabase URL and Anon Key are required. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any = {}) {
        (cookieStore as any).set(name, value, options);
      },
      remove(name: string, options: any = {}) {
        (cookieStore as any).delete(name, options);
      },
    },
  });
};
