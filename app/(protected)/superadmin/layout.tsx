import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Building2, BarChart3, Users, Home, Settings } from 'lucide-react';

/**
 * Superadmin Layout
 *
 * Platform-wide administration area
 * Only accessible by users with 'superadmin' role
 *
 * Routes:
 * - /superadmin/dashboard - Platform overview
 * - /superadmin/tenants - All clubs management
 * - /superadmin/clubs - Create/manage clubs
 */
export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  // Check if user has superadmin role
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, clubs(name)')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isSuperadmin = memberships?.some((m: { role: string }) => m.role === 'superadmin');

  if (!isSuperadmin) {
    // Not a superadmin - redirect based on other roles
    const roles = memberships?.map((m: { role: string }) => m.role) ?? [];

    if (roles.includes('admin')) {
      redirect('/admin/members');
    } else if (roles.includes('trainer')) {
      redirect('/trainer');
    } else {
      redirect('/dashboard');
    }
  }

  // Superadmin navigation items (platform-wide)
  const superadminNavItems = [
    { name: 'Dashboard', href: '/superadmin/dashboard', icon: Home },
    { name: 'Vereinsübersicht', href: '/superadmin/tenants', icon: Building2 },
    { name: 'Club-Verwaltung', href: '/superadmin/clubs', icon: Building2 },
    { name: 'Plattform-Analyse', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Einstellungen', href: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background to-muted">
      <Sidebar roles={['superadmin']} selectedClubId={null} />
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
