'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Skeleton } from '@/components/ui/skeleton';

const Sidebar = dynamic(() => import('@/components/layout/sidebar').then((m) => m.Sidebar), {
  loading: () => <Skeleton className="h-full w-64" />,
});
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { SkipToContent } from '@/lib/accessibility';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
import { CommandPalette } from '@/components/command-palette';
import { SearchDialog } from '@/components/search-dialog';
import { CommandPaletteProvider } from '@/components/command-palette-context';
import { PageTransition } from '@/components/animations';
import { useGlobalKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { ErrorBoundary } from '@/components/error-boundary';
import { TenantProvider } from '@/lib/tenant-context';
import type { ClubBranding } from '@/lib/branding';

interface AppUser {
  id?: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  memberId?: string | null;
  roles?: string[];
  club?: { id: string; name: string } | null;
  clubs?: { id: string; name: string }[];
  selectedClubId?: string | null;
}

interface ProtectedClientLayoutProps {
  children: React.ReactNode;
  user: AppUser;
  /** Resolved server-side in app/(protected)/layout.tsx — drives logo + favicon. */
  branding?: ClubBranding;
}

function SignOutLink() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await createClient().auth.signOut();
        } catch {
          // Ohne gültige Session ist der Logout bereits erledigt.
        }
        router.push('/login');
        router.refresh();
      }}
      className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
    >
      Abmelden
    </button>
  );
}

/**
 * Role-based layout — matches TSOW pattern:
 *   Admin / Superadmin → Left Sidebar (desktop + mobile overlay)
 *   Trainer / Member   → No sidebar, persistent Bottom Tab Bar (all screen sizes)
 */
export function ProtectedClientLayout({ children, user, branding }: ProtectedClientLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useGlobalKeyboardShortcuts();

  // Onboarding-Wizards laufen ohne Shell. Sidebar, Header und Command-Palette
  // eines Vereins, der gerade erst angelegt wird, führen überall ins Leere —
  // und der Wizard ist die einzige Stelle, an der es keine Alternative zum
  // Weiterklicken geben soll. TenantProvider bleibt, weil das Branding die
  // CSS-Variablen der Buttons liefert.
  if (pathname?.endsWith('/onboarding')) {
    return (
      <TenantProvider clubId={user.selectedClubId ?? user.club?.id ?? null} branding={branding}>
        <main id="main-content" role="main">
          <ErrorBoundary>{children}</ErrorBoundary>
          {/* Ohne Header gäbe es sonst keinen Weg mehr aus einem halb
              eingerichteten Konto heraus außer Cookies löschen. */}
          <div className="pb-8 text-center">
            <SignOutLink />
          </div>
        </main>
      </TenantProvider>
    );
  }

  const isOwner = user.roles?.includes('owner') ?? false;
  const isSuperAdmin = user.roles?.includes('superadmin') ?? false;
  const isAdmin = user.roles?.includes('admin') ?? false;

  // Sidebar visible for owner/superadmin/admin; hidden for trainer/member
  const showSidebar = isOwner || isSuperAdmin || isAdmin;

  if (showSidebar) {
    // ─── Admin / Superadmin layout: Left sidebar + header ───
    return (
      <TenantProvider clubId={user.selectedClubId ?? user.club?.id ?? null} branding={branding}>
        <CommandPaletteProvider>
          <div className="flex min-h-screen flex-col">
            <SkipToContent />
            <Header user={user} onMenuClick={() => setSidebarOpen((prev) => !prev)} />
            <div className="flex flex-1 relative">
              <Sidebar
                roles={user.roles ?? []}
                selectedClubId={user.selectedClubId ?? null}
                clubs={user.clubs ?? (user.club ? [user.club] : [])}
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
              />
              {sidebarOpen && (
                <div
                  className="fixed inset-0 z-40 bg-black/50 md:hidden"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Menü schließen"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSidebarOpen(false);
                  }}
                />
              )}
              <main
                id="main-content"
                className="flex-1 bg-background p-4 md:p-6 lg:p-8 pb-20 md:pb-6"
                role="main"
              >
                <div className="mx-auto max-w-7xl">
                  <ErrorBoundary>
                    <PageTransition>{children}</PageTransition>
                  </ErrorBoundary>
                </div>
              </main>
            </div>
            {/* Mobile-only bottom nav for admin */}
            <MobileBottomNav
              roles={user.roles ?? []}
              onMenuClick={() => setSidebarOpen((prev) => !prev)}
              className="md:hidden"
            />
            <CommandPalette
              roles={user.roles ?? []}
              selectedClubId={user.selectedClubId ?? null}
              clubs={user.clubs ?? (user.club ? [user.club] : [])}
            />
            <SearchDialog />
            <KeyboardShortcutsDialog />
          </div>
        </CommandPaletteProvider>
      </TenantProvider>
    );
  }

  // ─── Trainer / Member layout: No sidebar, persistent bottom tab bar ───
  return (
    <TenantProvider clubId={user.selectedClubId ?? user.club?.id ?? null} branding={branding}>
      <CommandPaletteProvider>
        <div className="flex min-h-screen flex-col">
          <SkipToContent />
          <Header user={user} />
          <main id="main-content" className="flex-1 bg-background p-4 md:p-6 pb-20" role="main">
            {' '}
            <div className="mx-auto max-w-3xl">
              <ErrorBoundary>
                <PageTransition>{children}</PageTransition>
              </ErrorBoundary>
            </div>
          </main>
          {/* Always-visible bottom tab bar for trainer/member */}
          <MobileBottomNav roles={user.roles ?? []} persistent />
          <CommandPalette />
          <SearchDialog />
          <KeyboardShortcutsDialog />
        </div>
      </CommandPaletteProvider>
    </TenantProvider>
  );
}
