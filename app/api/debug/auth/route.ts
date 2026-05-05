import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * DEBUG ENDPOINT - Shows auth state and cookies
 * Access: https://swingz.vercel.app/api/debug/auth
 *
 * SECURITY FIX: Only available in development environment
 */
export async function GET(_request: NextRequest) {
  // SECURITY FIX: Disable in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  // Find Supabase auth cookies
  const authCookies = allCookies.filter(
    (c) => c.name.includes('sb-') || c.name.includes('supabase')
  );

  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    cookies: {
      total: allCookies.length,
      authCookies: authCookies.length,
      names: allCookies.map((c) => c.name),
      authCookieDetails: authCookies.map((c) => ({
        name: c.name,
        valueLength: c.value.length,
        valuePreview: c.value.substring(0, 20) + '...',
      })),
    },
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    vercel: {
      url: process.env.VERCEL_URL,
      env: process.env.VERCEL_ENV,
    },
  };

  // Try to get user
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      });

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      debugInfo.auth = {
        hasUser: !!user,
        userId: user?.id,
        email: user?.email,
        error: error?.message,
      };

      if (user) {
        // Try to get memberships
        const { data: memberships, error: membershipError } = await supabase
          .from('user_club_memberships')
          .select('role, club_id, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true);

        debugInfo.memberships = {
          count: memberships?.length || 0,
          roles: memberships?.map((m) => m.role) || [],
          error: membershipError?.message,
        };
      }
    } catch (err) {
      debugInfo.auth = {
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  } else {
    debugInfo.auth = {
      error: 'Supabase credentials not configured',
    };
  }

  return NextResponse.json(debugInfo, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
