'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  MapPin,
  BarChart3,
  ChevronDown,
  ChevronUp,
  UserPlus,
  DollarSign,
  Clock,
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
  onInvite,
}: {
  roles?: string[];
  open?: boolean;
  onClose?: () => void;
  selectedClubId?: string | null;
  clubs?: Club[];
  onInvite?: () => void;
}) {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);
  const [clubSwitcherOpen, setClubSwitcherOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  // Detect mobile to apply aria-hidden correctly on desktop vs mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  // Fetch notification and approval counts from API
  const [notificationCount, setNotificationCount] = useState(0);
  const [approvalCount, setApprovalCount] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();

    // Fetch notification count (all roles)
    fetch('/api/user/notifications/count', { signal: abortController.signal })
      .then((res) => res.json())
      .then((data) => setNotificationCount(data?.count ?? 0))
      .catch(() => {});

    // Fetch pending approval count (admin only)
    if (isAdmin) {
      fetch('/api/admin/approvals/count', { signal: abortController.signal })
        .then((res) => res.json())
        .then((data) => setApprovalCount(data?.count ?? 0))
        .catch(() => {});
    }

    return () => abortController.abort();
  }, [isAdmin]);

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

  interface NavItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
    badge?: number;
  }

  // ... (keep the existing code)

  // Secondary navigation (defined early so primaryNav can reference it for trainer fallback)
  const secondaryNav: NavItem[] = [
    { name: 'Mein Profil', href: '/profile', icon: User },
    ...(!isSuperAdmin
      ? [{ name: 'Abonnement & Rechnung', href: '/billing', icon: CreditCard }]
      : []),
    { name: 'News & Updates', href: '/news', icon: Newspaper },
  ];

  // Primary navigation — role-based, highest role wins
  const primaryNav: NavItem[] = (() => {
    // SUPERADMIN: Platform-wide administration
    if (isSuperAdmin) {
      return [
        { name: 'Superadmin Dashboard', href: '/superadmin', icon: Layout },
        { name: 'Vereinsübersicht', href: '/superadmin/tenants', icon: Building2 },
        { name: 'Club-Verwaltung', href: '/superadmin/clubs', icon: Building2 },
        { name: 'Plattform-Analyse', href: '/admin/analytics', icon: BarChart3 },
      ];
    }

    // TRAINER: Uses bottom nav (no sidebar needed); this is a fallback
    if (isTrainer) {
      return [
        { name: 'Trainer Dashboard', href: '/trainer', icon: GraduationCap },
        { name: 'Termin-Verwaltung', href: '/scheduler', icon: Calendar },
        { name: 'Verfügbarkeit', href: '/trainer/availability', icon: Clock },
        { name: 'Meine Anwesenheit', href: '/attendance-history', icon: TrendingUp },
        { name: 'Gamification', href: '/gamification', icon: Trophy },
        {
          name: 'Benachrichtigungen',
          href: '/notifications',
          icon: Bell,
          badge: notificationCount,
        },
        ...(secondaryNav as NavItem[]),
      ];
    }

    // MEMBER: Uses bottom nav; this is a fallback
    return [
      { name: 'Home', href: '/member', icon: Home },
      { name: 'Buchungen & Kalender', href: '/bookings', icon: Calendar },
      { name: 'Trainingszeiten', href: '/training-schedule', icon: Calendar },
      { name: 'Meine Anwesenheit', href: '/attendance-history', icon: TrendingUp },
      { name: 'Gamification', href: '/gamification', icon: Trophy },
      {
        name: 'Benachrichtigungen',
        href: '/notifications',
        icon: Bell,
        badge: notificationCount,
      },
    ];
  })();

  // Admin structured navigation sections (6 sections)
  const adminNav = isAdmin
    ? {
        overview: { name: 'Dashboard', href: '/admin', icon: Home },
        members: {
          name: 'MITGLIEDER',
          icon: Users,
          subItems: [
            { name: 'Alle Mitglieder', href: '/admin/members' },
            { name: 'Genehmigungen', href: '/admin/approvals', badge: approvalCount },
          ],
          hasInvite: true,
        },
        training: {
          name: 'TRAINING',
          icon: GraduationCap,
          subItems: [
            { name: 'Saisonplanung', href: '/admin/seasons' },
            { name: 'Trainer & Stunden', href: '/admin/trainers' },
            { name: 'Stundennachweise', href: '/admin/hours-logs' },
            { name: 'Turniere', href: '/admin/tournaments' },
          ],
        },
        courts: {
          name: 'PLÄTZE & BUCHUNGEN',
          icon: MapPin,
          subItems: [
            { name: 'Platz-Kalender', href: '/admin/courts' },
            { name: 'Buchungsübersicht', href: '/bookings' },
            { name: 'Plätze verwalten', href: '/admin/courts/manage' },
          ],
        },
        finance: {
          name: 'FINANZEN',
          icon: DollarSign,
          subItems: [
            { name: 'Abrechnung', href: '/admin/billing' },
            { name: 'Analytics', href: '/admin/analytics' },
            { name: 'Berichte', href: '/admin/reports' },
          ],
        },
        settings: {
          name: 'EINSTELLUNGEN',
          icon: Settings,
          subItems: [
            { name: 'Vereinseinstellungen', href: '/admin/settings' },
            { name: 'News & Kommunikation', href: '/news' },
            { name: 'Onboarding', href: '/admin/onboarding' },
            { name: 'Shop', href: '/shop' },
          ],
        },
      }
    : null;

  // Category sections with sub-items (superadmin only now)
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

    return [];
  })();

  // Active color theme per role
  const activeGradient = isSuperAdmin
    ? 'bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-lg'
    : isAdmin
      ? 'bg-gradient-accent text-white shadow-lg'
      : isTrainer
        ? 'bg-gradient-to-r from-green-500 to-green-700 text-white shadow-lg'
        : 'bg-gradient-primary text-white shadow-lg';

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
        'h-[calc(100vh-4rem)] w-64 border-r border-gray-100 dark:border-white/10 bg-white dark:bg-surface-dark transition-transform duration-300',
        'md:translate-x-0',
        open
          ? 'fixed inset-y-0 left-0 z-50 translate-x-0'
          : 'fixed inset-y-0 left-0 z-50 -translate-x-full md:relative md:translate-x-0'
      )}
      role="navigation"
      aria-label="Main navigation"
      aria-hidden={isMobile === true && !open ? true : undefined}
    >
      {/* Mobile close button */}
      {open && (
        <button
          onClick={onClose}
          className="md:hidden absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light"
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
          {/* ── ADMIN: Structured 6-section sidebar ── */}
          {isAdmin && adminNav ? (
            <>
              {/* Section 1 – ÜBERSICHT (single link, no collapse) */}
              <div
                className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400/60 dark:text-white/30"
                role="heading"
                aria-level={2}
              >
                Übersicht
              </div>
              {(() => {
                const item = adminNav.overview;
                const isActive = pathname === item.href;
                return (
                  <Link
                    href={item.href}
                    onClick={() => onClose?.()}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-brand-light/20 text-brand-light dark:bg-brand-light/20 dark:text-green-300'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Dashboard</span>
                  </Link>
                );
              })()}

              {/* Separator */}
              <div
                className="my-3 border-t border-white/10 dark:border-white/[0.06]"
                role="separator"
              />

              {/* Section 2 – MITGLIEDER */}
              <AdminSection
                label="Mitglieder"
                icon={Users}
                subItems={adminNav.members.subItems}
                pathname={pathname}
                onClose={onClose}
                extraAction={
                  onInvite
                    ? {
                        label: 'Einladen',
                        icon: UserPlus,
                        onClick: () => {
                          onClose?.();
                          onInvite();
                        },
                      }
                    : undefined
                }
              />

              {/* Separator */}
              <div
                className="my-3 border-t border-white/10 dark:border-white/[0.06]"
                role="separator"
              />

              {/* Section 3 – TRAINING */}
              <AdminSection
                label="Training"
                icon={GraduationCap}
                subItems={adminNav.training.subItems}
                pathname={pathname}
                onClose={onClose}
              />

              {/* Separator */}
              <div
                className="my-3 border-t border-white/10 dark:border-white/[0.06]"
                role="separator"
              />

              {/* Section 4 – PLÄTZE & BUCHUNGEN */}
              <AdminSection
                label="Plätze & Buchungen"
                icon={MapPin}
                subItems={adminNav.courts.subItems}
                pathname={pathname}
                onClose={onClose}
              />

              {/* Separator */}
              <div
                className="my-3 border-t border-white/10 dark:border-white/[0.06]"
                role="separator"
              />

              {/* Section 5 – FINANZEN */}
              <AdminSection
                label="Finanzen"
                icon={DollarSign}
                subItems={adminNav.finance.subItems}
                pathname={pathname}
                onClose={onClose}
              />

              {/* Separator */}
              <div
                className="my-3 border-t border-white/10 dark:border-white/[0.06]"
                role="separator"
              />

              {/* Section 6 – EINSTELLUNGEN */}
              <AdminSection
                label="Einstellungen"
                icon={Settings}
                subItems={adminNav.settings.subItems}
                pathname={pathname}
                onClose={onClose}
              />
            </>
          ) : (
            <>
              {/* Section label */}
              <div
                className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
                role="heading"
                aria-level={2}
              >
                {sectionLabel}
              </div>

              {/* Primary Navigation (superadmin / trainer / member) */}
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
                    {(item as NavItem).badge != null && (item as NavItem).badge !== undefined && (
                      <NavigationBadge count={(item as NavItem).badge!} variant="default" />
                    )}
                  </Link>
                );
              })}

              {/* Category sections (superadmin only) */}
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
            </>
          )}
        </nav>
      </ScrollArea>
    </aside>
  );
}

