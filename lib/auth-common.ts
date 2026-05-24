/**
 * lib/auth-common.ts — Shared Auth Constants & Helpers
 *
 * Centralized role hierarchy used by API auth, server-component guards, and tests.
 * Single source of truth — update here and all consumers stay in sync.
 *
 * Role Architecture:
 *   superadmin → club_id = NULL in DB, platform-wide access
 *   admin      → club_id = specific club, manages that club
 *   trainer    → club_id = specific club
 *   member     → club_id = specific club
 */

export type UserRole = 'superadmin' | 'admin' | 'trainer' | 'member';

/** Higher number = more privileges */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  superadmin: 4,
  admin: 3,
  trainer: 2,
  member: 1,
};

/** All roles sorted from highest to lowest privilege */
export const ALL_ROLES: UserRole[] = ['superadmin', 'admin', 'trainer', 'member'];

/**
 * Check if `userRole` meets or exceeds `requiredRole`.
 * Superadmin always passes.
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

/**
 * Given an array of membership roles, return the one with the highest privilege.
 */
export function getHighestRole(roles: string[]): UserRole {
  let best: UserRole = 'member';
  let bestValue = 0;
  for (const r of roles) {
    const value = ROLE_HIERARCHY[r as UserRole] ?? 0;
    if (value > bestValue) {
      best = r as UserRole;
      bestValue = value;
    }
  }
  return best;
}
