/**
 * lib/auth-common.ts — Shared Auth Constants & Helpers
 *
 * Role Architecture:
 *   owner      → Plattformbetreiber (Swingz GmbH), club_id = NULL, sieht alles
 *   superadmin → Tennisschule-Chef, verwaltet Gruppe von Vereinen, club_id = NULL
 *   admin      → Vereinsadmin, genau 1 Verein (club_id gesetzt)
 *   trainer    → club_id = specific club
 *   member     → club_id = specific club
 */

export type UserRole = 'owner' | 'superadmin' | 'admin' | 'trainer' | 'member';

/** Higher number = more privileges */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 5,
  superadmin: 4,
  admin: 3,
  trainer: 2,
  member: 1,
};

/** All roles sorted from highest to lowest privilege */
export const ALL_ROLES: UserRole[] = ['owner', 'superadmin', 'admin', 'trainer', 'member'];

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
