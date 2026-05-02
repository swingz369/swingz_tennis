import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // NEVER intercept static files or API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') // files with extensions
  ) {
    return NextResponse.next();
  }

  // For now, just set a default locale cookie if not present
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (!cookieLocale) {
    const response = NextResponse.next();
    response.cookies.set('NEXT_LOCALE', 'de', { path: '/' });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Only run for app routes, not static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
