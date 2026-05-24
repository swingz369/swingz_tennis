'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isActivePath, isExactActive } from '@/lib/navigation-utils';
import { useUserRole } from '@/hooks/use-user-role';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NavigationBadge } from './navigation-badge';
import { AdminSection } from './admin-section';
import {
  Home,
  Users,
  Settings,
  Newspaper,
  GraduationCap,
  Trophy,
  X,
  Layout,
  CheckCircle,
  User,
  CreditCard,
  Building2,
  MapPin,
  BarChart3,
  ChevronDown,
  UserPlus,
  DollarSign,
} from 'lucide-react';

interface Club {
  id: string;
  name: string;
}

const roleColors = {
  superadmin: {
    gradient: 'from-purple-500 to-purple-700',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    light: 'purple',
    ring: 'ring-purple-300/40',
  },
  admin: {
    gradient: 'from-brand-light to-brand-primary',
    bg: 'bg-brand-light/10 dark:bg-brand-light/15',
    text: 'text-brand-light dark:text-green-300',
    light: 'brand-light',
    ring: 'ring-brand-light/30',
  },
  trainer: {
    gradient: 'from-emerald-500 to-emerald-700',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-600 dark:text-emerald-300',
    light: 'emerald',
    ring: 'ring-emerald-300/40',
  },
  member: {
    gradient: 'from-brand-primary to-brand-dark',
    bg: 'bg-brand-light/10 dark:bg-brand-light/15',
    text: 'text-brand-light dark:text-green-300',
    light: 'brand-light',
    ring: 'ring-brand-light/30',
  },
};

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

  // Centralised role detection via hook
  const { currentRole, isSuperAdmin, isAdmin } = useUserRole(roles);
  const colors = roleColors[currentRole];

  // Active club for display
  const activeClub = clubs?.find((c) => c.id === selectedClubId) ?? clubs?.[0] ?? null;
  const hasMultipleClubs = (clubs?.length ?? 0) > 1;

  // Fetch notification and approval counts from API
  const [approvalCount, setApprovalCount] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();

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

  // Secondary navigation
  const secondaryNav: NavItem[] = [
    { name: 'Mein Profil', href: '/profile', icon: User },
    ...(!isSuperAdmin
      ? [{ name: 'Abonnement & Rechnung', href: '/billing', icon: CreditCard }]
      : []),
    { name: 'News & Updates', href: '/news', icon: Newspaper },
  ];

  // Primary navigation — superadmin only (trainer/member use bottom nav, never sidebar)
  const primaryNav: NavItem[] = isSuperAdmin
    ? [
        { name: 'Superadmin Dashboard', href: '/superadmin', icon: Layout },
        { name: 'Vereinsübersicht', href: '/superadmin/tenants', icon: Building2 },
        { name: 'Club-Verwaltung', href: '/superadmin/clubs', icon: Building2 },
        { name: 'Plattform-Analyse', href: '/admin/analytics', icon: BarChart3 },
      ]
    : [];

  // Admin structured navigation sections (6 sections)
  const adminNav = isAdmin
    ? {
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
            { name: 'KI-Matchmaking', href: '/admin/ai/matchmaking' },
            { name: 'Saison-Stundenplan', href: '/admin/season-plan' },
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
            { name: 'Vereinseinstellungen', href: '/admin/settings' },
          ],
        },
        service: {
          name: 'SERVICE & KOMMUNIKATION',
          icon: Newspaper,
          subItems: [
            { name: 'News & Kommunikation', href: '/news' },
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
          ],
        },
      ];
    }

    return [];
  })();

  // Active color theme per role
  const activeGradient = `bg-gradient-to-r ${colors.gradient} text-white shadow-lg`;
  const sectionLabel = isSuperAdmin
    ? 'Plattform'
    : 'Administration';

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        'h-[calc(100vh-4rem)] w-64 border-r border-gray-200/60 dark:border-white/[0.06] bg-white/90 dark:bg-surface-dark/90 backdrop-blur-xl transition-transform duration-300 ease-out will-change-transform',
        'md:translate-x-0',
        open
          ? 'fixed inset-y-0 left-0 z-50 translate-x-0 shadow-2xl shadow-black/10'
          : 'fixed inset-y-0 left-0 z-50 -translate-x-full md:relative md:translate-x-0 md:shadow-none'
      )}
      role="navigation"
      aria-label="Seitennavigation"
      aria-hidden={isMobile === true && !open ? true : undefined}
    >
      {/* Mobile close button */}
      {open && (
        <button
          onClick={onClose}
          className="md:hidden absolute top-4 right-4 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light transition-colors"
          aria-label="Menü schließen"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Menü schließen</span>
        </button>
      )}

      <ScrollArea className="h-full py-6">
        {/* Logo + Role badge */}
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="relative">
                <div className="absolute -inset-1.5 bg-gradient-to-br from-brand-light/40 via-brand-primary/30 to-brand-light/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500" />
                <Trophy className="h-5 w-5 text-gray-700 dark:text-gray-200 relative" />
              </div>
              <span className="text-sm font-bold tracking-tight text-gray-800 dark:text-white">
                SWINGZ
              </span>
            </Link>
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full',
                colors.bg,
                colors.text
              )}
            >
              {sectionLabel}
            </span>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200/50 dark:via-white/10 to-transparent" />
        </div>

        {/* Superadmin Club Switcher */}
        {isSuperAdmin && hasMultipleClubs && (
          <div className="mx-3 mb-4 border border-gray-200/60 dark:border-white/[0.08] rounded-xl overflow-hidden bg-gray-50/50 dark:bg-white/[0.02]">
            <button
              onClick={() => setClubSwitcherOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-4 w-4 shrink-0 text-purple-500" />
                <span className="truncate">{activeClub?.name ?? 'Club auswählen'}</span>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200',
                  clubSwitcherOpen && 'rotate-180'
                )}
              />
            </button>
            {clubSwitcherOpen && (
              <div className="border-t border-gray-200/60 dark:border-white/[0.06] overflow-hidden animate-slide-down">
                {clubs?.map((club) => (
                  <button
                    key={club.id}
                    onClick={() => handleSwitchClub(club.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                      club.id === (selectedClubId ?? activeClub?.id)
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04]'
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
              {/* Dashboard – Direktlink (nur exakter /admin Match) */}
              <Link
                href="/admin"
                onClick={() => onClose?.()}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 mb-2',
                  isExactActive(pathname, '/admin')
                    ? activeGradient
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white'
                )}
                aria-current={isExactActive(pathname, '/admin') ? 'page' : undefined}
              >
                <Home
                  className={cn(
                    'h-5 w-5 shrink-0 transition-transform duration-200',
                    isExactActive(pathname, '/admin') && 'scale-110'
                  )}
                  aria-hidden="true"
                />
                <span>Dashboard</span>
              </Link>

              {/* Section 2 – MITGLIEDER */}
              <AdminSection
                label="Mitglieder"
                icon={Users}
                subItems={adminNav.members.subItems}
                pathname={pathname}
                onClose={onClose}
                colors={colors}
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

              <div
                className="my-2 border-t border-gray-100/50 dark:border-white/[0.04]"
                role="separator"
              />

              {/* Section 3 – TRAINING */}
              <AdminSection
                label="Training"
                icon={GraduationCap}
                subItems={adminNav.training.subItems}
                pathname={pathname}
                onClose={onClose}
                colors={colors}
              />

              <div
                className="my-2 border-t border-gray-100/50 dark:border-white/[0.04]"
                role="separator"
              />

              {/* Section 4 – PLÄTZE & BUCHUNGEN */}
              <AdminSection
                label="Plätze & Buchungen"
                icon={MapPin}
                subItems={adminNav.courts.subItems}
                pathname={pathname}
                onClose={onClose}
                colors={colors}
              />

              <div
                className="my-2 border-t border-gray-100/50 dark:border-white/[0.04]"
                role="separator"
              />

              {/* Section 5 – FINANZEN */}
              <AdminSection
                label="Finanzen"
                icon={DollarSign}
                subItems={adminNav.finance.subItems}
                pathname={pathname}
                onClose={onClose}
                colors={colors}
              />

              <div
                className="my-2 border-t border-gray-100/50 dark:border-white/[0.04]"
                role="separator"
              />

              {/* Service & Kommunikation – direkte Links */}
              {adminNav.service.subItems.map((item) => {
                const isActive = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => onClose?.()}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                      isActive
                        ? `${colors.bg} ${colors.text} shadow-sm`
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Newspaper
                      className={cn(
                        'h-5 w-5 shrink-0 transition-transform duration-200',
                        isActive && 'scale-110'
                      )}
                      aria-hidden="true"
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </>
          ) : (
            <>
              {/* Section label */}
              <div
                className="mb-2 px-3 text-[10px] font-semibold font-display uppercase tracking-[0.15em] text-gray-400/50 dark:text-white/30"
                role="heading"
                aria-level={2}
              >
                {sectionLabel}
              </div>

              {/* Primary Navigation (superadmin) */}
              {primaryNav.map((item) => {
                const isActive = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => onClose?.()}
                    className={cn(
                      'group flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                      isActive
                        ? activeGradient
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={`${item.name}${isActive ? ' (aktuell)' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon
                        className={cn(
                          'h-5 w-5 shrink-0 transition-transform duration-200',
                          isActive && 'scale-110'
                        )}
                        aria-hidden="true"
                      />
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
                  {categoryNav.map((category) => (
                    <AdminSection
                      key={category.name}
                      label={category.name}
                      icon={category.icon}
                      subItems={category.subItems}
                      pathname={pathname}
                      onClose={onClose}
                      colors={colors}
                    />
                  ))}
                </>
              )}

              {/* Secondary Navigation */}
              {secondaryNav.length > 0 && (
                <>
                  <div
                    className="mt-6 mb-2 px-3 text-[10px] font-semibold font-display uppercase tracking-[0.15em] text-gray-400/50 dark:text-white/30"
                    role="heading"
                    aria-level={2}
                  >
                    Weitere
                  </div>
                  {secondaryNav.map((item) => {
                    const isActive = isActivePath(pathname, item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => onClose?.()}
                        className={cn(
                          'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                          isActive
                            ? activeGradient
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white'
                        )}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={`${item.name}${isActive ? ' (aktuell)' : ''}`}
                      >
                        <item.icon
                          className={cn(
                            'h-5 w-5 shrink-0 transition-transform duration-200',
                            isActive && 'scale-110'
                          )}
                          aria-hidden="true"
                        />
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

