'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart3, Users, Calendar, Settings, Trophy, Club } from 'lucide-react';

export function Sidebar({ roles, open }: { roles?: string[]; open?: boolean }) {
  const pathname = usePathname();

  const isAdmin = roles?.some((r) => r === 'admin' || r === 'superadmin');
  const isTrainer = roles?.includes('trainer') || isAdmin;

  const mainNav = [
    { name: 'Dashboard', href: '/dashboard', icon: Trophy },
    { name: 'Bookings', href: '/bookings', icon: Calendar },
    ...(isTrainer ? [{ name: 'Scheduler', href: '/scheduler', icon: Calendar }] : []),
  ];

  const adminNav = [
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Clubs', href: '/admin/clubs', icon: Club, disabled: !isAdmin || true },
    { name: 'Members', href: '/admin/members', icon: Users, disabled: !isAdmin || true },
    { name: 'Settings', href: '/admin/settings', icon: Settings, disabled: !isAdmin || true },
  ];

  return (
    <aside
      className={cn(
        'h-[calc(100vh-4rem)] w-64 border-r bg-background',
        // Mobile: fixed drawer when open, hidden otherwise
        open ? 'fixed inset-y-0 left-0 z-50 block' : 'hidden md:block'
      )}
    >
      <ScrollArea className="h-full py-4">
        <nav className="flex flex-col gap-1 px-2">
          {/* Main Section */}
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Main
          </div>
          {mainNav.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === item.href
                  ? 'bg-brand-primary-50 text-brand-primary-700'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.name}</span>
            </Link>
          ))}

          {/* Administration (Admin/Superadmin only) */}
          {isAdmin && (
            <>
              <div className="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Administration
              </div>
              {adminNav.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    item.disabled
                      ? 'cursor-not-allowed opacity-50'
                      : pathname?.startsWith(item.href)
                        ? 'bg-brand-primary-50 text-brand-primary-700'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                  onClick={(e) => item.disabled && e.preventDefault()}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              ))}
            </>
          )}
        </nav>
      </ScrollArea>
    </aside>
  );
}
