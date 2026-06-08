/**
 * lib/admin-context.ts — Server Component Admin Context Helpers
 *
 * Inspired by TSOWAPP's `requireAdminClub()` pattern.
 * Eliminates the repeated 15-line auth + membership + clubId block
 * that was duplicated across 14+ admin pages.
 *
 * Usage:
 *   const { supabase, user, clubId, isSuperadmin } = await requireAdminClub();
 *
 * For API routes, use lib/api-auth.ts instead.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';
import { getHighestRole, type UserRole } from '@/lib/auth-common';
import { requireAuth } from '@/lib/auth';

export interface AdminContext {
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'];
  user: Awaited<ReturnType<typeof requireAuth>>['user'];
  clubId: string;
  isSuperadmin: boolean;
  role: UserRole;
}

export interface MemberContext {
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'];
  user: Awaited<ReturnType<typeof requireAuth>>['user'];
  clubId: string | null;
}

export interface TrainerContext {
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'];
  user: Awaited<ReturnType<typeof requireAuth>>['user'];
  trainerId: string | null;
  clubId: string | null;
}

/**
 * Guard: requires admin or superadmin role with a valid club context.
 *
 * Returns { supabase, user, clubId, isSuperadmin, role }.
 * Redirects to /login if unauthenticated, /dashboard if not admin,
 * or /select-admin-club if superadmin without a selected club.
 *
 * @example
 * const { supabase, user, clubId } = await requireAdminClub();
 */
export async function requireAdminClub(): Promise<AdminContext> {
  const { supabase, user } = await requireAuth();

  // Fetch memberships (deterministic order: superadmin > admin > trainer > member)
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('club_id');

  const roles = (memberships ?? []).map((m: { role: string }) => m.role);
  const role = getHighestRole(roles);
  const isSuperadmin = role === 'superadmin';

  // Must be admin or superadmin
  if (!isSuperadmin && role !== 'admin') {
    redirect('/dashboard');
  }

  // Resolve club context
  const cookieStore = await cookies();
  let clubId: string | null = null;

  if (isSuperadmin) {
    clubId = cookieStore.get(ADMIN_CLUB_COOKIE)?.value || null;
    if (!clubId) redirect('/select-admin-club');
  } else {
    // Also honor ADMIN_CLUB_COOKIE for regular admins (allows club switching across managed clubs)
    const cookieClubId = cookieStore.get(ADMIN_CLUB_COOKIE)?.value || null;
    if (cookieClubId) {
      const isValid = (memberships ?? []).some(
        (m: { role: string; club_id: string | null }) =>
          m.role === 'admin' && m.club_id === cookieClubId
      );
      if (isValid) {
        clubId = cookieClubId;
      }
    }
    // Fallback: first admin membership
    if (!clubId) {
      const adminMembership = (memberships ?? []).find(
        (m: { role: string; club_id: string | null }) => m.role === 'admin'
      );
      clubId = adminMembership?.club_id || null;
    }
    if (!clubId) redirect('/dashboard');
  }

  return { supabase, user, clubId, isSuperadmin, role };
}

/**
 * Guard: requires an authenticated member with an active membership.
 *
 * Returns { supabase, user, clubId }.
 * clubId may be null if the user has no active membership.
 *
 * @example
 * const { supabase, user, clubId } = await requireMemberContext();
 */
export async function requireMemberContext(): Promise<MemberContext> {
  const { supabase, user } = await requireAuth();

  // Get club context from membership
  const { data: membership } = await supabase
    .from('user_club_memberships')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('role', 'member')
    .eq('is_active', true)
    .maybeSingle();

  const clubId = membership?.club_id ?? null;

  return { supabase, user, clubId };
}

/**
 * Guard: requires an authenticated trainer.
 *
 * Returns { supabase, user, trainerId, clubId }.
 * trainerId may be null if no trainer record exists yet.
 *
 * @example
 * const { supabase, user, trainerId, clubId } = await requireTrainerContext();
 */
export async function requireTrainerContext(): Promise<TrainerContext> {
  const { supabase, user } = await requireAuth();

  // Get trainer membership
  const { data: membership } = await supabase
    .from('user_club_memberships')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('role', 'trainer')
    .eq('is_active', true)
    .maybeSingle();

  const clubId = membership?.club_id ?? null;

  // Get trainer record
  let trainerId: string | null = null;
  const { data: trainerRecord } = await supabase
    .from('trainers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  trainerId = trainerRecord?.id ?? null;

  return { supabase, user, trainerId, clubId };
}
