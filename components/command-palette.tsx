'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Home,
  Calendar,
  MessageSquare,
  CreditCard,
  Users,
  User,
  Settings,
  UserPlus,
  PenSquare,
  FileText,
  BarChart3,
  GraduationCap,
  Trophy,
  ClipboardCheck,
  Bell,
  Newspaper,
  MapPin,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command';
import { useTheme } from 'next-themes';
import { useUserRole } from '@/hooks/use-user-role';
import { apiFetch } from '@/lib/api-fetch';

interface SearchResult {
  id: string;
  type: 'member' | 'booking' | 'trainer' | 'club';
  title: string;
  subtitle?: string;
  url: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { isAdmin, isSuperAdmin } = useUserRole();

  // Keyboard shortcut Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search API when query changes
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data.slice(0, 8) : []);
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery('');
      router.push(path);
    },
    [router]
  );

  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  // Navigation items based on role
  const navItems: Array<{
    label: string;
    href: string;
    icon: React.ElementType;
    shortcut?: string;
    roles?: string[];
  }> = [
    { label: 'Dashboard', href: '/dashboard', icon: Home, shortcut: `${modKey}+D` },
    { label: 'Buchungen', href: '/bookings', icon: Calendar, shortcut: `${modKey}+B` },
    { label: 'Nachrichten', href: '/messages', icon: MessageSquare },
    { label: 'Rechnungen', href: '/billing', icon: CreditCard },
    { label: 'Trainingsplan', href: '/training-schedule', icon: ClipboardCheck },
    { label: 'Benachrichtigungen', href: '/notifications', icon: Bell },
    { label: 'News', href: '/news', icon: Newspaper },
    { label: 'Profil', href: '/profile', icon: User },
  ];

  const adminNavItems: Array<{
    label: string;
    href: string;
    icon: React.ElementType;
  }> = [
    { label: 'Admin Dashboard', href: '/admin', icon: Home },
    { label: 'Mitglieder', href: '/admin/members', icon: Users },
    { label: 'Trainer', href: '/admin/trainers', icon: GraduationCap },
    { label: 'Plätze', href: '/admin/courts/manage', icon: MapPin },
    { label: 'Abrechnung', href: '/admin/billing', icon: FileText },
    { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { label: 'Einstellungen', href: '/admin/settings', icon: Settings },
    { label: 'Turniere', href: '/admin/tournaments', icon: Trophy },
  ];

  const quickActions: Array<{
    label: string;
    href: string;
    icon: React.ElementType;
    roles?: string[];
  }> = [
    { label: 'Neue Buchung', href: '/bookings', icon: Calendar },
    {
      label: 'Nachricht senden',
      href: '/messages',
      icon: PenSquare,
      roles: ['admin', 'superadmin'],
    },
    {
      label: 'Mitglied einladen',
      href: '/admin/members',
      icon: UserPlus,
      roles: ['admin', 'superadmin'],
    },
    {
      label: 'Rechnung erstellen',
      href: '/admin/billing',
      icon: FileText,
      roles: ['admin', 'superadmin'],
    },
  ];

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'member':
        return Users;
      case 'booking':
        return Calendar;
      case 'trainer':
        return GraduationCap;
      case 'club':
        return Home;
      default:
        return Search;
    }
  };

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some(
      (r) => (r === 'admin' && isAdmin) || (r === 'superadmin' && isSuperAdmin)
    );
  });

  const filteredAdminNav = isAdmin || isSuperAdmin ? adminNavItems : [];

  const filteredQuickActions = quickActions.filter((action) => {
    if (!action.roles) return true;
    return action.roles.some(
      (r) => (r === 'admin' && isAdmin) || (r === 'superadmin' && isSuperAdmin)
    );
  });

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Suchen oder Aktion ausführen..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{loading ? 'Suche...' : 'Keine Ergebnisse gefunden'}</CommandEmpty>

        {/* Search Results */}
        {results.length > 0 && (
          <CommandGroup heading="Suchergebnisse">
            {results.map((result) => {
              const Icon = getTypeIcon(result.type);
              return (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  onSelect={() => navigate(result.url)}
                  className="cursor-pointer"
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{result.title}</span>
                    {result.subtitle && (
                      <span className="text-xs text-muted-foreground ml-2">{result.subtitle}</span>
                    )}
                  </div>
                  <span className="text-2xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {result.type === 'member'
                      ? 'Mitglied'
                      : result.type === 'booking'
                        ? 'Buchung'
                        : result.type === 'trainer'
                          ? 'Trainer'
                          : 'Verein'}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Quick Actions */}
        {query.length === 0 && filteredQuickActions.length > 0 && (
          <CommandGroup heading="Aktionen">
            {filteredQuickActions.map((action) => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={action.label}
                  onSelect={() => navigate(action.href)}
                  className="cursor-pointer"
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {action.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Navigation */}
        {query.length === 0 && (
          <>
            <CommandGroup heading="Navigation">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    onSelect={() => navigate(item.href)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {item.label}
                    {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {filteredAdminNav.length > 0 && (
              <CommandGroup heading="Admin">
                {filteredAdminNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.href}
                      onSelect={() => navigate(item.href)}
                      className="cursor-pointer"
                    >
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {item.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {/* Theme Toggle */}
            <CommandGroup heading="Einstellungen">
              <CommandItem onSelect={() => setTheme('light')} className="cursor-pointer">
                <Sun className="mr-2 h-4 w-4 text-muted-foreground" />
                Helles Design
                {theme === 'light' && <CommandShortcut>✓</CommandShortcut>}
              </CommandItem>
              <CommandItem onSelect={() => setTheme('dark')} className="cursor-pointer">
                <Moon className="mr-2 h-4 w-4 text-muted-foreground" />
                Dunkles Design
                {theme === 'dark' && <CommandShortcut>✓</CommandShortcut>}
              </CommandItem>
              <CommandItem onSelect={() => setTheme('system')} className="cursor-pointer">
                <Monitor className="mr-2 h-4 w-4 text-muted-foreground" />
                System
                {theme === 'system' && <CommandShortcut>✓</CommandShortcut>}
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
