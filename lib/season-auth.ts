/**
 * lib/season-auth.ts — Centralized Season-Authorization Helper
 *
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ What this file does                                                     │
 * ├────────────────────────────────────────────────────────────────────────┤
 * │ Replaces the ~22-times-duplicated pattern across app/api/seasons/[id]/* │
 * │ routes:                                                                │
 * │                                                                        │
 * │   1. withApiAuth(request, async (auth) => { ... })                      │
 * │   2. const isAdmin = await verifyRole(auth, 'admin')                   │
 * │   3. const isSuperadmin = await verifyRole(auth, 'superadmin')         │
 * │   4. if (!isAdmin && !isSuperadmin) return forbiddenResponse(...)      │
 * │   5. Saison laden (RLS-Client; Owner über systemDb)                    │
 * │   6. if (!season) return 404                                            │
 * │   7. if (!isSuperadmin && !memberships.some(...)) return forbidden     │
 * │                                                                        │
 * │ → `authorizeSeasonAccess(auth, seasonId, options)` returns a           │
 * │   Discriminated Union: `{ ok: true; season; effectiveRole }`           │
 * │   or `{ ok: false; response }`. Routes return `access.response`        │
 * │   for short-circuit (uniform with the existing NextResponse idiom).    │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * Why Discriminated Union instead of a higher-order `withSeasonAuth`?
 * ────────────────────────────────────────────────────────────────────────
 * A HOF wrapper would force another nesting layer around every route handler
 * and complicate Next.js RouteContext (where `context.params` is a Promise
 * that callers want to `await` themselves). The Discriminated Union lets the
 * caller keep the existing `withApiAuth` shape and use a 2-line guard clause.
 *
 * Usage:
 * ```ts
 * return withApiAuth(request, async (auth) => {
 *   try {
 *     const { id: seasonId } = await context.params;
 *     const access = await authorizeSeasonAccess(auth, seasonId, {
 *       allowedRoles: ['admin'],  // default; or ['admin', 'trainer'] for read access
 *     });
 *     if (!access.ok) return access.response;
 *     const { season, effectiveRole } = access;
 *     // ... business logic, no further auth checks needed
 *   } catch (err) { ... }
 * });
 * ```
 */

import { NextResponse } from 'next/server';
import type { Tables } from '@/types/supabase';
import { getUserDb, systemDb } from '@/infrastructure/db';
import { type AuthContext, verifyRole, forbiddenResponse } from '@/lib/api-auth';

// ───────────────────────────────────────────────────────────────────────
// Public types
// ───────────────────────────────────────────────────────────────────────

/** Roles a caller may hold in the season's club for a given route. */
export type SeasonAccessRole = 'owner' | 'superadmin' | 'admin' | 'trainer' | 'member';

/**
 * Options for `authorizeSeasonAccess`.
 *
 * - `allowedRoles`: which roles can access this route. `'owner'`
 *   bypasses the club-membership check; `'superadmin'` only for clubs it is
 *   assigned to (membership role superadmin). Default: `['admin']`.
 *
 * - `requireClubMembership`: when true (default), non-superadmin callers MUST
 *   have a `user_club_memberships` row matching `season.club_id` AND the role
 *   must be in `allowedRoles`. Set to false on routes that only check roles
 *   (e.g. for routes whose data is already club-scoped via RLS).
 */
export interface AuthorizeSeasonAccessOptions {
  allowedRoles?: ReadonlyArray<SeasonAccessRole>;
  /** Default `true`. Set false only for routes that need role but no club match (e.g. trainer-self-service). */
  requireClubMembership?: boolean;
}

export interface SeasonAccessGranted {
  ok: true;
  /** The resolved season row from the DB. */
  season: Tables<'seasons'>;
  /**
   * The role the caller effectively plays FOR THIS SEASON (NOT their global
   * role). Use this in business logic to branch read/write behavior — e.g.
   * trainers can read but only edit their own plan-entries.
   */
  effectiveRole: SeasonAccessRole;
}

export interface SeasonAccessDenied {
  ok: false;
  /** Pre-built NextResponse that the route should return verbatim. */
  response: NextResponse;
}

export type SeasonAccessResult = SeasonAccessGranted | SeasonAccessDenied;

// ───────────────────────────────────────────────────────────────────────
// Core helper
// ───────────────────────────────────────────────────────────────────────

