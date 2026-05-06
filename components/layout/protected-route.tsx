'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

const publicPaths = ['/login'];

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for demo mode cookie only in development
    if (process.env.NODE_ENV === 'development') {
      const cookies = document.cookie.split(';');
      const hasDemoMode = cookies.some((c) => c.trim().startsWith('demo-mode='));

      if (hasDemoMode) {
        console.warn('[DEV] Demo mode active - bypassing authentication');
        const demoUser: User = {
          id: 'demo-user-123',
          email: 'demo@swingz.com',
          user_metadata: { full_name: 'Demo User' },
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        };
        setUser(demoUser);
        setLoading(false);
        return;
      }
    }

    // Normal Supabase auth flow
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) {
              return parts.pop()?.split(';').shift();
            }
            return undefined;
          },
          set(name: string, value: string, options: any) {
            let cookie = `${name}=${value}`;
            if (options?.maxAge) cookie += `; max-age=${options.maxAge}`;
            cookie += `; path=${options?.path || '/'}`;
            cookie += `; SameSite=${options?.sameSite || 'Lax'}`;
            if (window.location.protocol === 'https:') cookie += '; Secure';
            document.cookie = cookie;
          },
          remove(name: string, options: any) {
            document.cookie = `${name}=; path=${options?.path || '/'}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          },
        },
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return { user, loading };
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && !publicPaths.includes(pathname)) {
      router.push('/login');
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  if (!user && !publicPaths.includes(pathname)) {
    return null;
  }

  return <>{children}</>;
}
