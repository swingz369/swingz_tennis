/**
 * API Authentication Middleware for Supabase SSR
 * Uses Supabase's built-in session handling via cookies
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthContext {
  user: User;
  session: Session;
  supabase: ReturnType<typeof createServerClient>;
  clubId: string;
  role: 'superadmin' | 'admin' | 'trainer' | 'member';
  memberships: Array<{ club_id: string; role: string }>;
}

/**
 * Get authenticated user from Supabase session
 * Supports both Cookie-based (SSR) and Bearer Token (API clients)
 * Throws error if authentication fails
 */
export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials not configured');
  }

  // Strategy 1: Try cookie-based session (SSR, same-site)
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (session && session.user) {
    // Cookie-based session found
    return await buildAuthContext(supabase, session.user);
  }

  // Strategy 2: Try Bearer token from Authorization header (API clients, dev tools)
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (bearerToken && supabaseServiceKey) {
    // Validate token using admin API (service role)
    const adminSupabase = createServerClient(supabaseUrl, supabaseServiceKey, {
      cookies: { get: () => null, set: () => {}, remove: () => {} },
    });

    try {
      const {
        data: { user },
        error: tokenError,
      } = await adminSupabase.auth.getUser(bearerToken);
      if (!tokenError && user) {
        // Create a new client for this user (anon key) for subsequent DB calls
        const userSupabase = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookies: { get: () => null, set: () => {}, remove: () => {} },
        });
        // Set the session manually
        await userSupabase.auth.setSession({ access_token: bearerToken, refresh_token: '' });
        return await buildAuthContext(userSupabase, user);
      }
    } catch (e) {
      console.log('Bearer token validation failed:', e);
    }
  }

  // Strategy 3: Check for demo mode cookie
  const hasDemoMode = request.cookies.get('demo-mode');
  if (hasDemoMode) {
    // Return mock auth for development
    return {
      user: {
        id: 'demo-user',
        email: 'demo@swingz.com',
        user_metadata: { full_name: 'Demo User' },
      } as any,
      session: { access_token: 'demo', refresh_token: '' } as any,
      supabase: {} as any,
      clubId: 'demo-club',
      role: 'member' as const,
      memberships: [{ club_id: 'demo-club', role: 'member' }],
    };
  }

  throw new Error('No valid session found. Please log in.');
}

/**
 * Helper: Build AuthContext from user
 */
async function buildAuthContext(
  supabase: ReturnType<typeof createServerClient>,
  user: any
): Promise<AuthContext> {
  const { data: memberships, error: membershipsError } = await supabase
    .from('user_club_memberships')
    .select('club_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (membershipsError) {
    console.error('Failed to fetch memberships:', membershipsError);
    throw new Error('Failed to fetch user permissions');
  }

  if (!memberships || memberships.length === 0) {
    throw new Error('User has no active club membership');
  }

  const roleHierarchy: Record<string, number> = {
    superadmin: 4,
    admin: 3,
    trainer: 2,
    member: 1,
  };

  let highestRole = memberships[0].role as 'superadmin' | 'admin' | 'trainer' | 'member';
  for (const m of memberships) {
    if (roleHierarchy[m.role] > roleHierarchy[highestRole]) {
      highestRole = m.role as 'superadmin' | 'admin' | 'trainer' | 'member';
    }
  }

  const clubId = memberships[0].club_id;

  return {
    user,
    session: { access_token: '', refresh_token: '' } as any, // Not needed for auth context
    supabase,
    clubId,
    role: highestRole,
    memberships,
  };
}

// Alias for backward compatibility
export const getAuthContext = requireAuth;

/**
 * Authorization check: verify user has required role
 */
export async function verifyRole(
  auth: AuthContext,
  requiredRole: 'superadmin' | 'admin' | 'trainer' | 'member'
): Promise<boolean> {
  const roleHierarchy: Record<string, number> = {
    superadmin: 4,
    admin: 3,
    trainer: 2,
    member: 1,
  };
  return roleHierarchy[auth.role] >= roleHierarchy[requiredRole];
}

/**
 * Verify user has access to specific club
 * Superadmin has access to all clubs automatically
 */
export function verifyClubAccess(auth: AuthContext, requestedClubId: string): boolean {
  if (auth.role === 'superadmin') return true;
  return auth.clubId === requestedClubId;
}

/**
 * Check if user is superadmin
 */
export function isSuperadmin(auth: AuthContext): boolean {
  return auth.role === 'superadmin';
}

/**
 * Check if user is admin or superadmin
 */
export function isAdminOrAbove(auth: AuthContext): boolean {
  return auth.role === 'superadmin' || auth.role === 'admin';
}

/**
 * Helper to create 401 response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Helper to create 403 response
 */
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Wrapper for API routes with auth
 */
export async function withAuth(
  request: NextRequest,
  handler: (auth: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    return await handler(auth);
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return unauthorizedResponse(message);
  }
}

// ==========================================
// BACKWARD COMPATIBILITY (deprecated)
// Use `withAuth` or `requireAuth` in new code
// ==========================================

/**
 * @deprecated Use `withAuth` instead
 */
export async function withApiAuth(
  request: NextRequest,
  handler: (auth: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, handler);
}

/**
 * @deprecated Use `requireAuth` instead
 */
export async function requireApiAuth(request: NextRequest): Promise<AuthContext> {
  return requireAuth(request);
}
