/**
 * API Authentication Middleware
 * Provides authentication and authorization for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

export interface AuthenticatedRequest extends NextRequest {
  user: User;
  clubId: string;
}

export interface AuthResult {
  user: User;
  clubId: string;
  supabase: ReturnType<typeof createServerClient>;
}

/**
 * Validates the authentication token and returns the authenticated user
 * This is specifically designed for API routes and does NOT support demo mode
 *
 * @throws {Error} Returns 401 response if authentication fails
 */
export async function requireApiAuth(request: NextRequest): Promise<AuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials not configured');
  }

  // Extract auth token from Authorization header
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    throw new Error('No authorization token provided');
  }

  // Create supabase client with request cookies
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookies: Array<{ name: string; value: string }> = [];
        request.cookies.getAll().forEach((cookie) => {
          cookies.push({ name: cookie.name, value: cookie.value });
        });
        return cookies;
      },
      setAll() {
        // No-op for API routes - we don't set cookies in API responses
      },
    },
  });

  // Verify the token and get user
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error('Invalid or expired authentication token');
  }

  // Get the user's club membership
  const { data: membership, error: memberError } = await supabase
    .from('user_club_memberships')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (memberError || !membership) {
    throw new Error('User does not have an active club membership');
  }

  return {
    user,
    clubId: membership.club_id,
    supabase,
  };
}

/**
 * Helper function to create an unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Helper function to create a forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Middleware wrapper that handles authentication errors
 * Usage:
 *
 * export async function GET(request: NextRequest) {
 *   return withApiAuth(request, async ({ user, clubId, supabase }) => {
 *     // Your authenticated logic here
 *     return NextResponse.json({ data: 'success' });
 *   });
 * }
 */
export async function withApiAuth(
  request: NextRequest,
  handler: (auth: AuthResult) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const auth = await requireApiAuth(request);
    return await handler(auth);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return unauthorizedResponse(message);
  }
}

/**
 * Authorization check: Verify user has access to a specific club
 */
export function verifyClubAccess(auth: AuthResult, requestedClubId: string): boolean {
  return auth.clubId === requestedClubId;
}

/**
 * Authorization check: Verify user has a specific role
 */
export async function verifyRole(
  auth: AuthResult,
  requiredRole: 'admin' | 'trainer' | 'member'
): Promise<boolean> {
  const { data: membership } = await auth.supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', auth.user.id)
    .eq('club_id', auth.clubId)
    .single();

  if (!membership) {
    return false;
  }

  // Role hierarchy: admin > trainer > member
  const roleHierarchy = {
    admin: 3,
    trainer: 2,
    member: 1,
  };

  return (
    roleHierarchy[membership.role as keyof typeof roleHierarchy] >= roleHierarchy[requiredRole]
  );
}
