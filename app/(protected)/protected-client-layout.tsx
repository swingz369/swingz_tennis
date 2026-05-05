'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';

interface AppUser {
  name?: string;
  email?: string;
  memberId?: string | null;
  roles?: string[];
  club?: { id: string; name: string } | null;
  selectedClubId?: string | null;
}

interface ProtectedClientLayoutProps {
  children: React.ReactNode;
  user: AppUser;
}

export function ProtectedClientLayout({ children, user }: ProtectedClientLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <Header user={user} onMenuClick={() => setSidebarOpen((prev) => !prev)} />
      <div className="flex flex-1 relative">
        <Sidebar
          roles={user.roles ?? []}
          selectedClubId={user.selectedClubId ?? null}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          />
        )}
        <main className="flex-1 bg-background p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
      <MobileBottomNav
        roles={user.roles ?? []}
        onMenuClick={() => setSidebarOpen((prev) => !prev)}
      />
    </div>
  );
}
