'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

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
import { useSearchDialog } from '@/components/command-palette-context';
import { GlobalSearch } from '@/components/layout/global-search';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface HeaderProps {
  user?: {
    id?: string;
    name?: string;
    email?: string;
    avatarUrl?: string | null;
    roles?: string[];
    club?: { id: string; name: string } | null;
  };
  onMenuClick?: () => void;
}

export function Header({ user, onMenuClick }: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { branding } = useTenant();
  const clubLogoUrl = branding.logos.light || branding.logos.dark;
  const { setOpen: setSearchOpen } = useSearchDialog();

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
  // Die Rollen-Beschriftung („Vereinsverwaltung“, „Plattform-Konsole“ …) ist
  // mit dem Marken-Cluster entfallen. Sie war die Unterzeile des Vereinsnamens
  // im Header; die Rolle steht weiterhin als Pille im Seitenkopf des
  // Dashboards. `isOwner`/`isSuperAdmin` werden unten noch für das Ziel des
  // Logo-Links gebraucht.
  const { isOwner, isSuperAdmin, isAdmin } = useUserRole(user?.roles);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore errors if not logged in via Supabase
    }
    setUserMenuOpen(false);
    // Vollständige Navigation auf die Server-Route statt router.push('/login').
    // Die Session-Cookies setzt der Server-Endpoint /api/auth/login; ein
    // clientseitiges signOut() räumt sie nicht ab. proxy.ts sah deshalb weiter
    // einen eingeloggten User, schickte /login per Regel 7 zurück auf
    // /dashboard und von dort in den Rollenbereich — der Logout endete im
    // Nirgendwo statt auf der Loginseite. /api/auth/logout löscht zusätzlich
    // `admin_club_id` und `selected-club-id` und redirectet selbst auf /login.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- volle Navigation nötig, s. Kommentar oben
    window.location.href = '/api/auth/logout';
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
      // Ruhige, deckende Leiste über der Inhaltsspalte statt der früheren
      // durchscheinenden Brand-Dark-Bar. Der Verlauf gegen den Inhalt kam
      // vorher über Transparenz, jetzt über eine Kante — das bleibt beim
      // Scrollen stabil und funktioniert in beiden Themes gleich.
      className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75"
      role="banner"
    >
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Marke und Vereinsname sind in die Sidebar gewandert (SwingZ-Logo
            oben, Verein direkt darunter im Switcher). Sie standen hier
            doppelt: die Sidebar nennt ohnehin den Kontext, in dem man sich
            bewegt, und der Header verlor dadurch links ein Drittel seiner
            Breite an eine Information, die sich nie ändert.
            Auf Mobile ist die Sidebar zugeklappt — dort bleibt das Logo als
            Rückweg zum Dashboard sichtbar. */}
        <Link
          href={dashboardLink}
          className="flex shrink-0 items-center gap-2 md:hidden"
          aria-label="SwingZ Home"
        >
          <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
            {clubLogoUrl && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/no-noninteractive-element-interactions
              <img
                key={clubLogoUrl}
                src={clubLogoUrl}
                alt="Club Logo"
                className="h-5 w-5 object-contain"
                onError={() => setImgFailed(true)}
                onLoad={() => setImgFailed(false)}
              />
            ) : (
              <Trophy className="h-4 w-4 text-primary" aria-hidden="true" />
            )}
          </span>
          <span className="text-[15px] font-bold tracking-[-0.02em]">SwingZ</span>
        </Link>

        {/* Right actions — Utility-Cluster (Suche / Theme / Notifications / User / Mobile).
            Suche war früher eine dauerhaft zentrierte Bar — auf allen Rollen (auch
            Member/Trainer ohne echten Bedarf) sichtbar und hat in der Mitte Platz
            gefressen. Jetzt nur noch ein Icon neben dem Theme-Toggle, Klick öffnet
            die fokussierte Suche (SearchDialog); ⌘K öffnet weiterhin die Command
            Palette mit Navigation/Aktionen. `ml-auto` schiebt den Cluster nach
            rechts, da die zentrierte Bar als Spacer wegfällt. */}
        {/* Echtes Suchfeld mit Ergebnis-Dropdown — ab sm. Vorher war das hier nur
            ein Knopf in Feld-Optik, der einen modalen Dialog über die Seite legte,
            aus der man gerade heraus sucht. Auf Mobile bleibt es beim Icon rechts
            (SearchDialog): dort ist die Breite nicht übrig und ein Overlay ist die
            richtige Form. */}
        <GlobalSearch className="ml-6 hidden sm:block w-64 lg:w-80" />

        <div className="flex items-center gap-0.5 shrink-0 ml-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden h-9 w-9 text-foreground rounded-xl hover:bg-muted"
                onClick={() => setSearchOpen(true)}
                aria-label="Suche öffnen"
              >
                <Search className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Suche öffnen</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Suche öffnen</TooltipContent>
          </Tooltip>

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
                <AvatarFallback className="bg-gradient-to-br from-brand-light to-primary text-white text-xs font-semibold">
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
              className={`absolute right-0 top-full mt-2 w-64 rounded-xl bg-background dark:bg-surface-dark py-2 shadow-lg ring-1 ring-ring/60 dark:ring-white/10 z-50 transition-all duration-200 origin-top-right ${
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
                  <span
                    className={
                      isOwner
                        ? 'inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-info-100 text-info-700'
                        : isSuperAdmin
                          ? 'inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-info-100 text-info-700'
                          : 'inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-brand-light/10 text-brand-light dark:bg-brand-light/20 dark:text-success-300'
                    }
                  >
                    {isOwner
                      ? 'Plattform-Eigentümer'
                      : isSuperAdmin
                        ? 'Tennisschule'
                        : user.roles[0]}
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
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 disabled:opacity-50 transition-colors"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {isLoggingOut ? 'Abmelden...' : 'Abmelden'}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile menu toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent>Menü öffnen</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
