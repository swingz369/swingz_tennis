'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { SkipToContent } from '@/lib/accessibility';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
import { useGlobalKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

interface AppUser {
  name?: string;
  email?: string;
  memberId?: string | null;
  roles?: string[];
  club?: { id: string; name: string } | null;
  clubs?: { id: string; name: string }[];
  selectedClubId?: string | null;
}

interface ProtectedClientLayoutProps {
  children: React.ReactNode;
  user: AppUser;
}

/**
 * Role-based layout — matches TSOW pattern:
 *   Admin / Superadmin → Left Sidebar (desktop + mobile overlay)
 *   Trainer / Member   → No sidebar, persistent Bottom Tab Bar (all screen sizes)
 */
export function ProtectedClientLayout({ children, user }: ProtectedClientLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useGlobalKeyboardShortcuts();

  const isSuperAdmin = user.roles?.includes('superadmin') ?? false;
  const isAdmin = user.roles?.includes('admin') ?? false;
  const isTrainer = user.roles?.includes('trainer') ?? false;

  // Sidebar visible for admin/superadmin routes; hidden for trainer/member
  const showSidebar = isSuperAdmin || isAdmin;

  // Bottom nav: always visible for trainer/member; on mobile for admin/superadmin
  const persistentBottomNav = !isSuperAdmin && !isAdmin;

  if (showSidebar) {
    // ─── Admin / Superadmin layout: Left sidebar + header ───
    return (
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
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
        {/* Mobile-only bottom nav for admin */}
        <MobileBottomNav
          roles={user.roles ?? []}
          onMenuClick={() => setSidebarOpen((prev) => !prev)}
          className="md:hidden"
        />
        <KeyboardShortcutsDialog />
      </div>
    );
  }

  // ─── Trainer / Member layout: No sidebar, persistent bottom tab bar ───
  return (
    <div className="flex min-h-screen flex-col">
      <SkipToContent />
      <Header user={user} />
      <main id="main-content" className="flex-1 bg-background p-4 md:p-6 pb-20" role="main">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
      {/* Always-visible bottom tab bar for trainer/member */}
      <MobileBottomNav roles={user.roles ?? []} persistent />
      <KeyboardShortcutsDialog />
    </div>
  );
}
