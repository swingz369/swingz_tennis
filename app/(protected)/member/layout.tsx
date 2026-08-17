import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { ROLE_MODE_COOKIE } from '@/lib/cookies';

import { createLogger } from '@/lib/logger';

const log = createLogger('member:layout');

/**
 * Member Layout — Authentication & Authorization Guard
 *
 * Standardfall: Personen mit höherer Rolle (trainer/admin/superadmin) werden in
 * ihren Bereich weitergeleitet (höchste Rolle gewinnt).
 *
 * Ausnahme „Spielen-Modus": Ein Admin ist selbst Mitglied seines Vereins (eine
 * Membership-Zeile pro (user, club)). Hat er über den Rollen-Switcher den
 * Spieler-Modus gewählt (ROLE_MODE_COOKIE = 'member'), darf er die
 * Mitglieder-Oberfläche sehen — sonst würde ihn dieser Guard nach /admin
 * zurückwerfen und die halbe neue Oberfläche wäre tot. Der Modus ist eine reine
 * UI-Präferenz und KEINE Sicherheitsgrenze: Er weitet nichts frei (die
 * Mitglieder-Oberfläche ist die am wenigsten privilegierte), die Autorisierung
 * läuft weiterhin über requireAuth + RLS.
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  const { data: memberships, error } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (error) {
    log.error('[Member Layout] Failed to load memberships:', error);
    redirect('/login?error=no_memberships');
  }

  // If user has a higher role, send them to the right area
  const roles = (memberships ?? []).map((m: { role: string }) => m.role);

  // Spieler-Modus (nur über den Rollen-Switcher für Admins setzbar). Der
  // Pass-Through macht nur mit einer echten Vereinsmitgliedschaft Sinn — wer
  // als Plattform-Staff (superadmin/owner) ohne Club-Membership hierher käme,
  // wird weiterhin in seinen Verwaltungsbereich geleitet.
  const cookieStore = await cookies();
  const memberMode = cookieStore.get(ROLE_MODE_COOKIE)?.value === 'member';
  const hasClubMembership = (memberships ?? []).some((m) => m.club_id);
  const isPlayer = memberMode && hasClubMembership;

  if (roles.includes('superadmin') && !isPlayer) {
    redirect('/superadmin');
  }
  if (roles.includes('admin') && !isPlayer) {
    redirect('/admin');
  }
  if (roles.includes('trainer') && !isPlayer) {
    redirect('/trainer');
  }

  return <>{children}</>;
}
