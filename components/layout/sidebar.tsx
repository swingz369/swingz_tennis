'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NavigationBadge } from './navigation-badge';
import { NavigationCategory } from './navigation-category';
import {
  Home,
  Calendar,
  Users,
  Settings,
  Bell,
  Newspaper,
  GraduationCap,
  Trophy,
  X,
  Layout,
  CheckCircle,
  TrendingUp,
  User,
  CreditCard,
  Building2,
  Clock,
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

  // TODO: Replace with actual counts from API
  const notificationCount = 0; // Replace with actual API call
  const approvalCount = 0; // Replace with actual API call

  // Primary navigation - role-based and prioritized
  const primaryNav = (() => {
    if (isAdmin) {
      return [
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'Admin Dashboard', href: '/admin/panel-v2', icon: Layout },
        { name: 'Benutzerverwaltung', href: '/admin/members', icon: Users },
        {
          name: 'Genehmigungen',
          href: '/admin/approvals',
          icon: CheckCircle,
          badge: approvalCount,
        },
        { name: 'Stundennachweise', href: '/admin/hours-logs', icon: Clock },
        { name: 'Buchungen & Kalender', href: '/bookings', icon: Calendar },
      ];
    }

    if (isTrainer) {
      return [
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'Trainer Dashboard', href: '/trainer', icon: GraduationCap },
        { name: 'Termin-Verwaltung', href: '/scheduler', icon: Calendar },
        { name: 'Meine Anwesenheit', href: '/attendance-history', icon: TrendingUp },
        {
          name: 'Benachrichtigungen',
          href: '/notifications',
          icon: Bell,
          badge: notificationCount,
        },
      ];
    }

    // Member default navigation
    return [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'Buchungen & Kalender', href: '/bookings', icon: Calendar },
      { name: 'Trainingszeiten', href: '/training-schedule', icon: Calendar },
      { name: 'Meine Anwesenheit', href: '/attendance-history', icon: TrendingUp },
      { name: 'Benachrichtigungen', href: '/notifications', icon: Bell, badge: notificationCount },
    ];
  })();

  // Secondary navigation - less frequently accessed
  const secondaryNav = [
    { name: 'Mein Profil', href: '/profile', icon: User },
    { name: 'Abonnement & Rechnung', href: '/billing', icon: CreditCard, showIf: !isSuperAdmin },
    { name: 'News & Updates', href: '/news', icon: Newspaper },
    ...(showTenantLink
      ? [{ name: 'Vereinsübersicht', href: '/admin/tenants', icon: Building2 }]
      : []),
  ].filter((item) => item.showIf !== false);

  // Admin categories with sub-items - only for admin users
  const adminCategories = isAdmin
    ? [
        {
          name: 'Club-Verwaltung',
          icon: Building2,
          subItems: [
            { name: 'Clubs', href: '/admin/clubs' },
            { name: 'Plätze', href: '/admin/courts/manage' },
            { name: 'Trainingszeiten', href: '/admin/schedules' },
          ],
        },
        {
          name: 'Einstellungen',
          icon: Settings,
          subItems: [
            { name: 'Allgemein', href: '/admin/settings' },
            { name: 'Onboarding', href: '/admin/onboarding' },
            { name: 'Billing-Konfiguration', href: '/admin/billing' },
          ],
        },
      ]
    : [];

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
      role="navigation"
      aria-label="Main navigation"
      aria-hidden={!open && 'true'}
    >
      {/* Mobile close button */}
      {open && (
        <button
          onClick={onClose}
          className="md:hidden absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#40916C]"
          aria-label="Menü schließen"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Menü schließen</span>
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

        <nav className="flex flex-col gap-1 px-3" role="navigation" aria-label="Hauptnavigation">
          {/* Primary Navigation */}
          <div
            className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
            role="heading"
            aria-level={2}
          >
            {isAdmin ? 'Administration' : isTrainer ? 'Trainer' : 'Hauptmenü'}
          </div>
          {primaryNav.map((item) => {
            const isActive =
              pathname === item.href || (item.href === '/bookings' && pathname === '/courts');
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => onClose?.()}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? isAdmin
                      ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF8C5A] text-white shadow-lg'
                      : isTrainer
                        ? 'bg-gradient-to-r from-[#22c55e] to-[#15803d] text-white shadow-lg'
                        : 'bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                )}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`${item.name}${isActive ? ' (aktuell)' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{item.name}</span>
                </div>
                {item.badge !== undefined && (
                  <NavigationBadge count={item.badge} variant={isAdmin ? 'danger' : 'default'} />
                )}
              </Link>
            );
          })}

          {/* Admin Categories with Sub-Items */}
          {isAdmin && adminCategories.length > 0 && (
            <>
              <div
                className="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
                role="heading"
                aria-level={2}
              >
                Verwaltung
              </div>
              {adminCategories.map((category) => (
                <NavigationCategory
                  key={category.name}
                  name={category.name}
                  icon={category.icon}
                  subItems={category.subItems}
                  onClose={onClose}
                />
              ))}
            </>
          )}

          {/* Secondary Navigation - Footer Area */}
          {secondaryNav.length > 0 && (
            <>
              <div
                className="mt-8 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
                role="heading"
                aria-level={2}
              >
                Weitere
              </div>
              {secondaryNav.map((item) => {
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
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={`${item.name} Seite${isActive ? ' (aktuell)' : ''}`}
                  >
                    <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
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
