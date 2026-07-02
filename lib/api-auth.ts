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
 *   owner      → Plattformbetreiber, club_id = NULL, Vollzugriff
 *   superadmin → Tennisschule-Chef, club_id = NULL, sieht verwaltete Clubs
 *   admin      → Vereinsadmin, club_id = specific club
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
import { ADMIN_CLUB_COOKIE, ADMIN_CLUB_COOKIE_MAX_AGE } from '@/lib/cookies';
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
  role: 'owner' | 'superadmin' | 'admin' | 'trainer' | 'member';
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
  // FIX P0-3: Always use the role from the membership that matches the effective club,
  // not the global highest. This prevents role-bleeding across clubs.
  const effectiveRole = getHighestRole(memberships.map((m) => m.role));
  const effectiveMembership = memberships.find((m) => m.role === effectiveRole) || memberships[0];

  // Superadmin/Admin: can select club via cookie
  let selectedClubId: string | undefined;
  let effectiveClubId: string | null = null;

  const cookieValue = request.cookies.get(ADMIN_CLUB_COOKIE)?.value;
  if (effectiveRole === 'owner' || effectiveRole === 'superadmin') {
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
    // Admin: honor ADMIN_CLUB_COOKIE to allow club switching across managed clubs.
    // This matches the behavior in lib/admin-context.ts (requireAdminClub).
    if (cookieValue) {
      const isValid = memberships.some((m) => m.role === 'admin' && m.club_id === cookieValue);
      if (isValid) {
        effectiveClubId = cookieValue;
      }
    }
    // Fallback: first admin membership
    if (!effectiveClubId) {
      effectiveClubId = effectiveMembership.club_id ?? null;
    }

    // FIX P0-3: Re-resolve role for the specific club.
    // If user is admin in Club A but trainer in Club B, accessing Club B should give role=trainer.
    if (effectiveClubId) {
      const clubMembership = memberships.find((m) => m.club_id === effectiveClubId);
      if (clubMembership) {
        return {
          user,
          session: null,
          supabase,
          clubId: effectiveClubId,
          role: clubMembership.role as AuthContext['role'],
          roles: memberships.map((m) => m.role),
          memberships,
        };
      }
    }
  }

  return {
    user,
    session: null,
    supabase,
    clubId: effectiveClubId,
    ...(selectedClubId != null ? { selectedClubId } : {}),
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
  requiredRole: 'owner' | 'superadmin' | 'admin' | 'trainer' | 'member'
): Promise<boolean> {
  return hasRole(auth.role, requiredRole);
}

/**
 * Verify user has access to a specific club.
 * Superadmin has access to ALL clubs (even without cookie).
 */
export function verifyClubAccess(auth: AuthContext, requestedClubId: string): boolean {
  if (auth.role === 'owner' || auth.role === 'superadmin') return true;
  return auth.clubId === requestedClubId;
}

/**
 * Verify user holds a functional office in their club (A2: Ämter-Flags).
 * Admins and above always pass implicitly.
 */
export async function verifyOffice(
  auth: AuthContext,
  office: 'kassenwart' | 'jugendwart' | 'platzwart' | 'mannschaftsfuehrer' | 'turnierleiter'
): Promise<boolean> {
  if (hasRole(auth.role, 'admin')) return true;
  if (!auth.user?.id || !auth.clubId) return false;
  const { data } = await auth.supabase
    .from('user_club_memberships')
    .select('office_flags')
    .eq('user_id', auth.user.id)
    .eq('club_id', auth.clubId)
    .eq('is_active', true)
    .maybeSingle();
  const flags = (data as { office_flags?: Record<string, boolean> } | null)?.office_flags ?? {};
  return flags[office] === true;
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
    const response = await handler(auth);

    // Auto-set ADMIN_CLUB_COOKIE for admins who don't have it yet.
    // Previously only the superadmin club-switcher set this cookie,
    // causing regular admins to get 403 on club-scoped API endpoints.
    if (
      auth.clubId &&
      auth.role !== 'superadmin' &&
      !request.cookies.get(ADMIN_CLUB_COOKIE)?.value
    ) {
      response.cookies.set(ADMIN_CLUB_COOKIE, auth.clubId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: ADMIN_CLUB_COOKIE_MAX_AGE,
        path: '/',
      });
    }

    return response;
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return unauthorizedResponse(error instanceof Error ? error.message : 'Authentication failed');
  }
}

// Backward compatibility aliases
export const withApiAuth = withAuth;
export const requireApiAuth = requireAuth;
