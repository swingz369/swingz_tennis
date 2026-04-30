'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Menu, User, LogOut, Settings, Trophy, ChevronDown, Moon, Sun } from 'lucide-react';
import { GlobalSearch } from '@/components/layout/global-search';

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
  const { theme, setTheme } = useTheme();

  const isAdmin = user?.roles?.some((r) => r === 'admin' || r === 'superadmin');

  return (
    <header
      className="sticky top-0 z-50 w-full border-b bg-white dark:bg-brand-navy-900 text-gray-900 dark:text-white"
      style={{
        boxShadow: '0 8px 24px -4px rgba(30,58,95,0.3)',
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary-500 to-brand-primary-700"
            style={{ boxShadow: '0 12px 40px -8px rgba(27, 67, 50, 0.6)' }}
          >
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">SWINGZ</span>
        </Link>

        {/* Global Search */}
        <div className="hidden md:block">
          <GlobalSearch />
        </div>

        {/* User Menu + Mobile Toggle + Theme Toggle */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-brand-navy-800"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Theme toggle</span>
          </Button>

          {/* User Menu – Desktop */}
          <div className="hidden md:block relative">
            <Button
              variant="ghost"
              className="relative h-9 gap-2 hover:bg-gray-100 dark:hover:bg-brand-navy-800 text-gray-900 dark:text-white"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <Avatar className="h-7 w-7 border border-brand-primary-500">
                <AvatarFallback className="bg-brand-primary-600 text-white text-xs">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{user?.name?.split(' ')[0] || 'User'}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-md bg-white dark:bg-brand-navy-800 py-1 shadow-lg z-50 border dark:border-brand-navy-700">
                <div className="border-b px-4 py-2 dark:border-brand-navy-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.email || 'user@example.com'}
                  </p>
                </div>
                <Link
                  href={user?.memberId ? `/members/${user.memberId}` : '#'}
                  onClick={(e) => {
                    if (!user?.memberId) {
                      e.preventDefault();
                      toast.error('Kein Mitgliedsprofil verfügbar');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-brand-navy-700"
                >
                  <User className="h-4 w-4" />
                  Profil
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin/settings"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-brand-navy-700"
                  >
                    <Settings className="h-4 w-4" />
                    Einstellungen
                  </Link>
                )}
                <div className="border-t pt-1 dark:border-brand-navy-700">
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-brand-navy-700">
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-gray-900 dark:text-white"
            onClick={onMenuClick}
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </header>
  );
}
