'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  Calendar,
  User,
  Menu,
  GraduationCap,
  ClipboardCheck,
  Users,
  BarChart3,
  Layout,
  Building2,
  BookOpen,
  Newspaper,
  CreditCard,
} from 'lucide-react';

interface MobileBottomNavProps {
  roles?: string[];
  onMenuClick?: () => void;
  /** When true, renders without `md:hidden` — always visible (for trainer/member) */
  persistent?: boolean;
  className?: string;
}

export function MobileBottomNav({
  roles,
  onMenuClick,
  persistent,
  className,
}: MobileBottomNavProps) {
  const pathname = usePathname();

  const isSuperAdmin = roles?.includes('superadmin') ?? false;
  const isAdmin = roles?.includes('admin') ?? false;
  const isTrainer = roles?.includes('trainer') ?? false;

  // Navigation items based on HIGHEST role — matches TSOW tab bar
  let navItems: { name: string; href: string; icon: React.ElementType }[] = [];

  if (isSuperAdmin) {
    navItems = [
      { name: 'Dashboard', href: '/superadmin', icon: Layout },
      { name: 'Vereine', href: '/superadmin/tenants', icon: Building2 },
      { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      { name: 'Profil', href: '/profile', icon: User },
    ];
  } else if (isAdmin) {
    navItems = [
      { name: 'Dashboard', href: '/admin', icon: Home },
      { name: 'Mitglieder', href: '/admin/members', icon: Users },
      { name: 'Trainer', href: '/admin/trainers', icon: GraduationCap },
      { name: 'Profil', href: '/profile', icon: User },
    ];
  } else if (isTrainer) {
    // Trainer: 5 tabs like TSOW
    navItems = [
      { name: 'Übersicht', href: '/trainer', icon: Home },
      { name: 'Einheiten', href: '/trainer/sessions', icon: Calendar },
      { name: 'Anwesenheit', href: '/attendance-history', icon: ClipboardCheck },
      { name: 'Abrechnung', href: '/billing', icon: CreditCard },
      { name: 'Profil', href: '/profile', icon: User },
    ];
  } else {
    // Member: 5 tabs like TSOW
    navItems = [
      { name: 'Home', href: '/member', icon: Home },
      { name: 'Buchen', href: '/bookings', icon: Calendar },
      { name: 'Training', href: '/training-schedule', icon: BookOpen },
      { name: 'News', href: '/news', icon: Newspaper },
      { name: 'Profil', href: '/profile', icon: User },
    ];
  }

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#0f2d22] border-t border-gray-200 dark:border-white/10 safe-area-pb',
        !persistent && 'md:hidden',
        className
      )}
      role="navigation"
      aria-label="Navigation"
    >
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/member' &&
              item.href !== '/trainer' &&
              item.href !== '/admin' &&
              item.href !== '/superadmin' &&
              pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[56px] flex-1',
                isActive
                  ? 'text-[#40916C] dark:text-[#52B788]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`${item.name}${isActive ? ' (aktuelle Seite)' : ''}`}
            >
              <item.icon
                className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')}
                aria-hidden="true"
              />
              <span className="text-xs font-medium leading-tight">{item.name}</span>
            </Link>
          );
        })}
        {/* Hamburger menu button — only for admin/superadmin on mobile */}
        {(isSuperAdmin || isAdmin) && onMenuClick && (
          <button
            onClick={onMenuClick}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[56px] flex-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-[#40916C]"
            aria-label="Hauptmenü öffnen"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-medium">Menü</span>
          </button>
        )}
      </div>
    </nav>
  );
}
