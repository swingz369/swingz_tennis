export const config = {
  matcher: '/login',
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Use VERCEL_BYPASS_SECRET if available (set in Vercel env), fallback to known token
const BYPASS_TOKEN =
  process.env.VERCEL_BYPASS_SECRET ||
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
  'eM4Aqogfb3L8tlhmZBcdJ2hRGnQyyhF2';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // Check for bypass token in query params
  const bypassToken = url.searchParams.get('bypass');

  if (bypassToken === BYPASS_TOKEN) {
    const response = NextResponse.redirect(url.origin + url.pathname);
    response.cookies.set('vercel-protection-bypass', bypassToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  }

  const bypassCookie = request.cookies.get('vercel-protection-bypass');
  if (bypassCookie && bypassCookie.value === BYPASS_TOKEN) {
    return NextResponse.next();
  }

  // Custom domain tenant resolution
  const hostname = request.headers.get('host')?.split(':')[0] || '';
  const customDomains = process.env.CUSTOM_DOMAINS ? JSON.parse(process.env.CUSTOM_DOMAINS) : {};

  if (customDomains[hostname]) {
    const clubId = customDomains[hostname];
    const response = NextResponse.next();
    response.headers.set('x-tenant-id', clubId);
    response.cookies.set('tenant-club', clubId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
    return response;
  }

  return NextResponse.next();
}
