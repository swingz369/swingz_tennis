import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase'; // generierte Typen

// Client für normale App-Nutzung (RLS greift!)
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase URL and Anon Key are required. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions = {}) {
        cookieStore.set(name, value, {
          ...options,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      },
      remove(name: string) {
        cookieStore.delete(name);
      },
    },
  });
}

// Service Role Client – ONLY für Admin-Operationen die RLS bypassen müssen
export async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Supabase URL and Service Role Key are required. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseServiceKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions = {}) {
        cookieStore.set(name, value, {
          ...options,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      },
      remove(name: string) {
        cookieStore.delete(name);
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
