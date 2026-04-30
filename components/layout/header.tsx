'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Menu,
  X,
  User,
  LogOut,
  Settings,
  BarChart3,
  Calendar,
  Home,
  Trophy,
  Users,
  ChevronDown,
  Moon,
  Sun,
} from 'lucide-react';
import { GlobalSearch } from '@/components/layout/global-search';

interface HeaderProps {
  user?: {
    name?: string;
    email?: string;
  };
  onMenuClick?: () => void;
}

export function Header({ user }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Bookings', href: '/bookings', icon: Calendar },
    {
      name: 'Admin',
      href: '#',
      icon: Trophy,
      children: [
        { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
        { name: 'Clubs', href: '/admin/clubs', icon: Users },
      ],
    },
  ];

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname?.startsWith(path);
  };

  return (
    <header
      className="sticky top-0 z-50 w-full border-b bg-white dark:bg-brand-navy-900 text-gray-900 dark:text-white"
      style={{
        boxShadow: '0 8px 24px -4px rgba(30,58,95,0.3)',
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary-500 to-brand-primary-700"
            style={{ boxShadow: '0 12px 40px -8px rgba(27, 67, 50, 0.6)' }}
          >
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">SWINGZ</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex md:gap-1">
          {navigation.map((item) => (
            <div key={item.name} className="relative">
              {item.children ? (
                <div className="relative">
                  <Button
                    variant="ghost"
                    className={cn(
                      'gap-2 hover:bg-gray-100 dark:hover:bg-brand-navy-800',
                      isActive(item.href)
                        ? 'bg-brand-primary-50 dark:bg-brand-navy-800 text-brand-primary-700 dark:text-white'
                        : 'text-gray-900 dark:text-white'
                    )}
                    onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  {adminMenuOpen && (
                    <div className="absolute left-0 top-full mt-1 w-48 rounded-md bg-white py-1 shadow-lg z-50">
                      {item.children.map((child) => (
                 <Link
                   key={child.name}
                   href={child.href}
                   onClick={() => setAdminMenuOpen(false)}
                   className={cn(
                     'flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-brand-navy-800',
                     isActive(child.href) &&
                       'bg-brand-primary-50 dark:bg-brand-navy-700 text-brand-primary-700 dark:text-white font-medium'
                   )}
                 >
                          <child.icon className="h-4 w-4" />
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
               ) : (
                 <Link href={item.href}>
                   <Button
                     variant="ghost"
                     className={cn(
                       'gap-2 hover:bg-gray-100 dark:hover:bg-brand-navy-800',
                       isActive(item.href)
                         ? 'bg-brand-primary-50 dark:bg-brand-navy-800 text-brand-primary-700 dark:text-white'
                         : 'text-gray-900 dark:text-white'
                     )}
                   >
                     <item.icon className="h-4 w-4" />
                     {item.name}
                   </Button>
                 </Link>
               )}
            </div>
          ))}
        </nav>

        {/* Global Search */}
        <div className="block md:block">
          <GlobalSearch />
        </div>

        {/* User Menu + Mobile Toggle + Theme Toggle */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle – Desktop */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex h-9 w-9 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-brand-navy-800"
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
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email || 'user@example.com'}</p>
                </div>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-brand-navy-700"
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-brand-navy-700"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
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
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="border-t bg-white dark:bg-brand-navy-900 md:hidden">
          <div className="space-y-1 px-4 py-3">
            {navigation.map((item) => (
              <div key={item.name} className="py-1">
                {item.children ? (
                     <div className="space-y-1">
                       <div className="flex items-center gap-2 py-2 text-sm font-medium text-gray-900 dark:text-white">
                         <item.icon className="h-4 w-4" />
                         {item.name}
                       </div>
                       <div className="ml-4 space-y-1 border-l-2 border-brand-primary-500 pl-3">
                         {item.children.map((child) => (
                           <Link
                             key={child.name}
                             href={child.href}
                             onClick={() => setMobileMenuOpen(false)}
                             className={cn(
                               'flex items-center gap-2 py-2 text-sm',
                               isActive(child.href)
                                 ? 'text-brand-primary-500 font-medium'
                                 : 'text-gray-700 dark:text-gray-300 hover:text-brand-primary-500'
                             )}
                           >
                          <child.icon className="h-4 w-4" />
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                 ) : (
                   <Link
                     href={item.href}
                     onClick={() => setMobileMenuOpen(false)}
                     className={cn(
                       'flex items-center gap-3 py-2 text-sm font-medium',
                       isActive(item.href)
                         ? 'text-brand-primary-500'
                         : 'text-gray-900 dark:text-gray-100 hover:text-brand-primary-500 dark:hover:text-brand-primary-500'
                     )}
                   >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 dark:border-brand-navy-800 px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 border border-brand-primary-500">
                <AvatarFallback className="bg-brand-primary-600 text-white text-sm">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email || 'user@example.com'}</p>
              </div>
            </div>
            {/* Theme Toggle – Mobile */}
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full justify-start text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-brand-navy-800"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="mr-2 h-4 w-4" />
              <Moon className="mr-2 h-4 w-4" />
              {theme === 'dark' ? 'Heller Modus' : 'Dunkler Modus'}
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
