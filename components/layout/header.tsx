'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/icon-box';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Menu, User, LogOut, Settings, Trophy, ChevronDown, LayoutDashboard } from 'lucide-react';
import { GlobalSearch } from '@/components/layout/global-search';
import { NotificationBell } from '@/components/layout/notification-bell';
import { createClient } from '@/infrastructure/external/supabase/client';

interface HeaderProps {
  user?: {
    id?: string;
    name?: string;
    email?: string;
    memberId?: string | null;
    roles?: string[];
  };
  onMenuClick?: () => void;
}

export function Header({ user, onMenuClick }: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const isAdmin = user?.roles?.some((r) => r === 'admin' || r === 'superadmin');
  const isSuperAdmin = user?.roles?.includes('superadmin');

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore errors if not logged in via Supabase
    }
    setUserMenuOpen(false);
    router.push('/login');
    router.refresh();
  };

  // Determine dashboard link by role
  const dashboardLink = isSuperAdmin
    ? '/superadmin'
    : isAdmin
      ? '/admin'
      : user?.roles?.includes('trainer')
        ? '/trainer'
        : '/member';

  return (
    <header
      className="sticky top-0 z-50 w-full bg-white/70 dark:bg-brand-950/70 backdrop-blur-2xl border-b border-gray-200/60 dark:border-white/[0.06] supports-[backdrop-filter]:bg-white/60 supports-[backdrop-filter]:dark:bg-brand-950/60"
      role="banner"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href={dashboardLink}
          className="flex items-center gap-3 group"
          aria-label="SwingZ Home"
        >
          <div className="relative">
            <div
              className="absolute -inset-1.5 bg-gradient-to-br from-brand-light/40 via-brand-primary/30 to-brand-light/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500"
              aria-hidden="true"
            />
            <IconBox icon={Trophy} size="md" variant="gradient-primary" />
          </div>
          <span className="hidden sm:inline text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            SWINGZ
          </span>
        </Link>

        {/* Global Search */}
        <div
          className="hidden md:block flex-1 max-w-md mx-8"
          role="search"
          aria-label="Suchfunktion"
        >
          <GlobalSearch />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          {user?.id && <NotificationBell userId={user.id} />}

          {/* User Menu (desktop) */}
          <div className="hidden md:block relative" ref={menuRef}>
            <Button
              variant="ghost"
              className="relative h-9 gap-2.5 pl-2 pr-3 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 rounded-xl transition-all duration-200"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              aria-label="Benutzermenü öffnen"
            >
              <Avatar className="h-7 w-7 ring-2 ring-brand-light/20 ring-offset-1 ring-offset-transparent transition-shadow duration-300 group-hover:ring-brand-light/40">
                <AvatarFallback className="bg-gradient-to-br from-brand-light to-brand-primary text-white text-xs font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium max-w-[100px] truncate">
                {user?.name?.split(' ')[0] || 'User'}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </Button>

            {/* Dropdown menu with enter animation */}
            <div
              className={`absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-surface-dark py-2 shadow-2xl ring-1 ring-gray-200/60 dark:ring-white/10 z-50 transition-all duration-200 origin-top-right ${
                userMenuOpen
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
              }`}
              role="menu"
              aria-label="Benutzermenü"
            >
              {/* User info */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10" role="none">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {user?.email || 'user@example.com'}
                </p>
                {user?.roles && user.roles.length > 0 && (
                  <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-light/10 text-brand-light dark:bg-brand-light/20 dark:text-green-300">
                    {user.roles[0]}
                  </span>
                )}
              </div>

              {/* Menu items */}
              <div className="py-1" role="none">
                <Link
                  href={dashboardLink}
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  role="menuitem"
                >
                  <LayoutDashboard className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  Dashboard
                </Link>
                <Link
                  href={user?.memberId ? `/members/${user.memberId}` : '/profile'}
                  onClick={() => {
                    setUserMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  role="menuitem"
                >
                  <User className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  Profil
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    role="menuitem"
                  >
                    <Settings className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    Einstellungen
                  </Link>
                )}
              </div>

              {/* Sign out */}
              <div className="border-t border-gray-100 dark:border-white/10 pt-1" role="none">
                <button
                  onClick={handleSignOut}
                  disabled={isLoggingOut}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {isLoggingOut ? 'Abmelden...' : 'Abmelden'}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 text-gray-700 dark:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-white/10"
            onClick={onMenuClick}
            aria-label="Menü öffnen"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Menü öffnen</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
