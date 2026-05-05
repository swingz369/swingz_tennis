/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieHandler = {
  get(name: string): string | undefined;
  set(name: string, value: string, options?: any): void;
  remove(name: string, options?: any): void;
};

let cookieHandler: CookieHandler | null = null;

async function getCookieHandler(): Promise<CookieHandler> {
  if (cookieHandler) return cookieHandler;

  const cookieStore = await cookies();

  cookieHandler = {
    get(name: string) {
      return cookieStore.get(name)?.value;
    },
    set(name: string, value: string, options: any = {}) {
      try {
        (cookieStore as any).set(name, value, options);
      } catch {
        // Silently ignore errors when trying to set cookies in a read-only context
      }
    },
    remove(name: string, options: any = {}) {
      try {
        (cookieStore as any).delete(name, options);
      } catch {
        // Silently ignore errors when trying to delete cookies in a read-only context
      }
    },
  };

  return cookieHandler;
}

export const createClient = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase URL and Anon Key are required. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookies().get(name)?.value;
      },
      set(name: string, value: string, options: any = {}) {
        cookies().set(name, value, options);
      },
      remove(name: string, options: any = {}) {
        cookies().delete(name, options);
      },
    },
  });
};
