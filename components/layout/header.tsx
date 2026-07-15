'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useUserRole } from '@/hooks/use-user-role';
import {
  Menu,
  LogOut,
  Settings,
  Trophy,
  ChevronDown,
  LayoutDashboard,
  User,
  Search,
} from 'lucide-react';
import { useTenant } from '@/lib/tenant-context';
import { NotificationBell } from '@/components/layout/notification-bell';
import { createClient } from '@/infrastructure/external/supabase/client';
import { useCommandPalette } from '@/components/command-palette-context';

interface HeaderProps {
  user?: {
    id?: string;
    name?: string;
    email?: string;
    avatarUrl?: string | null;
    roles?: string[];
  };
  onMenuClick?: () => void;
}

export function Header({ user, onMenuClick }: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { branding } = useTenant();
  const clubLogoUrl = branding.logos.light || branding.logos.dark;
  const { setOpen: setCommandPaletteOpen } = useCommandPalette();

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

  // Rollen-basierter Header-Subtitle (analog zur Sidebar, damit Owner/Superadmin
  // nicht das falsche Label sehen).
  const { isOwner, isSuperAdmin, isAdmin } = useUserRole(user?.roles);
  const headerSectionLabel = isOwner
    ? 'Swingz'
    : isSuperAdmin
      ? 'Plattform'
      : isAdmin
        ? 'Administration'
        : 'Mitglied';

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
  const dashboardLink = isOwner
    ? '/owner'
    : isSuperAdmin
      ? '/superadmin'
      : isAdmin
        ? '/admin'
        : user?.roles?.includes('trainer')
          ? '/trainer'
          : '/member';

  return (
    <header
      className="sticky top-0 z-50 w-full bg-background/80 dark:bg-brand-dark/80 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/70 supports-[backdrop-filter]:dark:bg-brand-dark/70"
      role="banner"
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Brand cluster — Logo + Marke als geschlossene Einheit.
            Tintierter Gradient-Ring gibt dem Logo visuell Gewicht,
            damit es nicht in der 16-px-Bar „verloren“ wirkt. */}
        <Link
          href={dashboardLink}
          className="flex items-center gap-3 shrink-0 group"
          aria-label="SwingZ Home"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-light/15 via-brand-light/10 to-brand-primary/15 ring-1 ring-brand-light/25 group-hover:ring-brand-light/50 transition-all overflow-hidden">
            {clubLogoUrl && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/no-noninteractive-element-interactions
              <img
                key={clubLogoUrl}
                src={clubLogoUrl}
                alt="Club Logo"
                className="h-6 w-6 object-contain"
                onError={() => setImgFailed(true)}
                onLoad={() => setImgFailed(false)}
              />
            ) : (
              <Trophy className="h-5 w-5 text-brand-light" aria-hidden="true" />
            )}
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-base font-bold tracking-tight text-foreground dark:text-white">
              SWINGZ
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 -mt-0.5">
              {headerSectionLabel}
            </span>
          </div>
        </Link>

        {/* Command palette trigger — als zentrierte primäre Aktion.
            Subtiler bg (kein input-border mehr), gerundet-xl, mit kbd-Hint.
            `hidden md:flex` verhindert, dass die Search-Bar auf Mobile die
            rechten Action-Buttons aus dem Viewport drückt. */}
        <div className="hidden md:flex flex-1 justify-center min-w-0">
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="group flex w-full max-w-md items-center gap-2.5 rounded-xl bg-muted/40 dark:bg-white/[0.04] hover:bg-muted/70 dark:hover:bg-white/[0.08] border border-transparent hover:border-border/50 dark:hover:border-white/[0.08] px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground transition-all"
            aria-label="Suche oder Befehl öffnen"
          >
            <Search
              className="h-4 w-4 shrink-0 transition-colors group-hover:text-brand-light"
              aria-hidden="true"
            />
            <span className="flex-1 text-left truncate">Suche oder Befehl…</span>
            <kbd className="hidden lg:inline-flex items-center h-5 rounded-md border border-border/60 dark:border-white/10 bg-background/80 dark:bg-white/[0.04] px-1.5 text-[11px] font-mono font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right actions — Utility-Cluster (Theme / Notifications / User / Mobile) */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          {user?.id && <NotificationBell userId={user.id} />}

          {/* User Menu (desktop) */}
          <div className="hidden md:block relative" ref={menuRef}>
            <Button
              variant="ghost"
              className="relative h-9 gap-2.5 pl-2 pr-3 hover:bg-muted dark:hover:bg-background/10 text-foreground dark:text-foreground rounded-xl transition-all duration-200"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              aria-label="Benutzermenü öffnen"
            >
              <Avatar className="h-7 w-7 ring-2 ring-brand-light/20 ring-offset-1 ring-offset-transparent transition-shadow duration-300 group-hover:ring-brand-light/40">
                <AvatarImage src={user?.avatarUrl || undefined} alt={user?.name || 'User'} />
                <AvatarFallback className="bg-gradient-to-br from-brand-light to-brand-primary text-white text-xs font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium max-w-[100px] truncate">
                {user?.name?.split(' ')[0] || 'User'}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </Button>

            {/* Dropdown menu with enter animation */}
            <div
              className={`absolute right-0 top-full mt-2 w-64 rounded-xl bg-background dark:bg-surface-dark py-2 shadow-2xl ring-1 ring-ring/60 dark:ring-white/10 z-50 transition-all duration-200 origin-top-right ${
                userMenuOpen
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
              }`}
              role="menu"
              aria-label="Benutzermenü"
            >
              {/* User info */}
              <div className="px-4 py-3 border-b border-border dark:border-white/10" role="none">
                <p className="text-sm font-semibold text-foreground dark:text-white">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
                  {user?.email || 'user@example.com'}
                </p>
                {user?.roles && user.roles.length > 0 && (
                  <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-brand-light/10 text-brand-light dark:bg-brand-light/20 dark:text-success-300">
                    {user.roles[0]}
                  </span>
                )}
              </div>

              {/* Menu items */}
              <div className="py-1" role="none">
                <Link
                  href={dashboardLink}
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground dark:text-foreground hover:bg-muted dark:hover:bg-background/5 transition-colors"
                  role="menuitem"
                >
                  <LayoutDashboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Dashboard
                </Link>
                <Link
                  href="/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground dark:text-foreground hover:bg-muted dark:hover:bg-background/5 transition-colors"
                  role="menuitem"
                >
                  <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Mein Profil
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground dark:text-foreground hover:bg-muted dark:hover:bg-background/5 transition-colors"
                    role="menuitem"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Einstellungen
                  </Link>
                )}
              </div>

              {/* Sign out */}
              <div className="border-t border-border dark:border-white/10 pt-1" role="none">
                <button
                  onClick={handleSignOut}
                  disabled={isLoggingOut}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-500/10 disabled:opacity-50 transition-colors"
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
            className="md:hidden h-9 w-9 text-foreground dark:text-white rounded-xl hover:bg-muted dark:hover:bg-background/10"
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
