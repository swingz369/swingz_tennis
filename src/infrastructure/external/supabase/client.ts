import { createBrowserClient, type CookieOptions } from '@supabase/ssr';

export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase URL and Anon Key are required. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }

  // Guard against server-side execution during SSR / static generation
  // where document and window are not available.
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get() {
          return undefined;
        },
        set() {
          // noop during SSR
        },
        remove() {
          // noop during SSR
        },
      },
    });
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        // Read cookie from document.cookie
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
          return parts.pop()?.split(';').shift();
        }
        return undefined;
      },
      set(name: string, value: string, options: CookieOptions) {
        // Set cookie with proper security settings
        let cookie = `${name}=${value}`;

        if (options?.maxAge) {
          cookie += `; max-age=${options.maxAge}`;
        }

        cookie += `; path=${options?.path || '/'}`;
        cookie += `; SameSite=${options?.sameSite || 'Lax'}`;

        // Only set secure flag in production (HTTPS)
        if (window.location.protocol === 'https:') {
          cookie += '; Secure';
        }

        document.cookie = cookie;
      },
      remove(name: string, options: CookieOptions) {
        // Remove cookie by setting expiration to past
        const cookie = `${name}=; path=${options?.path || '/'}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        document.cookie = cookie;
      },
    },
  });
};
