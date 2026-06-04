/**
 * lib/api-auth.ts — API Route Authentication & Authorization
 *
 * ⚠️  DOMAIN: Use ONLY in API routes (app/api/** /route.ts).
 *
 * For Server Components (pages, layouts), use lib/auth.ts instead.
 *
 * ┌─────────────────────────┬────────────────────┬──────────────────────┐
 * │ Context                 │ lib/auth.ts        │ This file            │
 * ├─────────────────────────┼────────────────────┼──────────────────────┤
 * │ Cookie source           │ cookies()          │ request.cookies      │
 * │ Auth failure behavior   │ redirect('/login') │ NextResponse 401     │
 * │ Return value            │ { supabase, user } │ AuthContext (role,    │
 * │                         │                    │  clubId, memberships) │
 * │ Role resolution         │ ❌ Manual only     │ ✅ Built-in           │
 * │ Club context            │ ❌ Manual only     │ ✅ Built-in           │
 * └─────────────────────────┴────────────────────┴──────────────────────┘
 *
 * Role Architecture:
 *   superadmin → club_id = NULL in DB, platform-wide access
 *   admin      → club_id = specific club, manages that club
 *   trainer    → club_id = specific club
 *   member     → club_id = specific club
 *
 * Exports:
 *   requireAuth(request)    — Resolves full AuthContext (throws on failure)
 *   withAuth(request, fn)   — Wraps handler with auth + error handling
 *   withApiAuth             — Alias for withAuth
 *   verifyRole(auth, role)  — Role hierarchy check
 *   verifyClubAccess(...)   — Club-scoped access check
 *   unauthorizedResponse()  — 401 JSON helper
 *   forbiddenResponse()     — 403 JSON helper
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';
import { hasRole, getHighestRole } from '@/lib/auth-common';

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
    .eq('is_active', true)
    .order('club_id');

  const memberships: Array<{ club_id: string | null; role: string }> = membershipsData ?? [];

  if (memberships.length === 0) {
    throw new Error('User has no active membership');
  }

  // Highest role wins — track which membership granted it
  const effectiveRole = getHighestRole(memberships.map((m) => m.role));
  const effectiveMembership = memberships.find((m) => m.role === effectiveRole) || memberships[0];

  // Superadmin/Admin: can select club via cookie
  let selectedClubId: string | undefined;
  let effectiveClubId: string | null = null;

  const cookieValue = request.cookies.get(ADMIN_CLUB_COOKIE)?.value;
  if (effectiveRole === 'superadmin') {
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
  } else if (effectiveRole === 'admin') {
    // Admin: prefer cookie-selected club if admin has access,
    // otherwise fall back to first admin membership
    const adminMemberships = memberships.filter((m) => m.role === 'admin');
    if (cookieValue && adminMemberships.some((m) => m.club_id === cookieValue)) {
      selectedClubId = cookieValue;
      effectiveClubId = cookieValue;
    } else {
      effectiveClubId = effectiveMembership.club_id ?? null;
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
  return hasRole(auth.role, requiredRole);
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
