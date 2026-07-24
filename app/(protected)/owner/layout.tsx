import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Shield, Sparkles } from 'lucide-react';

/**
 * Owner Layout — Authentication & Authorization Guard + Plattform-Konsole-Banner
 *
 * Banner-Logik: Ein Owner sieht auf JEDER /owner/*-Seite dieselbe violette
 * Kontextleiste direkt unter dem globalen Header. Damit ist die Modus-Erkennung
 * optisch eindeutig — Owner ≠ Superadmin ≠ Admin auf einen Blick.
 *
 * Performance: roleFlags kommen aus dem vorhandenen Memberships-Cache in
 * requireAuth(), keine zusätzliche DB-Query.
 */
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireAuth();

  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isOwner = memberships?.some((m: { role: string }) => m.role === 'owner');

  if (!isOwner) {
    const roles = memberships?.map((m: { role: string }) => m.role) ?? [];
    if (roles.includes('superadmin')) redirect('/superadmin');
    else if (roles.includes('admin')) redirect('/admin');
    else redirect('/dashboard');
  }

  // Friendly first-name aus user_metadata (oder public.users.full_name als Fallback)
  const firstName =
    (user.user_metadata as { full_name?: string } | null)?.full_name?.split(' ')[0] ?? null;

  return (
    <div className="space-y-0">
      <div
        role="status"
        aria-label="Owner-Bedienpanel: Plattform-Konsole"
        className="border-b border-info-200/60 dark:border-info-700/30 bg-gradient-to-r from-info-50 via-info-50/80 to-info-50/60 dark:from-info-900/25 dark:via-info-900/15 dark:to-info-900/20"
      >
        <div className="mx-auto max-w-7xl flex items-center gap-2.5 px-4 sm:px-6 lg:px-8 py-2 text-sm">
          <Shield
            className="h-4 w-4 shrink-0 text-info-700 dark:text-info-300"
            aria-hidden="true"
          />
          <span className="font-semibold text-info-900 dark:text-info-100">Plattform-Konsole</span>
          <span className="text-info-700/80 dark:text-info-300/80 text-xs hidden md:inline">
            · Eigentümer-Bedienpanel über allen Vereinen
          </span>
          <div className="ml-auto flex items-center gap-2 text-xs text-info-700/70 dark:text-info-300/70">
            <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              {firstName
                ? `Hallo ${firstName} — Direktzugriff auf alle Vereine`
                : 'Direktzugriff auf alle Vereine'}
            </span>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
