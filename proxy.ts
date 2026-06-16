// proxy.ts (Root-Level) — Next.js 16 replacement for middleware.ts

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

const csrfCookieOptions = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60, // 1 hour
  path: '/',
};

// API routes excluded from CSRF (use signature-based verification)
const CSRF_EXCLUDED_PATHS = [
  '/api/webhooks',
  '/api/csrf-token',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',

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
function validateCSRFTokenProxy(request: NextRequest): boolean {
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
  '/support', // Support page — public (DSGVO)
  '/datenschutz', // Privacy policy — public (DSGVO §5)
  '/impressum', // Legal notice — public (TMG §5)
  '/privacy', // Privacy summary — public
  '/terms', // Terms of service — public
  '/trial-training', // Public trial booking — no auth required
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/manifest.json', // PWA manifest — must be public for browser parsing
  '/sw.js', // Service Worker
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // 1. Öffentliche Routen → durchlassen (vor Auth & CSRF)
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  // 2. CSRF-Token-Cookie SOFORT setzen (bevor Supabase setAll die Response ersetzen kann)
  //    Das Cookie wird auf Page-Load-GETs gesetzt, damit der Browser es bei POSTs mitschickt.
  const needsCSRFCookie =
    !isPublic &&
    !pathname.startsWith('/api/') &&
    request.method === 'GET' &&
    !request.cookies.get(CSRF_TOKEN_COOKIE);

  let csrfTokenValue: string | undefined;

  if (needsCSRFCookie) {
    csrfTokenValue = generateCSRFToken(CSRF_TOKEN_LENGTH);
    response.cookies.set(CSRF_TOKEN_COOKIE, csrfTokenValue, csrfCookieOptions);
  }

  // 3. Supabase Session refreshen
  //    WICHTIG: setAll erstellt eine NEUE Response – CSRF-Cookie muss übertragen werden!
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
          // CSRF-Cookie auf die neue Response übertragen
          if (csrfTokenValue) {
            response.cookies.set(CSRF_TOKEN_COOKIE, csrfTokenValue, csrfCookieOptions);
          }
        },
      },
    }
  );

  // WICHTIG: getUser() nicht getSession() – verifiziert den Token!
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // 4. Öffentliche Routen → durchlassen
  if (isPublic) return response;

  // 5. CSRF-Schutz für API-Mutationen (POST/PUT/PATCH/DELETE)
  const isApiMutation =
    pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
    !CSRF_EXCLUDED_PATHS.some((p) => pathname.startsWith(p));
  if (isApiMutation && !validateCSRFTokenProxy(request)) {
    const cookieToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;
    const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
    console.warn(
      `[CSRF] 403 on ${pathname} — cookie: ${cookieToken ? 'present' : 'MISSING'}, header: ${headerToken ? 'present' : 'MISSING'}`
    );
    return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 });
  }

  // 6. Nicht eingeloggt → Login
  if (error || !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 7. Eingeloggt auf /login → Dashboard
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
