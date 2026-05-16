'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/icon-box';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Menu, User, LogOut, Settings, Trophy, ChevronDown, Moon, Sun } from 'lucide-react';
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
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const isAdmin = user?.roles?.some((r) => r === 'admin' || r === 'superadmin');

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore errors if not logged in via Supabase
    }
    document.cookie = 'demo-mode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setUserMenuOpen(false);
    router.push('/login');
    router.refresh();
  };

  return (
    <header
      className="sticky top-0 z-50 w-full bg-white/80 dark:bg-brand-950/80 backdrop-blur-xl border-b border-gray-100 dark:border-white/10"
      role="banner"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-3 group" aria-label="SwingZ Home">
          <div className="relative">
            <div
              className="absolute inset-0 bg-gradient-to-br from-brand-light to-brand-primary rounded-xl blur opacity-0 group-hover:opacity-50 transition-opacity duration-300"
              aria-hidden="true"
            />
            <IconBox icon={Trophy} size="md" variant="gradient-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            SWINGZ
          </span>
        </Link>

        <div
          className="hidden md:block flex-1 max-w-md mx-8"
          role="search"
          aria-label="Suchfunktion"
        >
          <GlobalSearch />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="absolute h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Theme wechseln"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Theme wechseln</span>
          </Button>

          {user?.id && <NotificationBell userId={user.id} />}

          <div className="hidden md:block relative">
            <Button
              variant="ghost"
              className="relative h-9 gap-2 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 rounded-xl"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              aria-label="Benutzermenü öffnen"
            >
              <Avatar className="h-7 w-7 border-2 border-brand-light/30">
                <AvatarFallback className="bg-gradient-to-br from-brand-light to-brand-primary text-white text-xs font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{user?.name?.split(' ')[0] || 'User'}</span>
              <ChevronDown className="h-3 w-3 text-gray-400" aria-hidden="true" />
            </Button>

            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-surface-dark py-2 shadow-xl ring-1 ring-gray-100 dark:ring-white/10 z-50"
                  role="menu"
                  aria-label="Benutzermenü"
                >
                  <div
                    className="px-4 py-3 border-b border-gray-100 dark:border-white/10"
                    role="none"
                  >
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {user?.email || 'user@example.com'}
                    </p>
                  </div>
                  <div className="py-1" role="none">
                    <Link
                      href={user?.memberId ? `/members/${user.memberId}` : '#'}
                      onClick={(e) => {
                        if (!user?.memberId) {
                          e.preventDefault();
                          toast.error('Kein Mitgliedsprofil verfügbar');
                        }
                        setUserMenuOpen(false);
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                      role="menuitem"
                    >
                      <User className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      Profil
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                        role="menuitem"
                      >
                        <Settings className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        Einstellungen
                      </Link>
                    )}
                  </div>
                  <div className="border-t border-gray-100 dark:border-white/10 pt-1" role="none">
                    <button
                      onClick={handleSignOut}
                      disabled={isLoggingOut}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      {isLoggingOut ? 'Abmelden...' : 'Abmelden'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 text-gray-700 dark:text-white rounded-xl"
            onClick={onMenuClick}
            aria-label="Menü öffnen"
            aria-expanded={false}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Menü öffnen</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
