import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // NEVER intercept static files or API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') // files with extensions
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // Set default locale cookie if not present
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (!cookieLocale) {
    response.cookies.set('NEXT_LOCALE', 'de', { path: '/' });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
