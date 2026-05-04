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

export type UserRole = 'superadmin' | 'admin' | 'trainer' | 'member';

export interface AuthResult {
  user: User;
  clubId: string;
  supabase: ReturnType<typeof createServerClient>;
  role?: UserRole;
  memberships?: Array<{ club_id: string; role: string }>;
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

   // Get the user's club memberships (all active memberships)
   const { data: memberships, error: membershipsError } = await supabase
     .from('user_club_memberships')
     .select('club_id, role')
     .eq('user_id', user.id)
     .eq('is_active', true);

   if (membershipsError) {
     throw new Error('Failed to fetch user memberships');
   }

    // If no memberships found, check if user is superadmin via a separate query
    // (Superadmin may not have club-specific memberships in some setups)
    let isSuperadmin = false;
    if (!memberships || memberships.length === 0) {
      // Try to detect superadmin from a dedicated admin table or JWT claims
      // For now, we'll assume no membership = no access
      // This can be extended later with proper superadmin detection
      throw new Error('User does not have an active club membership');
    }

    // Determine highest role across all memberships
    const roleHierarchy: Record<string, number> = {
      superadmin: 4,
      admin: 3,
      trainer: 2,
      member: 1,
    };

    let highestRole = memberships[0].role;
    for (const m of memberships) {
      if (roleHierarchy[m.role] > roleHierarchy[highestRole]) {
        highestRole = m.role;
      }
    }

    isSuperadmin = highestRole === 'superadmin';

    // For superadmin, use the first club's context (they'll have full access via RLS)
    // For others, require at least one membership and use that club context
    const clubId = memberships[0].club_id;

    return {
      user,
      clubId,
      supabase,
      role: highestRole as UserRole,
      memberships,
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
 * Authorization check: Verify user has a specific role (uses cached role from requireApiAuth)
 */
export async function verifyRole(
  auth: AuthResult,
  requiredRole: 'superadmin' | 'admin' | 'trainer' | 'member'
): Promise<boolean> {
  // If auth.role is already set from requireApiAuth, use hierarchy check directly (no DB query)
  if (auth.role) {
    const roleHierarchy: Record<UserRole, number> = {
      superadmin: 4,
      admin: 3,
      trainer: 2,
      member: 1,
    };
    return roleHierarchy[auth.role] >= roleHierarchy[requiredRole];
  }

  // Fallback: query DB if role not set (should not happen with standard requireApiAuth)
  const { data: membership } = await auth.supabase
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', auth.user.id)
    .eq('club_id', auth.clubId)
    .single();

  if (!membership) {
    return false;
  }

  const userRole = membership.role as UserRole;
  auth.role = userRole;

  const roleHierarchy: Record<UserRole, number> = {
    superadmin: 4,
    admin: 3,
    trainer: 2,
    member: 1,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export function isSuperadmin(auth: AuthResult): boolean {
  return auth.role === 'superadmin';
}

export function isAdminOrAbove(auth: AuthResult): boolean {
  return auth.role === 'superadmin' || auth.role === 'admin';
}
