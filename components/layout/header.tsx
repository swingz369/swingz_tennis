'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Menu, User, LogOut, Settings, Trophy, ChevronDown, Moon, Sun } from 'lucide-react';
import { GlobalSearch } from '@/components/layout/global-search';
import { createClient } from '@/infrastructure/external/supabase/client';

interface HeaderProps {
  user?: {
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
    <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-[#0A3D2E]/80 backdrop-blur-xl border-b border-gray-100 dark:border-white/10">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#40916C] to-[#1B4332] rounded-xl blur opacity-0 group-hover:opacity-50 transition-opacity duration-300" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1B4332] to-[#40916C] shadow-lg">
              <Trophy className="h-5 w-5 text-white" />
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            SWINGZ
          </span>
        </Link>

        <div className="hidden md:block flex-1 max-w-md mx-8">
          <GlobalSearch />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Theme toggle</span>
          </Button>

          <div className="hidden md:block relative">
            <Button
              variant="ghost"
              className="relative h-9 gap-2 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 rounded-xl"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <Avatar className="h-7 w-7 border-2 border-[#40916C]/30">
                <AvatarFallback className="bg-gradient-to-br from-[#40916C] to-[#1B4332] text-white text-xs font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{user?.name?.split(' ')[0] || 'User'}</span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </Button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-[#0f2d22] py-2 shadow-xl ring-1 ring-gray-100 dark:ring-white/10 z-50">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {user?.email || 'user@example.com'}
                    </p>
                  </div>
                  <div className="py-1">
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
                    >
                      <User className="h-4 w-4 text-gray-400" />
                      Profil
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <Settings className="h-4 w-4 text-gray-400" />
                        Einstellungen
                      </Link>
                    )}
                  </div>
                  <div className="border-t border-gray-100 dark:border-white/10 pt-1">
                    <button
                      onClick={handleSignOut}
                      disabled={isLoggingOut}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <LogOut className="h-4 w-4" />
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
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
