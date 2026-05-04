/**
 * CSRF Protection Implementation
 *
 * Provides Cross-Site Request Forgery protection for API routes
 * Uses double-submit cookie pattern with SameSite cookies
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

const CSRF_TOKEN_COOKIE = 'csrf-token';
const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a new CSRF token
 */
export async function generateCSRFToken(): Promise<string> {
  const token = randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  const cookieStore = await cookies();

  // Set the CSRF token as a cookie
  cookieStore.set(CSRF_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60, // 1 hour
    path: '/',
  });

  return token;
}

/**
 * Validate CSRF token from request
 * Compares token from header with token from cookie
 */
export async function validateCSRFToken(request: NextRequest): Promise<boolean> {
  const cookieStore = await cookies();

  // Get token from cookie
  const cookieToken = cookieStore.get(CSRF_TOKEN_COOKIE)?.value;
  if (!cookieToken) {
    return false;
  }

  // Get token from header
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  if (!headerToken) {
    return false;
  }

  // Compare tokens using constant-time comparison to prevent timing attacks
  return timingSafeEqual(cookieToken, headerToken);
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Middleware to require CSRF token for state-changing requests
 * Only applies to POST, PUT, PATCH, DELETE requests
 */
export async function withCSRFProtection(
  request: NextRequest,
  handler: () => Promise<Response>
): Promise<Response> {
  const method = request.method;

  // Only check CSRF for state-changing methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const isValid = await validateCSRFToken(request);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 });
    }
  }

  return handler();
}

/**
 * API endpoint to get a new CSRF token
 * Should be called before making state-changing requests
 *
 * Usage from client:
 * const response = await fetch('/api/csrf-token');
 * const { token } = await response.json();
 *
 * Then include token in subsequent requests:
 * fetch('/api/some-endpoint', {
 *   method: 'POST',
 *   headers: { 'X-CSRF-Token': token },
 *   body: JSON.stringify(data)
 * });
 */
export async function getCSRFTokenHandler(): Promise<Response> {
  const token = await generateCSRFToken();

  return NextResponse.json({
    token,
    headerName: CSRF_TOKEN_HEADER,
  });
}
