// lib/auth/guards.ts
// Role-based guards for Server Components and Server Actions
// Uses membership-based role system (user_club_memberships table)

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getHighestRole, type UserRole } from '@/lib/auth-common';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  clubId: string | null;
}

// Get current user with verified role from memberships (NOT from JWT!)
export async function getAuthenticatedUser(): Promise<AuthUser> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // Fetch user's active memberships to determine role
  const { data: memberships, error: membershipError } = await supabase
    .from('user_club_memberships')
    .select('club_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (membershipError || !memberships || memberships.length === 0) {
    redirect('/login');
  }

  // Determine highest role (similar to buildAuthContext in api-auth.ts)

  // Find the membership with the highest role — clubId must match that membership
  const effectiveRole = getHighestRole(memberships.map((m) => m.role));
  const effectiveMembership = memberships.find((m) => m.role === effectiveRole) || memberships[0];
  const effectiveClubId: string | null = effectiveMembership.club_id ?? null;

  // For superadmin, clubId remains null unless they have a club membership
  // (The admin UI handles club selection separately)

  return {
    id: user.id,
    email: user.email!,
    role: effectiveRole,
    clubId: effectiveClubId,
  };
}

// Generic role guard - redirects if user doesn't have required role
export async function requireRole(
  allowedRoles: UserRole[],
  redirectTo = '/dashboard'
): Promise<AuthUser> {
  const user = await getAuthenticatedUser();

  if (!allowedRoles.includes(user.role)) {
    redirect(redirectTo);
  }

  return user;
}

// Convenience guards
export const requireAdmin = () => requireRole(['superadmin', 'admin']);
export const requireSuperAdmin = () => requireRole(['superadmin']);
export const requireTrainer = () => requireRole(['superadmin', 'admin', 'trainer']);
export const requireMember = () => requireRole(['superadmin', 'admin', 'trainer', 'member']);
