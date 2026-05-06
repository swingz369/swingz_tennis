'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Home, Calendar, Users, Clock, Settings, Trophy, LogOut, Shield } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  role: string;
}

interface Club {
  id: string;
  name: string;
  slug?: string;
}

interface TrainerSidebarProps {
  user: User;
  club: Club;
  clubId: string;
  isAlsoAdmin: boolean;
}

export function TrainerSidebar({ user, club, clubId, isAlsoAdmin }: TrainerSidebarProps) {
  const pathname = usePathname();

  const navigationItems = [
    {
      title: 'Dashboard',
      icon: Home,
      href: '/trainer/dashboard',
    },
    {
      title: 'Meine Trainings',
      icon: Calendar,
      href: '/trainer/sessions',
    },
    {
      title: 'Teilnehmer',
      icon: Users,
      href: '/trainer/participants',
    },
    {
      title: 'Verfügbarkeit',
      icon: Clock,
      href: '/trainer/availability',
    },
    {
      title: 'Abrechnungen',
      icon: Clock,
      href: '/trainer/hours-logs',
    },
    {
      title: 'Einstellungen',
      icon: Settings,
      href: '/trainer/settings',
    },
  ];

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-white">
      <div className="flex h-16 items-center justify-between border-b px-6">
        <Link href="/trainer/dashboard" className="flex items-center space-x-2">
          <Trophy className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">SwingZ</span>
        </Link>
      </div>

      {/* Club Info */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Trophy className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{club.name}</p>
            <p className="text-xs text-muted-foreground">Trainer Portal</p>
          </div>
        </div>
      </div>

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

          {/* Admin Link (if user is also admin) */}
          {isAlsoAdmin && (
            <>
              <div className="my-4 border-t pt-4">
                <p className="mb-2 px-3 text-xs font-semibold text-muted-foreground">
                  Administration
                </p>
              </div>
              <Link
                href="/admin/dashboard"
                className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Shield className="h-5 w-5" />
                <span>Admin Portal</span>
              </Link>
            </>
          )}
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
              <Link href="/trainer/settings">
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
