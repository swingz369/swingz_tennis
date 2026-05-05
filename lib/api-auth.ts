/**
 * API Authentication Middleware for Supabase SSR
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
  selectedClubId?: string;
  role: 'superadmin' | 'admin' | 'trainer' | 'member';
  roles: string[];
  memberships: Array<{ club_id: string; role: string }>;
}

/**
 * Build AuthContext from user and request
 */
async function buildAuthContext(
  supabase: ReturnType<typeof createServerClient>,
  user: any,
  request: NextRequest
): Promise<AuthContext> {
  const { data: membershipsData } = await supabase
    .from('user_club_memberships')
    .select('club_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const memberships: Array<{ club_id: string; role: string }> = membershipsData ?? [];

  if (memberships.length === 0) {
    throw new Error('User has no active club membership');
  }

  const roleOrder: Record<string, number> = {
    superadmin: 4,
    admin: 3,
    trainer: 2,
    member: 1,
  };

  let effectiveRole = memberships[0].role as 'superadmin' | 'admin' | 'trainer' | 'member';
  for (let i = 1; i < memberships.length; i++) {
    const role = memberships[i].role as keyof typeof roleOrder;
    if (roleOrder[role] > roleOrder[effectiveRole]) {
      effectiveRole = role as 'superadmin' | 'admin' | 'trainer' | 'member';
    }
  }

  // Superadmin can select a club via cookie
  let selectedClubId: string | undefined;
  if (effectiveRole === 'superadmin') {
    const selectedCookie = request.cookies.get('selected-club-id');
    if (selectedCookie?.value && memberships.some((m) => m.club_id === selectedCookie.value)) {
      selectedClubId = selectedCookie.value;
    }
  }

  const effectiveClubId = selectedClubId || memberships[0].club_id;

  return {
    user,
    session: { access_token: '', refresh_token: '' } as any,
    supabase,
    clubId: effectiveClubId,
    selectedClubId: selectedClubId || undefined,
    role: effectiveRole,
    roles: memberships.map((m) => m.role as any),
    memberships,
  };
}

/**
 * Get authenticated user from Supabase session
 */
export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials not configured');
  }

  // Use tsowapp-style cookie handler with getAll/setAll
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // No-op in request context (read-only)
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.error('Auth error in requireAuth:', error);
    throw new Error('No valid session found. Please log in.');
  }

  // Bearer token fallback
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (bearerToken && supabaseServiceKey) {
    const adminSupabase = createServerClient(supabaseUrl, supabaseServiceKey, {
      cookies: { get: () => null, set: () => {}, remove: () => {} },
    });

    try {
      const {
        data: { user },
      } = await adminSupabase.auth.getUser(bearerToken);
      if (user) {
        const userSupabase = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookies: { get: () => null, set: () => {}, remove: () => {} },
        });
        await userSupabase.auth.setSession({ access_token: bearerToken, refresh_token: '' });
        return await buildAuthContext(userSupabase, user, request);
      }
    } catch (e) {
      console.log('Bearer token validation failed:', e);
    }
  }

  // Demo mode
  const hasDemoMode = request.cookies.get('demo-mode');
  if (hasDemoMode) {
    return {
      user: {
        id: 'demo-user',
        email: 'demo@swingz.com',
        user_metadata: { full_name: 'Demo User' },
      } as any,
      session: { access_token: 'demo', refresh_token: '' } as any,
      supabase: {} as any,
      clubId: 'demo-club',
      selectedClubId: undefined,
      role: 'member',
      roles: ['member'],
      memberships: [{ club_id: 'demo-club', role: 'member' }],
    };
  }

  throw new Error('No valid session found. Please log in.');
}

/**
 * Authorization check
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
 */
export function verifyClubAccess(auth: AuthContext, requestedClubId: string): boolean {
  if (auth.role === 'superadmin') return true;
  return auth.clubId === requestedClubId;
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
    if (error instanceof NextResponse) return error;
    return unauthorizedResponse(error instanceof Error ? error.message : 'Authentication failed');
  }
}

// Backward compatibility
export async function withApiAuth(
  request: NextRequest,
  handler: (auth: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, handler);
}

export async function requireApiAuth(request: NextRequest): Promise<AuthContext> {
  return requireAuth(request);
}
