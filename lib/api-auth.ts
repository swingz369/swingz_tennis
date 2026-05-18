/**
 * API Authentication Middleware for Supabase SSR
 *
 * Role Architecture:
 *   superadmin → club_id = NULL in DB, platform-wide access
 *   admin      → club_id = specific club, manages that club
 *   trainer    → club_id = specific club
 *   member     → club_id = specific club
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';

export interface AuthContext {
  user: User;
  /** SSR context does not have a real session object; use supabase.auth.getSession() if needed */
  session: null;
  supabase: ReturnType<typeof createServerClient<Database>>;
  /** Active club for this request. NULL for superadmin without selected club. */
  clubId: string | null;
  /** Club explicitly chosen by superadmin via cookie */
  selectedClubId?: string;
  role: 'superadmin' | 'admin' | 'trainer' | 'member';
  roles: string[];
  memberships: Array<{ club_id: string | null; role: string }>;
}

/**
 * Build AuthContext from user and request
 */
async function buildAuthContext(
  supabase: ReturnType<typeof createServerClient<Database>>,
  user: User,
  request: NextRequest
): Promise<AuthContext> {
  const { data: membershipsData } = await supabase
    .from('user_club_memberships')
    .select('club_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const memberships: Array<{ club_id: string | null; role: string }> = membershipsData ?? [];

  if (memberships.length === 0) {
    throw new Error('User has no active membership');
  }

  const roleOrder: Record<string, number> = {
    superadmin: 4,
    admin: 3,
    trainer: 2,
    member: 1,
  };

  // Highest role wins — track which membership granted it
  let effectiveRole = memberships[0].role as 'superadmin' | 'admin' | 'trainer' | 'member';
  let effectiveMembership = memberships[0];

  for (let i = 1; i < memberships.length; i++) {
    const m = memberships[i];
    const role = m.role as keyof typeof roleOrder;
    if ((roleOrder[role] ?? 0) > (roleOrder[effectiveRole] ?? 0)) {
      effectiveRole = role as 'superadmin' | 'admin' | 'trainer' | 'member';
      effectiveMembership = m;
    }
  }

  // Superadmin: no club by default — can select one via cookie for admin actions
  let selectedClubId: string | undefined;
  let effectiveClubId: string | null = null;

  if (effectiveRole === 'superadmin') {
    const cookieValue = request.cookies.get(ADMIN_CLUB_COOKIE)?.value;
    if (cookieValue) {
      const { data: clubCheck } = await supabase
        .from('clubs')
        .select('id')
        .eq('id', cookieValue)
        .maybeSingle();
      if (clubCheck) {
        selectedClubId = cookieValue;
        effectiveClubId = cookieValue;
      }
    }
  } else {
    // effectiveClubId comes from the membership that granted the effective role
    effectiveClubId = effectiveMembership.club_id ?? null;
  }

  return {
    user,
    session: null,
    supabase,
    clubId: effectiveClubId,
    selectedClubId,
    role: effectiveRole,
    roles: memberships.map((m) => m.role),
    memberships,
  };
}

/**
 * Get authenticated user from Supabase session
 */
export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials not configured');
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(_cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        // No-op in request context (read-only)
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('No valid session found. Please log in.');
  }

  return await buildAuthContext(supabase, user, request);
}

/**
 * Authorization check — superadmin always passes
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
  return (roleHierarchy[auth.role] ?? 0) >= (roleHierarchy[requiredRole] ?? 0);
}

/**
 * Verify user has access to a specific club.
 * Superadmin has access to ALL clubs (even without cookie).
 */
export function verifyClubAccess(auth: AuthContext, requestedClubId: string): boolean {
  if (auth.role === 'superadmin') return true;
  return auth.clubId === requestedClubId;
}

export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function withAuth(
  request: NextRequest,
  handler: (auth: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const auth = await requireAuth(request);
    return await handler(auth);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return unauthorizedResponse(error instanceof Error ? error.message : 'Authentication failed');
  }
}

// Backward compatibility aliases
export const withApiAuth = withAuth;
export const requireApiAuth = requireAuth;
