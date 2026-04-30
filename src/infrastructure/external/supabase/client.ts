/* eslint-disable @typescript-eslint/no-explicit-any */
import { createBrowserClient } from '@supabase/ssr';

export const createClient = () => {
  // Demo mode check
  const hasDemoMode = document.cookie.split(';').some((c) => c.trim().startsWith('demo-mode='));

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
        signInWithPassword: async () => ({
          data: {
            user: {
              id: 'demo-user-123',
              email: 'demo@swingz.com',
              user_metadata: { full_name: 'Demo User' },
            },
          },
          error: null,
        }),
        getSession: async () => ({
          data: {
            session: {
              user: {
                id: 'demo-user-123',
                email: 'demo@swingz.com',
                user_metadata: { full_name: 'Demo User' },
              },
            },
          },
        }),
        signOut: async () => ({ error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve([
              { club_id: 'demo-club', clubs: { id: 'demo-club', name: 'Demo Tennis Club' } },
            ]),
        }),
      }),
    } as any;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
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
          signInWithPassword: async () => ({
            data: {
              user: {
                id: 'demo-user-123',
                email: 'demo@swingz.com',
                user_metadata: { full_name: 'Demo User' },
              },
            },
            error: null,
          }),
          getSession: async () => ({
            data: {
              session: {
                user: {
                  id: 'demo-user-123',
                  email: 'demo@swingz.com',
                  user_metadata: { full_name: 'Demo User' },
                },
              },
            },
          }),
          signOut: async () => ({ error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () =>
              Promise.resolve([
                { club_id: 'demo-club', clubs: { id: 'demo-club', name: 'Demo Tennis Club' } },
              ]),
          }),
        }),
      } as any;
    }
    throw new Error(
      'Supabase URL and Anon Key are required. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }

  // No cookies option needed for browser client – Next.js 15 handles automatically
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};
