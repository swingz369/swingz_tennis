// lib/auth/guards.ts
// Role-based guards for Server Components and Server Actions
// Uses membership-based role system (user_club_memberships table)

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type UserRole = 'superadmin' | 'admin' | 'trainer' | 'member';

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
  const roleHierarchy: Record<string, number> = {
    superadmin: 4,
    admin: 3,
    trainer: 2,
    member: 1,
  };

  // Find the membership with the highest role — clubId must match that membership
  let effectiveRole = memberships[0].role as UserRole;
  let effectiveClubId: string | null = memberships[0].club_id ?? null;

  for (let i = 1; i < memberships.length; i++) {
    const m = memberships[i];
    const roleValue = roleHierarchy[m.role] ?? 0;
    const currentValue = roleHierarchy[effectiveRole] ?? 0;

    if (roleValue > currentValue) {
      effectiveRole = m.role as UserRole;
      effectiveClubId = m.club_id ?? null;
    }
  }

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
