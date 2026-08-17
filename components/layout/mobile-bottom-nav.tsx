'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isActivePath } from '@/lib/navigation-utils';
import { useUserRole } from '@/hooks/use-user-role';
import { useRoleMode, type RoleModeInitial } from '@/hooks/use-role-mode';
import { Home, Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { mobileNavItems } from '@/lib/navigation';

interface MobileBottomNavProps {
  roles?: string[];
  onMenuClick?: () => void;
  className?: string;
  /** Oberflächen-Modus (Verwalten/Spielen) aus ROLE_MODE_COOKIE — SSR-sicher vom Server. */
  initialRoleMode?: RoleModeInitial;
}

export function MobileBottomNav({
  roles,
  onMenuClick,
  className,
  initialRoleMode,
}: MobileBottomNavProps) {
  const pathname = usePathname();

  // Centralised role detection via hook
  const { isOwner, isSuperAdmin, isAdmin, isTrainer } = useUserRole(roles);

  // Doppelrolle: im Spieler-Modus zeigt die Bottom-Nav die Mitglieder-/Trainer-
  // Ziele statt der Admin-Ziele — deckungsgleich mit der Sidebar.
  const { isMemberMode } = useRoleMode(roles, initialRoleMode);

  // Einträge zentral in lib/navigation.ts — höchste Rolle gewinnt (TSOW tab bar)
  const role = isMemberMode
    ? isTrainer
      ? ('trainer' as const)
      : ('member' as const)
    : isOwner
      ? ('owner' as const)
      : isSuperAdmin
        ? ('superadmin' as const)
        : isAdmin
          ? ('admin' as const)
          : isTrainer
            ? ('trainer' as const)
            : ('member' as const);
  const navItems = mobileNavItems(role);

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 bg-background/80 dark:bg-surface-dark/80 backdrop-blur-xl border-t border-border/60 dark:border-white/[0.06] safe-area-pb',
        'md:hidden',
        className
      )}
      role="navigation"
      aria-label="Navigation"
    >
      <div className="relative flex justify-around items-center h-16 px-2">
        {/* Theme Toggle — absolutely positioned so it doesn't affect justify-around distribution */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
          <ThemeToggle iconSize={18} className="h-11 w-11 rounded-xl" />
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
          const Icon = item.icon ?? Home;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[56px] flex-1 active:scale-[0.97]',
                isActive
                  ? 'text-brand-light dark:text-brand-light bg-brand-light/10 dark:bg-brand-light/20'
                  : 'text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-muted/50 dark:hover:bg-background/[0.03]'
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`${item.name}${isActive ? ' (aktuelle Seite)' : ''}`}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'h-5 w-5 transition-all duration-300',
                    isActive && 'scale-110 drop-shadow-sm'
                  )}
                  aria-hidden="true"
                />
              </div>
              <span
                className={cn(
                  'text-2xs font-medium leading-tight transition-all duration-300',
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
            className="group relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[56px] flex-1 active:scale-[0.97] text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-muted/50 dark:hover:bg-background/[0.03]"
            aria-label="Hauptmenü öffnen"
          >
            <Menu
              className="h-5 w-5 transition-transform duration-200 group-hover:scale-110"
              aria-hidden="true"
            />
            <span className="text-2xs font-medium leading-tight">Menü</span>
          </button>
        )}
      </div>
    </nav>
  );
}
