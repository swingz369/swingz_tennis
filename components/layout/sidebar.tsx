'use client';

import { useEffect, useRef } from 'react';
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
  User,
  Newspaper,
  X,
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
  const sidebarRef = useRef<HTMLElement>(null);

  // Handle swipe gestures on mobile
  useEffect(() => {
    if (!open) return undefined;

    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEndX = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
      if (touchStartX - touchEndX > 50) {
        // Swipe left - close sidebar
        onClose?.();
      }
    };

    const sidebar = sidebarRef.current;
    if (sidebar) {
      sidebar.addEventListener('touchstart', handleTouchStart);
      sidebar.addEventListener('touchmove', handleTouchMove);
      sidebar.addEventListener('touchend', handleTouchEnd);

      return () => {
        sidebar.removeEventListener('touchstart', handleTouchStart);
        sidebar.removeEventListener('touchmove', handleTouchMove);
        sidebar.removeEventListener('touchend', handleTouchEnd);
      };
    }

    return undefined;
  }, [open, onClose]);

  const isAdmin = roles?.some((r) => r === 'admin' || r === 'superadmin');
  const isSuperAdmin = roles?.includes('superadmin');
  const isTrainer = roles?.includes('trainer') || isAdmin;

  // Superadmin sees "Vereinsübersicht" only when no club is selected
  const showTenantLink = isSuperAdmin && !selectedClubId;

  const mainNav = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Trainingszeiten', href: '/training-schedule', icon: Calendar },
    { name: 'Anwesenheit', href: '/attendance-history', icon: TrendingUp },
    { name: 'News', href: '/news', icon: Newspaper }, // SECURITY FIX: Changed from Bell to Newspaper
    { name: 'Benachrichtigungen', href: '/notifications', icon: Bell },
    { name: 'Buchungen', href: '/bookings', icon: Calendar },
    { name: 'Platz-Kalender', href: '/courts', icon: MapPin },
    ...(isTrainer ? [{ name: 'Scheduler', href: '/scheduler', icon: Calendar }] : []),
    { name: 'Abo & Rechnung', href: '/billing', icon: CreditCard, showIf: !isSuperAdmin },
    { name: 'Mein Profil', href: '/profile', icon: User },
    ...(showTenantLink
      ? [{ name: 'Vereinsübersicht', href: '/admin/tenants', icon: Building2 }]
      : []),
  ];

  const adminNav = [
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3, showIf: isAdmin },
    { name: 'Onboarding', href: '/admin/onboarding', icon: HelpCircle, showIf: isAdmin },
    { name: 'Clubs', href: '/admin/clubs', icon: Club, showIf: isAdmin },
    { name: 'Mitglieder', href: '/admin/members', icon: Users, showIf: isAdmin },
    { name: 'Trainer', href: '/admin/trainers', icon: Users, showIf: isAdmin },
    { name: 'Schedules', href: '/admin/schedules', icon: Calendar, showIf: isAdmin },
    { name: 'Platzverwaltung', href: '/admin/courts/manage', icon: MapPin, showIf: isAdmin },
    { name: 'Genehmigungen', href: '/admin/approvals', icon: CheckCircle, showIf: isAdmin },
    { name: 'Einstellungen', href: '/admin/settings', icon: Settings, showIf: isAdmin },
    { name: 'Billing Admin', href: '/admin/billing', icon: CreditCard, showIf: isAdmin },
  ].filter((item) => item.showIf);

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        'h-[calc(100vh-4rem)] w-64 border-r border-gray-100 dark:border-white/10 bg-white dark:bg-[#0f2d22] transition-transform duration-300',
        'md:translate-x-0',
        open
          ? 'fixed inset-y-0 left-0 z-50 translate-x-0'
          : 'fixed inset-y-0 left-0 z-50 -translate-x-full md:relative md:translate-x-0'
      )}
    >
      {/* Mobile close button */}
      {open && (
        <button
          onClick={onClose}
          className="md:hidden absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      )}
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
