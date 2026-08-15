import { cookies } from 'next/headers';
import { ProtectedClientLayout } from './protected-client-layout';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { requireAuth } from '@/lib/auth';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';
import { resolveActiveClub } from '@/lib/auth/resolve-active-club';
import { createServiceClient } from '@/lib/supabase/service';
import { DEFAULT_BRANDING, brandingToCSSVars, type ClubBranding } from '@/lib/branding';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  // Fetch user profile
  const { data: memberData } = await supabase
    .from('users')
    .select('id, email, full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  // Fetch memberships (club_id may be NULL for superadmin)
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, is_active, clubs(id, name)')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const roles: string[] = (memberships ?? []).map((m) => m.role);
  const isSuperAdmin = roles.includes('superadmin');
  const isAdmin = roles.includes('admin');
  const isOwner = roles.includes('owner');

  // Collect all clubs (non-null club_ids)
  const allClubs: { id: string; name: string }[] = (memberships ?? [])
    .map((m) => {
      const clubRaw = m.clubs;
      const club = Array.isArray(clubRaw) ? clubRaw[0] : clubRaw;
      return club ? { id: club.id as string, name: club.name as string } : null;
    })
    .filter(Boolean) as { id: string; name: string }[];

  const uniqueClubs = allClubs.filter((c, i, self) => i === self.findIndex((x) => x.id === c.id));

  // Resolve active club:
  //   • Superadmin: PRESERVE LEGACY LOOSE POLICY. The original code trusted
  //     ADMIN_CLUB_COOKIE without membership validation here because the
  //     navbar's `selectedClubId` field is used by the superadmin club-switcher
  //     to display the current club — and superadmin memberships typically
  //     have club_id=NULL (per schema/platform-staff design). Tightening this
  //     would silently de-select the superadmin's UI on cold-SSR F5, breaking
  //     a UX path that exists independently of the admin auth chain.
  //   • Admin: route through the shared helper for single-source-of-truth
  //     alignment with `app/(protected)/admin/(gated)/layout.tsx`,
  //     `lib/admin-context.ts`, and `lib/api-auth.ts`. Admin DOES enforce
  //     membership-match (F5 cold-SSR hang was caused by this branch
  //     diverging in the previous fix).
  //   • Owner: navbar uses service-client lookup outside this layout; here we
  //     return null (no ADMIN_CLUB_COOKIE owner UI to populate).
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_CLUB_COOKIE)?.value ?? null;

  let selectedClubId: string | null = null;
  if (isSuperAdmin) {
    selectedClubId = cookieValue || null;
  } else if (isAdmin) {
    const { clubId } = await resolveActiveClub({
      cookieValue,
      memberships: (memberships ?? []).map((m) => ({
        role: m.role,
        club_id: m.club_id,
      })),
      highestRole: 'admin',
    });
    selectedClubId = clubId;
  } else if (isOwner) {
    // Owner, der über „Als Admin" in einen Verein gewechselt ist. Ohne diesen
    // Zweig blieb der Vereinskontext leer: die Sidebar fiel auf die Standard-
    // Features zurück (alle optionalen Module aus — Ligen, Turniere, Shop,
    // Preisregeln verschwanden aus der Navigation), und die Hinweisleiste
    // konnte den Verein nicht benennen.
    selectedClubId = cookieValue || null;
  }

  // Cookie-Set im Server Component ist nicht möglich (Next.js 13+).
  // withApiAuth in api-auth.ts setzt ADMIN_CLUB_COOKIE automatisch beim ersten API-Call.

  // Find primary club: prefer selectedClubId, fallback to first membership with a club
  const primaryMembership = selectedClubId
    ? (memberships ?? []).find((m) => m.club_id === selectedClubId)
    : (memberships ?? []).find((m) => m.club_id);
  const primaryClubRaw = primaryMembership?.clubs ?? null;
  const primaryClub = primaryClubRaw
    ? Array.isArray(primaryClubRaw)
      ? primaryClubRaw[0]
      : primaryClubRaw
    : null;

  // Der Owner hat keine Mitgliedschaft im Verein, also findet ihn die Suche
  // über `memberships` oben nicht. Für Namen und Feature-Flags brauchen
  // Hinweisleiste und Sidebar den Verein trotzdem — direkt nachschlagen.
  let contextClub: { id: string; name: string } | null = null;
  if (isOwner && selectedClubId && !primaryClub) {
    const { data: clubRow } = await createServiceClient()
      .from('clubs')
      .select('id, name')
      .eq('id', selectedClubId)
      .maybeSingle();
    if (clubRow) contextClub = { id: clubRow.id as string, name: clubRow.name as string };
  }

  const userData = {
    id: user.id,
    name: memberData?.full_name || user.user_metadata?.full_name || 'User',
    email: user.email || '',
    avatarUrl: memberData?.avatar_url || null,
    memberId: memberData?.id || null,
    club: primaryClub
      ? { id: primaryClub.id as string, name: primaryClub.name as string }
      : contextClub,
    clubs: contextClub ? [...uniqueClubs, contextClub] : uniqueClubs,
    roles,
    selectedClubId,
  };

  // Resolve the active club's branding server-side so colors apply on first
  // paint (no client fetch, no flash) — same clubId used for the sidebar/
  // header logo and nav everywhere else in this layout.
  let branding: ClubBranding = DEFAULT_BRANDING;
  if (primaryClub?.id) {
    const { data: clubBranding } = await supabase
      .from('clubs')
      .select(
        'primary_color, secondary_color, accent_color, logo_light_url, logo_dark_url, favicon_url'
      )
      .eq('id', primaryClub.id)
      .maybeSingle();
    if (clubBranding) {
      branding = {
        clubId: primaryClub.id,
        brand: {
          primaryColor: clubBranding.primary_color || DEFAULT_BRANDING.brand.primaryColor,
          secondaryColor: clubBranding.secondary_color || DEFAULT_BRANDING.brand.secondaryColor,
          accentColor: clubBranding.accent_color || DEFAULT_BRANDING.brand.accentColor,
        },
        logos: {
          light: clubBranding.logo_light_url ?? null,
          dark: clubBranding.logo_dark_url ?? null,
          favicon: clubBranding.favicon_url ?? null,
        },
        customDomain: null,
        extended: {},
      };
    }
  }
  const brandCssVars = Object.entries(brandingToCSSVars(branding))
    .map(([key, value]) => `${key}:${value};`)
    .join('');

  return (
    <>
      {/* Per-club color theming — SSR'd so it's present on first paint, no flash */}
      <style dangerouslySetInnerHTML={{ __html: `:root{${brandCssVars}}` }} />
      <ProtectedRoute>
        <ProtectedClientLayout user={userData} branding={branding}>
          {children}
        </ProtectedClientLayout>
      </ProtectedRoute>
    </>
  );
}
