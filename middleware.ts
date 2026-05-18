// middleware.ts (Root-Level)

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Generate a cryptographically secure random hex string
 * Uses Web Crypto API (available in Edge Runtime)
 */
function generateCSRFToken(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const CSRF_TOKEN_COOKIE = 'csrf-token';
const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

// API routes excluded from CSRF (use signature-based verification)
const CSRF_EXCLUDED_PATHS = [
  '/api/webhooks',
  '/api/csrf-token',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/debug',
  '/api/health',
];

/**
 * Timing-safe string comparison for CSRF token validation
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validate CSRF token from request headers against cookie
 */
function validateCSRFTokenMiddleware(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;
  if (!cookieToken) return false;

  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  if (!headerToken) return false;

  return timingSafeEqual(cookieToken, headerToken);
}

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

  // 2. CSRF-Schutz für API-Mutationen (POST/PUT/PATCH/DELETE)
  const isApiMutation =
    pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
    !CSRF_EXCLUDED_PATHS.some((p) => pathname.startsWith(p));
  if (isApiMutation && !validateCSRFTokenMiddleware(request)) {
    return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 });
  }

  // 3. Nicht eingeloggt → Login
  if (error || !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Eingeloggt auf /login → Dashboard
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 5. Setze CSRF-Token-Cookie für Page-Loads (GET auf Nicht-API-Routen)
  if (
    !pathname.startsWith('/api/') &&
    request.method === 'GET' &&
    !request.cookies.get(CSRF_TOKEN_COOKIE)
  ) {
    const csrfToken = generateCSRFToken(CSRF_TOKEN_LENGTH);
    response.cookies.set(CSRF_TOKEN_COOKIE, csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });
  }

  return response;
}

export const config = {
  matcher: [
    // ALLE Routen außer Static Files, Images, Favicon
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
