'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Home,
  Users,
  Calendar,
  Settings,
  Building2,
  CreditCard,
  TrendingUp,
  CheckCircle,
  Trophy,
  ChevronDown,
  LogOut,
  Shuffle,
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

interface Club {
  id: string;
  name: string;
  slug?: string;
}

interface Membership {
  id: string;
  role: string;
  club_id: string;
  clubs: Club | Club[];
}

interface AdminSidebarProps {
  user: User;
  memberships: Membership[];
  activeClubId: string;
  activeClub: Club | null;
  isSuperadmin: boolean;
}

export function AdminSidebar({
  user,
  memberships,
  activeClubId,
  activeClub,
  isSuperadmin,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [switching, setSwitching] = useState(false);

  const navigationItems = [
    {
      title: 'Dashboard',
      icon: Home,
      href: '/admin/dashboard',
    },
    {
      title: 'Mitglieder',
      icon: Users,
      href: '/admin/members',
    },
    {
      title: 'Trainer',
      icon: Trophy,
      href: '/admin/trainers',
    },
    {
      title: 'Plätze',
      icon: Building2,
      href: '/admin/courts',
    },
    {
      title: 'Spielzeiten',
      icon: Calendar,
      href: '/admin/seasons',
    },
    {
      title: 'Abrechnung',
      icon: CreditCard,
      href: '/admin/billing',
    },
    {
      title: 'Analytics',
      icon: TrendingUp,
      href: '/admin/analytics',
    },
    {
      title: 'Matchmaking',
      icon: Shuffle,
      href: '/admin/ai/matchmaking',
    },
    ...(isSuperadmin
      ? [
          {
            title: 'Clubs',
            icon: Building2,
            href: '/admin/clubs',
          },
        ]
      : []),
    {
      title: 'Einstellungen',
      icon: Settings,
      href: '/admin/settings',
    },
  ];

  const handleSwitchClub = async (clubId: string) => {
    setSwitching(true);
    try {
      const response = await fetch('/api/admin/switch-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId }),
      });

      if (response.ok) {
        window.location.reload();
      } else {
        console.error('Failed to switch club');
      }
    } catch (error) {
      console.error('Error switching club:', error);
    } finally {
      setSwitching(false);
    }
  };

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-white">
      <div className="flex h-16 items-center justify-between border-b px-6">
        <Link href="/admin/dashboard" className="flex items-center space-x-2">
          <Trophy className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">SwingZ</span>
        </Link>
      </div>

      {/* Club Selector (Superadmin only) */}
      {isSuperadmin && memberships.length > 1 && (
        <div className="border-b px-4 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between" disabled={switching}>
                <span className="truncate">{activeClub?.name || 'Club auswählen'}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              {memberships.map((membership) => {
                const club = Array.isArray(membership.clubs)
                  ? membership.clubs[0]
                  : membership.clubs;
                return (
                  <DropdownMenuItem
                    key={membership.id}
                    onClick={() => handleSwitchClub(membership.club_id)}
                    className={cn(membership.club_id === activeClubId && 'bg-accent')}
                  >
                    {club?.name || 'Unbekannter Club'}
                    {membership.club_id === activeClubId && (
                      <CheckCircle className="ml-auto h-4 w-4" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-4 py-6">
        <nav className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User Menu */}
      <div className="border-t p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start space-x-3 px-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/admin/settings">
                <Settings className="mr-2 h-4 w-4" />
                Einstellungen
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
