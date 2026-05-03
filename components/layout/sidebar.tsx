'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart3,
  Users,
  Calendar,
  Settings,
  Club,
  CreditCard,
  Home,
  HelpCircle,
  MapPin,
  TrendingUp,
  Bell,
  CheckCircle,
} from 'lucide-react';

export function Sidebar({
  roles,
  open,
  onClose,
}: {
  roles?: string[];
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  const isAdmin = roles?.some((r) => r === 'admin' || r === 'superadmin');
  const isSuperAdmin = roles?.includes('superadmin');
  const isTrainer = roles?.includes('trainer') || isAdmin;

  const mainNav = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Trainingszeiten', href: '/training-schedule', icon: Calendar },
    { name: 'Anwesenheit', href: '/attendance-history', icon: TrendingUp },
    { name: 'News', href: '/news', icon: Bell },
    { name: 'Bookings', href: '/bookings', icon: Calendar },
    { name: 'Plätze', href: '/courts', icon: MapPin },
    ...(isTrainer ? [{ name: 'Scheduler', href: '/scheduler', icon: Calendar }] : []),
    { name: 'Abo & Rechnung', href: '/billing', icon: CreditCard, showIf: !isSuperAdmin }, // Für Mitglieder
  ];

  const adminNav = [
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3, showIf: isAdmin },
    { name: 'Onboarding', href: '/admin/onboarding', icon: HelpCircle, showIf: isAdmin },
    { name: 'Clubs', href: '/admin/clubs', icon: Club, showIf: isAdmin },
    { name: 'Members', href: '/admin/members', icon: Users, showIf: isAdmin },
    { name: 'Schedules', href: '/admin/schedules', icon: Calendar, showIf: isAdmin },
    { name: 'Plätze Verwaltung', href: '/admin/courts', icon: MapPin, showIf: isAdmin },
    { name: 'Genehmigungen', href: '/admin/approvals', icon: CheckCircle, showIf: isAdmin },
    { name: 'Settings', href: '/admin/settings', icon: Settings, showIf: isAdmin },
    { name: 'Billing Admin', href: '/admin/billing', icon: CreditCard, showIf: isSuperAdmin },
  ].filter((item) => item.showIf);

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
              onClick={() => {
                onClose?.();
              }}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === item.href
                  ? 'bg-brand-primary/5 text-brand-primary'
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
                  onClick={() => {
                    onClose?.();
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    pathname?.startsWith(item.href)
                      ? 'bg-brand-primary/5 text-brand-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
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