/**
 * Look up a season and verify the caller has access to it.
 *
 * @param auth         The AuthContext from `withApiAuth`.
 * @param seasonId     The `[id]` from the route params (the season UUID).
 * @param options      Optional role whitelist and membership-requirement override.
 * @returns           Discriminated Union: granted ({with season row}) or denied ({with NextResponse}).
 *
 * The returned `NextResponse` uses the same wire format (status + JSON body)
 * as the legacy `forbiddenResponse()` / `NextResponse.json({ error }, ...)`
 * helpers it replaces, so error-shape consumers stay unchanged.
 */
export async function authorizeSeasonAccess(
  auth: AuthContext,
  seasonId: string,
  options: AuthorizeSeasonAccessOptions = {}
): Promise<SeasonAccessResult> {
  const allowed = options.allowedRoles ?? ['admin'];
  const requireClub = options.requireClubMembership ?? true;

  // 1. Season lookup — 404 short-circuit (covers both null/undefined id and not-found).
  if (!seasonId || typeof seasonId !== 'string') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Season not found' }, { status: 404 }),
    };
  }

  // ADR-005: Nutzer lesen die Saison mit RLS (fremde Vereine sind unsichtbar → 404);
  // Owner haben keine Membership, für sie systemDb.
  let season: Tables<'seasons'> | null = null;
  try {
    const client =
      auth.role === 'owner'
        ? systemDb('Owner: Saison-Zugriffsprüfung aller Vereine')
        : getUserDb(auth);
    const { data, error } = await client.from('seasons').select().eq('id', seasonId).maybeSingle();
    if (error) throw new Error(error.message);
    season = data;
  } catch {
    // DB error → 500-shaped response, single error wire format.
    return {
      ok: false,
      response: NextResponse.json({ error: 'Season lookup failed' }, { status: 500 }),
    };
  }

  if (!season) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Season not found' }, { status: 404 }),
    };
  }

  // 2. Owner fast path — Plattformbetreiber sieht alle Vereine. Superadmins
  //    NICHT: sie sind nur für ihre zugewiesenen Vereine zuständig (Membership
  //    mit Rolle superadmin, siehe Schritt 3).
  if (await verifyRole(auth, 'owner')) {
    return { ok: true, season, effectiveRole: auth.role };
  }

  // 3. Per-club authorization: find the caller's membership in the season's
  //    club. We use the membership's `role` (which is the role they hold IN
  //    this specific club), not the global `auth.role`, because multi-club
  //    users can hold different roles per club (see api-auth P0-3 fix).
  if (!requireClub) {
    // Role-only check: any allowed role grants access even without
    // club-membership in this specific club. Used by routes where the
    // calling user is a member of a DIFFERENT club (e.g. trainer from club A
    // viewing a public-club summary).
    const roleOk = await checkAllowedRoles(auth, allowed);
    if (roleOk) {
      return { ok: true, season, effectiveRole: pickEffectiveRole(auth, allowed) };
    }
    return { ok: false, response: forbiddenResponse('Keine ausreichende Rolle für diese Saison') };
  }

  const clubMembership = auth.memberships.find((m) => m.club_id === season.club_id) ?? null;

  if (!clubMembership) {
    return {
      ok: false,
      response: forbiddenResponse('Kein Zugriff auf diese Saison'),
    };
  }

  const clubRole = clubMembership.role as SeasonAccessRole;

  // 4. Role whitelist check. Empty allowedRoles = no-one (apart from
  //    platform staff from step 2). Default ['admin'] blocks trainers and
  //    members as expected for admin-only routes.
  if (clubRole !== 'superadmin' && !allowed.includes(clubRole)) {
    return {
      ok: false,
      response: forbiddenResponse(`Role '${clubRole}' is not authorized for this endpoint`),
    };
  }

  return { ok: true, season, effectiveRole: clubRole };
}

// ───────────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────────

/**
 * True iff the user's effective role (global auth.role OR any membership role)
 * matches one of `allowed`. Used in the role-only branch.
 */
async function checkAllowedRoles(
  auth: AuthContext,
  allowed: ReadonlyArray<SeasonAccessRole>
): Promise<boolean> {
  if (allowed.includes(auth.role)) return true;
  // Consider roles in case user has a different per-club role than the global.
  for (const m of auth.memberships) {
    if (allowed.includes(m.role as SeasonAccessRole)) return true;
  }
  return false;
}

/** Resolve the role that should be reported to the caller in role-only mode. */
function pickEffectiveRole(
  auth: AuthContext,
  allowed: ReadonlyArray<SeasonAccessRole>
): SeasonAccessRole {
  if (allowed.includes(auth.role)) return auth.role;
  for (const m of auth.memberships) {
    if (allowed.includes(m.role as SeasonAccessRole)) return m.role as SeasonAccessRole;
  }
  return auth.role;
}
