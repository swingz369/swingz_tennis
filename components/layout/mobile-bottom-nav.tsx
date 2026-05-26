'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isActivePath } from '@/lib/navigation-utils';
import { useUserRole } from '@/hooks/use-user-role';
import {
  Home,
  Calendar,
  User,
  Menu,
  GraduationCap,
  Users,
  BarChart3,
  Layout,
  Building2,
  BookOpen,
  CreditCard,
  Clock,
  ShoppingBag,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

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

  // Centralised role detection via hook
  const { isSuperAdmin, isAdmin, isTrainer } = useUserRole(roles);

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
      { name: 'Plätze', href: '/admin/courts', icon: Calendar },
      { name: 'Trainer', href: '/admin/trainers', icon: GraduationCap },
      { name: 'Profil', href: '/profile', icon: User },
    ];
  } else if (isTrainer) {
    // Trainer: 5 tabs (reduced from 7 — Gamification + Stunden accessible via dashboard)
    navItems = [
      { name: 'Übersicht', href: '/trainer', icon: Home },
      { name: 'Einheiten', href: '/scheduler', icon: Calendar },
      { name: 'Anwesenheit', href: '/attendance-history', icon: Clock },
      { name: 'Verfügbarkeit', href: '/trainer/availability', icon: Calendar },
      { name: 'Profil', href: '/profile', icon: User },
    ];
  } else {
    // Member: 7 tabs
    navItems = [
      { name: 'Home', href: '/member', icon: Home },
      { name: 'Buchen', href: '/bookings', icon: Calendar },
      { name: 'Training', href: '/training-schedule', icon: BookOpen },
      { name: 'Gamification', href: '/gamification', icon: GraduationCap },
      { name: 'Abrechnung', href: '/billing', icon: CreditCard },
      { name: 'Bestellungen', href: '/meine-bestellungen', icon: ShoppingBag },
      { name: 'Profil', href: '/profile', icon: User },
    ];
  }

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl border-t border-gray-200/60 dark:border-white/[0.06] safe-area-pb',
        !persistent && 'md:hidden',
        className
      )}
      role="navigation"
      aria-label="Navigation"
    >
      <div className="relative flex justify-around items-center h-16 px-2">
        {/* Theme Toggle — absolutely positioned so it doesn't affect justify-around distribution */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
          <ThemeToggle iconSize={16} className="h-8 w-8 rounded-lg" />
        </div>
        {/* Active indicator background */}
        {navItems.map((item) => {
          const isActive = isActivePath(pathname, item.href);
          return isActive ? (
            <div
              key={`indicator-${item.name}`}
              className="absolute bottom-1 h-[3px] w-10 rounded-full bg-brand-light dark:bg-brand-light shadow-sm transition-all duration-300"
              style={{
                left: `${(navItems.indexOf(item) / navItems.length) * 100 + 50 / navItems.length}%`,
                transform: 'translateX(-50%)',
              }}
            />
          ) : null;
        })}
        {navItems.map((item) => {
          const isActive = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[56px] flex-1',
                isActive
                  ? 'text-brand-light dark:text-brand-light bg-brand-light/10 dark:bg-brand-light/20'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50/50 dark:hover:bg-white/[0.03]'
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`${item.name}${isActive ? ' (aktuelle Seite)' : ''}`}
            >
              <div className="relative">
                <item.icon
                  className={cn(
                    'h-5 w-5 transition-all duration-300',
                    isActive && 'scale-110 drop-shadow-sm'
                  )}
                  aria-hidden="true"
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium leading-tight transition-all duration-300',
                  isActive ? 'opacity-100 translate-y-0' : 'opacity-80'
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
        {/* Hamburger menu button — only for admin/superadmin on mobile */}
        {(isSuperAdmin || isAdmin) && onMenuClick && (
          <button
            onClick={onMenuClick}
            className="group relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[56px] flex-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50/50 dark:hover:bg-white/[0.03]"
            aria-label="Hauptmenü öffnen"
          >
            <Menu
              className="h-5 w-5 transition-transform duration-200 group-hover:scale-110"
              aria-hidden="true"
            />
            <span className="text-[10px] font-medium leading-tight">Menü</span>
          </button>
        )}
      </div>
    </nav>
  );
}
