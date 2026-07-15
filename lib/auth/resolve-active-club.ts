/**
 * lib/auth/resolve-active-club.ts — Cookie-aware active-club resolver.
 *
 * Single Source of Truth for "which club is active for this request".
 * Replaces the hand-rolled copies that previously existed in:
 *   - app/(protected)/layout.tsx
 *   - app/(protected)/admin/layout.tsx
 *   - app/(protected)/admin/(gated)/layout.tsx
 *   - lib/admin-context.ts (requireAdminClub)
 *   - lib/api-auth.ts (buildAuthContext)
 *
 * ## Why centralize
 *
 * The 5 hand-rolled copies drifted over time, causing cold-SSR F5 to
 * render with mismatched clubIds across the auth chain — the
 * "F5 /admin lädt nicht" bug. Each layer silently disagreed about
 * which clubId to use, especially around ADMIN_CLUB_COOKIE handling.
 * One helper, one resolution algorithm, no more drift.
 *
 * ## Resolution algorithm (in this order)
 *
 * 1. **Admin branch** (highestRole === 'admin'):
 *    - If cookie is set AND matches one of the user's admin memberships → use it.
 *    - Else, fall back to the FIRST admin membership with a non-null club_id.
 *      (Admin memberships with `club_id: null` indicate data-quality issues
 *      and are useless as fallbacks.)
 *    - If no fallback exists: cookie-no-membership vs. no-cookie.
 *
 * 2. **Platform-staff branch** (highestRole === 'superadmin' || highestRole === 'owner'):
 *    - Default strategy ('membership-match'): cookie must match a superadmin/owner
 *      membership on the user.
 *    - 'club-exists' strategy: cookie must point at any existing club (api-auth
 *      uses this to preserve backward-compat with the legacy platform-staff
 *      cookie policy that predates per-superadmin-membership records).
 *    - No fallback for platform-staff: they must have a valid cookie OR be in
 *      /select-admin-club picker flow.
 *
 * 3. **No relevant memberships** (highestRole = 'trainer' | 'member'):
 *    returns `{ clubId: null, reason: 'no-cookie' }`. Helper never derives
 *    a clubId for trainer/member callers — those roles are tied to a single
 *    club, look it up directly via `requireMemberContext()` /
 *    `requireTrainerContext()`.
 *
 * ## Usage
 *
 * Server Component:
 * ```ts
 * import { cookies } from 'next/headers';
 * import { resolveActiveClub } from '@/lib/auth/resolve-active-club';
 *
 * const cookieStore = await cookies();
 * const { clubId, isValid, resolvedRole, reason } = await resolveActiveClub({
 *   cookieValue: cookieStore.get(ADMIN_CLUB_COOKIE)?.value ?? null,
 *   memberships: memberships ?? [],
 *   highestRole: getHighestRole((memberships ?? []).map((m) => m.role)),
 * });
 * ```
 *
 * API route (with club-exists strategy):
 * ```ts
 * const { clubId, isValid, resolvedRole, reason } = await resolveActiveClub({
 *   cookieValue: request.cookies.get(ADMIN_CLUB_COOKIE)?.value ?? null,
 *   memberships,
 *   highestRole: getHighestRole(memberships.map((m) => m.role)),
 *   strategy: {
 *     type: 'club-exists',
 *     clubExists: async (id) =>
 *       Boolean((await supabase.from('clubs').select('id').eq('id', id).maybeSingle()).data),
 *   },
 * });
 * ```
 */

import 'server-only';
import type { UserRole } from '@/lib/auth-common';

/**
 * A single row from `user_club_memberships` — only the columns we need.
 * Caller is responsible for filtering to `is_active = true` upstream.
 */
export interface ActiveMembership {
  role: string;
  club_id: string | null;
}

/**
 * Resolution outcome.
 *
 * `reason` taxonomy (literal spec — `cookie-no-membership | no-cookie | fallback`):
 *  - `'fallback'`             → result came from admin-membership fallback OR cookie was validly honored.
 *                               `isValid` distinguishes cookie-honored (true) from membership-fallback (false).
 *  - `'no-cookie'`            → no cookie AND no membership fallback available → `clubId: null`.
 *  - `'cookie-no-membership'` → cookie set but invalid AND no membership fallback → `clubId: null`.
 */
export type ActiveClubResolutionReason = 'fallback' | 'no-cookie' | 'cookie-no-membership';

export interface ActiveClubResolution {
  /** Resolved active club, or null when neither cookie nor fallback produced a value. */
  clubId: string | null;
  /**
   * True iff the cookie was honored as-is (matched a valid membership, or for
   * platform-staff with 'club-exists' strategy, the club exists). False means
   * the resolution took the fallback path (admin membership) or returned null.
   */
  isValid: boolean;
  /**
   * Localized role for the resolved clubId. Used by api-auth to drive its
   * role-bleed fix (admin of club A shouldn't be admin when viewing club B).
   *  - Admin-branch resolution → 'admin'
   *  - Platform-staff-branch resolution → highestRole (superadmin | owner)
   *  - No relevant memberships → highestRole (caller's actual trainer/member role)
   */
  resolvedRole: UserRole;
  reason: ActiveClubResolutionReason;
}