// ─────────────────────────────────────────────
// AdminSection: collapsible section for admin nav
// ─────────────────────────────────────────────

interface AdminSubItem {
  name: string;
  href: string;
  badge?: number;
}

interface AdminSectionProps {
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  subItems: AdminSubItem[];
  pathname: string;
  onClose?: () => void;
  extraAction?: {
    label: string;
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
    onClick: () => void;
  };
}

function AdminSection({
  label,
  icon: Icon,
  subItems,
  pathname,
  onClose,
  extraAction,
}: AdminSectionProps) {
  const hasActiveChild = subItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );
  const [isOpen, setIsOpen] = useState(hasActiveChild);

  return (
    <div className="space-y-0.5">
      {/* Section header / toggle */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-all duration-200',
          hasActiveChild
            ? 'text-green-300 dark:text-green-300'
            : 'text-gray-400/70 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60'
        )}
        aria-expanded={isOpen}
        aria-label={`${label} ${isOpen ? 'einklappen' : 'ausklappen'}`}
      >
        <div className="flex items-center gap-2.5">
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{label}</span>
        </div>
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform duration-200 opacity-50',
            isOpen && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {/* Sub-items */}
      {isOpen && (
        <div className="ml-3 pl-3 border-l border-white/10 dark:border-white/[0.08] space-y-0.5">
          {subItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => onClose?.()}
                className={cn(
                  'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-brand-light/15 text-green-300 dark:text-green-300'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <span>{item.name}</span>
                {item.badge !== undefined && (
                  <NavigationBadge count={item.badge} variant="danger" />
                )}
              </Link>
            );
          })}
          {/* Extra action (e.g. Invite button) */}
          {extraAction && (
            <button
              onClick={extraAction.onClick}
              className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all duration-150"
            >
              <extraAction.icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
              <span>{extraAction.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
