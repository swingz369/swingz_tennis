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
  Trophy,
  Building2,
} from 'lucide-react';

export function Sidebar({
  roles,
  open,
  onClose,
  selectedClubId,
}: {
  roles?: string[];
  open?: boolean;
  onClose?: () => void;
  selectedClubId?: string | null;
}) {
  const pathname = usePathname();

  const isAdmin = roles?.some((r) => r === 'admin' || r === 'superadmin');
  const isSuperAdmin = roles?.includes('superadmin');
  const isTrainer = roles?.includes('trainer') || isAdmin;

  // Superadmin sees "Vereinsübersicht" only when no club is selected
  const showTenantLink = isSuperAdmin && !selectedClubId;

  const mainNav = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Trainingszeiten', href: '/training-schedule', icon: Calendar },
    { name: 'Anwesenheit', href: '/attendance-history', icon: TrendingUp },
    { name: 'News', href: '/news', icon: Bell },
    { name: 'Buchungen', href: '/bookings', icon: Calendar },
    { name: 'Plätze', href: '/courts', icon: MapPin },
    ...(isTrainer ? [{ name: 'Scheduler', href: '/scheduler', icon: Calendar }] : []),
    { name: 'Abo & Rechnung', href: '/billing', icon: CreditCard, showIf: !isSuperAdmin },
    ...(showTenantLink
      ? [{ name: 'Vereinsübersicht', href: '/admin/tenants', icon: Building2 }]
      : []),
  ];

  const adminNav = [
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3, showIf: isAdmin },
    { name: 'Onboarding', href: '/admin/onboarding', icon: HelpCircle, showIf: isAdmin },
    { name: 'Clubs', href: '/admin/clubs', icon: Club, showIf: isAdmin }, // Changed: isAdmin instead of isSuperAdmin
    { name: 'Mitglieder', href: '/admin/members', icon: Users, showIf: isAdmin },
    { name: 'Schedules', href: '/admin/schedules', icon: Calendar, showIf: isAdmin },
    { name: 'Plätze', href: '/admin/courts', icon: MapPin, showIf: isAdmin },
    { name: 'Genehmigungen', href: '/admin/approvals', icon: CheckCircle, showIf: isAdmin },
    { name: 'Einstellungen', href: '/admin/settings', icon: Settings, showIf: isAdmin },
    { name: 'Billing Admin', href: '/admin/billing', icon: CreditCard, showIf: isAdmin }, // Changed: isAdmin instead of isSuperAdmin
  ].filter((item) => item.showIf);

  return (
    <aside
      className={cn(
        'h-[calc(100vh-4rem)] w-64 border-r border-gray-100 dark:border-white/10 bg-white dark:bg-[#0f2d22]',
        open ? 'fixed inset-y-0 left-0 z-50 block' : 'hidden md:block'
      )}
    >
      <ScrollArea className="h-full py-6">
        <div className="px-4 mb-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <Trophy className="h-5 w-5" />
            <span className="text-sm font-medium">SWINGZ v2.0</span>
          </Link>
        </div>

        <nav className="flex flex-col gap-1 px-3">
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Hauptmenü
          </div>
          {mainNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => onClose?.()}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="mt-8 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Administration
              </div>
              {adminNav.map((item) => {
                const isActive = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => onClose?.()}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF8C5A] text-white shadow-lg'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>
      </ScrollArea>
    </aside>
  );
}