/**
 * Strategy for validating platform-staff cookies (superadmin/owner).
 *
 * Discriminated union: when `type: 'club-exists'`, the `clubExists` callback
 * is required at the type level (TypeScript will reject passing 'club-exists'
 * without providing the lookup).
 *
 *  - `'membership-match'` (default): cookie must match a superadmin/owner
 *    membership on the user record. Strictest — defends against cookie spoofing.
 *  - `'club-exists'`: cookie only needs to point at any existing club in
 *    the `clubs` table. More permissive — used by api-auth to maintain
 *    legacy platform-staff cookie behavior.
 *
 * Admin-role cookies ALWAYS use 'membership-match' regardless of this setting;
 * admins don't have a club-exists fast path.
 */
export type PlatformStaffCookieStrategy =
  | { type: 'membership-match' }
  | { type: 'club-exists'; clubExists: (clubId: string) => Promise<boolean> };

export interface ResolveActiveClubOptions {
  /**
   * Value of ADMIN_CLUB_COOKIE. `undefined` and empty string are coerced to null.
   * Server Component: `cookieStore.get(ADMIN_CLUB_COOKIE)?.value ?? null`
   * API route:       `request.cookies.get(ADMIN_CLUB_COOKIE)?.value ?? null`
   */
  cookieValue: string | null | undefined;

  /**
   * User's active memberships (caller filters to `is_active: true` upstream).
   */
  memberships: ActiveMembership[];

  /**
   * Caller-derived highest role. Use `getHighestRole(memberships.map(m => m.role))`
   * from `@/lib/auth-common` — but pass it explicitly so the helper does NOT
   * branch on `memberships.length` (which would mis-rank users with mixed
   * superadmin+admin memberships).
   *
   * Required. Make it explicit so the type system enforces the dependency.
   */
  highestRole: UserRole;

  /**
   * Optional cookie-validation strategy for platform-staff (superadmin/owner).
   * Default: `{ type: 'membership-match' }`.
   */
  strategy?: PlatformStaffCookieStrategy;
}

/**
 * Resolve which club is active for this request.
 *
 * Returns `{ clubId, isValid, resolvedRole, reason }`.
 * Never throws — returns `null` when no clubId can be determined.
 * Callers compose this with their own redirect logic (Server Components
 * call `redirect('/select-admin-club')`, API routes return 401/403).
 */
export async function resolveActiveClub({
  cookieValue,
  memberships,
  highestRole,
  strategy = { type: 'membership-match' },
}: ResolveActiveClubOptions): Promise<ActiveClubResolution> {
  const hasCookie = typeof cookieValue === 'string' && cookieValue.length > 0;
  const cookie = hasCookie ? (cookieValue as string) : null;

  const isAdmin = highestRole === 'admin';
  const isPlatformStaff = highestRole === 'superadmin' || highestRole === 'owner';

  // ─── Admin branch (always membership-match, never club-exists) ────────
  //
  // Admin doesn't have a club-exists fast path — admins ARE their club.
  // Cookie-valid means cookie matches one of the user's admin memberships.
  if (isAdmin) {
    const adminMemberships = memberships.filter((m) => m.role === 'admin');

    if (cookie !== null) {
      const cookieMatchesAdmin = adminMemberships.some((m) => m.club_id === cookie);
      if (cookieMatchesAdmin) {
        return {
          clubId: cookie,
          isValid: true,
          resolvedRole: 'admin',
          reason: 'fallback',
        };
      }
    }

    // Admin-membership fallback: first admin membership with a real club_id.
    // (Filter excludes data-quality null club_id rows — useless for resolution.)
    const fallback = adminMemberships.find((m) => m.club_id !== null);
    if (fallback?.club_id) {
      return {
        clubId: fallback.club_id,
        isValid: false,
        resolvedRole: 'admin',
        reason: 'fallback',
      };
    }

    // Admin has no usable fallback → distinguish "no cookie" from "rejected cookie"
    return cookie !== null
      ? { clubId: null, isValid: false, resolvedRole: highestRole, reason: 'cookie-no-membership' }
      : { clubId: null, isValid: false, resolvedRole: highestRole, reason: 'no-cookie' };
  }

  // ─── Platform-staff branch (superadmin, owner) ────────────────────────
  //
  // Two strategies depending on the caller's security posture.
  if (isPlatformStaff) {
    const platformMemberships = memberships.filter(
      (m) => m.role === 'superadmin' || m.role === 'owner'
    );

    if (cookie !== null) {
      if (strategy.type === 'club-exists') {
        // api-auth style: loose enough to let superadmin pick any existing club.
        if (await strategy.clubExists(cookie)) {
          return {
            clubId: cookie,
            isValid: true,
            resolvedRole: highestRole,
            reason: 'fallback',
          };
        }
      } else {
        // 'membership-match': cookie must match a superadmin/owner membership row.
        const cookieMatchesPlatform = platformMemberships.some((m) => m.club_id === cookie);
        if (cookieMatchesPlatform) {
          return {
            clubId: cookie,
            isValid: true,
            resolvedRole: highestRole,
            reason: 'fallback',
          };
        }
      }
    }

    // No fallback for platform-staff: they must have a valid cookie OR be
    // redirected to /select-admin-club by the caller.
    return cookie !== null
      ? { clubId: null, isValid: false, resolvedRole: highestRole, reason: 'cookie-no-membership' }
      : { clubId: null, isValid: false, resolvedRole: highestRole, reason: 'no-cookie' };
  }

  // ─── Trainer / Member: no relevant cookie-driven resolution ───────────
  //
  // The helper deliberately doesn't hand out clubIds here. Trainer/member
  // callers should look up their single club via `requireMemberContext`
  // / `requireTrainerContext` directly from their own membership row.
  return {
    clubId: null,
    isValid: false,
    resolvedRole: highestRole,
    reason: 'no-cookie',
  };
}
