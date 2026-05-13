// middleware.ts (Root-Level)

import { createClient } from '@supabase/ssr';
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
  '/about',
  '/contact',
];

// Routen die nur bestimmte Rollen sehen dürfen
const ROLE_PROTECTED_ROUTES: Record<string, string[]> = {
  '/superadmin': ['superadmin'],
  '/admin': ['superadmin', 'admin'],
  '/trainer': ['superadmin', 'admin', 'trainer'],
  '/dashboard': ['superadmin', 'admin', 'trainer', 'member'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  // Supabase Session refreshen
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value, options)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
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

  // 3. Rolle aus JWT-Claims lesen (muss in Supabase Auth konfiguriert sein)
  const userRole = (user.user_metadata?.role as string) ?? 'member';

  // 4. Rollen-basierte Route Protection
  for (const [protectedPath, allowedRoles] of Object.entries(ROLE_PROTECTED_ROUTES)) {
    if (pathname.startsWith(protectedPath)) {
      if (!allowedRoles.includes(userRole)) {
        // Falsche Rolle → Dashboard (nicht Fehlerseite)
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  // 5. Eingeloggt auf /login → Dashboard
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
