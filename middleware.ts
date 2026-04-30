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
    // Set bypass cookie and redirect to clean URL
    const response = NextResponse.redirect(url.origin + url.pathname);
    response.cookies.set('vercel-protection-bypass', bypassToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return response;
  }

  // Check if bypass cookie exists – if yes, allow through
  const bypassCookie = request.cookies.get('vercel-protection-bypass');
  if (bypassCookie && bypassCookie.value === BYPASS_TOKEN) {
    return NextResponse.next();
  }

  // Otherwise, continue (Vercel protection will block if active)
  return NextResponse.next();
}
