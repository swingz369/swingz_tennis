// middleware.ts (Root-Level)

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routen die OHNE Login erreichbar sind
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/auth/callback',
  '/auth/confirm',
  '/forgot-password',
  '/reset-password',
  '/', // Landing Page
  '/landing', // Also available at /landing
  '/about',
  '/contact',
  '/api/auth/login',
  '/api/auth/logout',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Test-Mode für Playwright E2E-Tests: Auth-Check via Cookie überspringen
  const testModeCookie = request.cookies.get('swingz_test_mode');
  if (testModeCookie?.value === 'true') {
    return response;
  }

  // Supabase Session refreshen
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set({ name, value, ...options })
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set({ name, value, ...options })
          );
        },
      },
    }
  );

  // WICHTIG: getUser() nicht getSession() – verifiziert den Token!
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // 1. Öffentliche Routen → durchlassen
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  if (isPublic) return response;

  // 2. Nicht eingeloggt → Login
  if (error || !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Eingeloggt auf /login → Dashboard
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // ALLE Routen außer Static Files, Images, Favicon
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
