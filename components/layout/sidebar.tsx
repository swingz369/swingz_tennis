'use client';

import { useEffect, useRef, useState } from 'react';
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
  CalendarRange,
  MapPin,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Club {
  id: string;
  name: string;
}

export function Sidebar({
  roles,
  open,
  onClose,
  selectedClubId,
  clubs,
}: {
  roles?: string[];
  open?: boolean;
  onClose?: () => void;
  selectedClubId?: string | null;
  clubs?: Club[];
}) {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);
  const [clubSwitcherOpen, setClubSwitcherOpen] = useState(false);

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

  // Role detection — use HIGHEST role (superadmin > admin > trainer > member)
  const isSuperAdmin = roles?.includes('superadmin') ?? false;
  const isAdmin = roles?.includes('admin') ?? false;
  const isTrainer = roles?.includes('trainer') ?? false;

  // Active club for display
  const activeClub = clubs?.find((c) => c.id === selectedClubId) ?? clubs?.[0] ?? null;
  const hasMultipleClubs = (clubs?.length ?? 0) > 1;

  // TODO: Replace with actual counts from API
  const notificationCount = 0;
  const approvalCount = 0;

  const handleSwitchClub = async (clubId: string) => {
    setClubSwitcherOpen(false);
    try {
      const response = await fetch('/api/admin/switch-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId }),
      });
      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error switching club:', error);
    }
  };

  // Primary navigation — role-based, highest role wins
  const primaryNav = (() => {
    // SUPERADMIN: Platform-wide administration
    if (isSuperAdmin) {
      return [
        { name: 'Superadmin Dashboard', href: '/superadmin', icon: Layout },
        { name: 'Vereinsübersicht', href: '/superadmin/tenants', icon: Building2 },
        { name: 'Club-Verwaltung', href: '/superadmin/clubs', icon: Building2 },
        { name: 'Plattform-Analyse', href: '/admin/analytics', icon: BarChart3 },
      ];
    }

    // ADMIN: Club-scoped administration
    if (isAdmin) {
      return [
        { name: 'Dashboard', href: '/admin', icon: Home },
        { name: 'Mitglieder', href: '/admin/members', icon: Users },
        { name: 'Trainer', href: '/admin/trainers', icon: GraduationCap },
        { name: 'Plätze', href: '/admin/courts', icon: MapPin },
        { name: 'Spielzeiten', href: '/admin/seasons', icon: CalendarRange },
        { name: 'Buchungen', href: '/bookings', icon: Calendar },
        {
          name: 'Genehmigungen',
          href: '/admin/approvals',
          icon: CheckCircle,
          badge: approvalCount,
        },
        { name: 'Stundennachweise', href: '/admin/hours-logs', icon: Clock },
      ];
    }

    // TRAINER: Uses bottom nav (no sidebar needed); this is a fallback
    if (isTrainer) {
      return [
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

    // MEMBER: Uses bottom nav; this is a fallback
    return [
      { name: 'Home', href: '/member', icon: Home },
      { name: 'Buchungen & Kalender', href: '/bookings', icon: Calendar },
      { name: 'Trainingszeiten', href: '/training-schedule', icon: Calendar },
      { name: 'Meine Anwesenheit', href: '/attendance-history', icon: TrendingUp },
      {
        name: 'Benachrichtigungen',
        href: '/notifications',
        icon: Bell,
        badge: notificationCount,
      },
    ];
  })();

  // Secondary navigation
  const secondaryNav = [
    { name: 'Mein Profil', href: '/profile', icon: User },
    ...(!isSuperAdmin
      ? [{ name: 'Abonnement & Rechnung', href: '/billing', icon: CreditCard }]
      : []),
    { name: 'News & Updates', href: '/news', icon: Newspaper },
  ];

  // Category sections with sub-items
  const categoryNav = (() => {
    if (isSuperAdmin) {
      return [
        {
          name: 'Plattform-Verwaltung',
          icon: Settings,
          subItems: [
            { name: 'System-Einstellungen', href: '/admin/settings' },
            { name: 'Billing-Verwaltung', href: '/admin/billing' },
            { name: 'Audit-Logs', href: '/admin/audit-logs' },
            { name: 'Verein wechseln', href: '/select-admin-club' },
          ],
        },
      ];
    }

    if (isAdmin) {
      return [
        {
          name: 'Analytics & Berichte',
          icon: BarChart3,
          subItems: [
            { name: 'Analytics', href: '/admin/analytics' },
            { name: 'Abrechnung', href: '/admin/billing' },
          ],
        },
        {
          name: 'Einstellungen',
          icon: Settings,
          subItems: [
            { name: 'Allgemein', href: '/admin/settings' },
            { name: 'Onboarding', href: '/admin/onboarding' },
            { name: 'Plätze verwalten', href: '/admin/courts/manage' },
            { name: 'Trainingszeiten', href: '/admin/schedules' },
          ],
        },
      ];
    }

    return [];
  })();

  // Active color theme per role
  const activeGradient = isSuperAdmin
    ? 'bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-lg'
    : isAdmin
      ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF8C5A] text-white shadow-lg'
      : isTrainer
        ? 'bg-gradient-to-r from-[#22c55e] to-[#15803d] text-white shadow-lg'
        : 'bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] text-white shadow-lg';

  const sectionLabel = isSuperAdmin
    ? 'Plattform'
    : isAdmin
      ? 'Administration'
      : isTrainer
        ? 'Trainer'
        : 'Hauptmenü';

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
      aria-hidden={!open || undefined}
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
        {/* Logo */}
        <div className="px-4 mb-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <Trophy className="h-5 w-5" />
            <span className="text-sm font-medium">SWINGZ v2.0</span>
          </Link>
        </div>

        {/* Superadmin Club Switcher */}
        {isSuperAdmin && hasMultipleClubs && (
          <div className="mx-3 mb-4 border border-gray-100 dark:border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setClubSwitcherOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-4 w-4 shrink-0 text-purple-500" />
                <span className="truncate">{activeClub?.name ?? 'Club auswählen'}</span>
              </div>
              {clubSwitcherOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
              )}
            </button>
            {clubSwitcherOpen && (
              <div className="border-t border-gray-100 dark:border-white/10">
                {clubs?.map((club) => (
                  <button
                    key={club.id}
                    onClick={() => handleSwitchClub(club.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                      club.id === (selectedClubId ?? activeClub?.id)
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                    )}
                  >
                    <CheckCircle
                      className={cn(
                        'h-4 w-4 shrink-0',
                        club.id === (selectedClubId ?? activeClub?.id)
                          ? 'text-purple-500'
                          : 'text-transparent'
                      )}
                    />
                    <span className="truncate">{club.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className="flex flex-col gap-1 px-3" role="navigation" aria-label="Hauptnavigation">
          {/* Section label */}
          <div
            className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
            role="heading"
            aria-level={2}
          >
            {sectionLabel}
          </div>

          {/* Primary Navigation */}
          {primaryNav.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => onClose?.()}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? activeGradient
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                )}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`${item.name}${isActive ? ' (aktuell)' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{item.name}</span>
                </div>
                {(item as any).badge !== undefined && (
                  <NavigationBadge
                    count={(item as any).badge}
                    variant={isAdmin ? 'danger' : 'default'}
                  />
                )}
              </Link>
            );
          })}

          {/* Category sections */}
          {categoryNav.length > 0 && (
            <>
              <div
                className="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
                role="heading"
                aria-level={2}
              >
                Verwaltung
              </div>
              {categoryNav.map((category) => (
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

          {/* Secondary Navigation */}
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
                        ? activeGradient
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={`${item.name}${isActive ? ' (aktuell)' : ''}`}
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
