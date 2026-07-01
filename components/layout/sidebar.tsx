'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isActivePath, isExactActive } from '@/lib/navigation-utils';
import { useUserRole } from '@/hooks/use-user-role';
import { useClubFeatures } from '@/hooks/use-club-features';
import { ScrollArea } from '@/components/ui/scroll-area';

import { AdminSection } from './admin-section';
import { FamilySwitcher } from './family-switcher';
import { useFamilyAccounts } from '@/hooks/use-family-accounts';
import {
  Home,
  Users,
  Settings,
  GraduationCap,
  Trophy,
  X,
  CheckCircle,
  CreditCard,
  Building2,
  Calendar,
  ChevronDown,
  UserPlus,
  DollarSign,
  Shield,
  MessageSquare,
  HardHat,
  Shuffle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { useTenant } from '@/lib/tenant-context';

interface Club {
  id: string;
  name: string;
}

const roleColors = {
  owner: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    text: 'text-indigo-700 dark:text-indigo-300',
    light: 'indigo',
    ring: 'ring-indigo-300/40',
  },
  superadmin: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    light: 'purple',
    ring: 'ring-purple-300/40',
  },
  admin: {
    bg: 'bg-brand-light/10 dark:bg-brand-light/15',
    text: 'text-brand-light dark:text-success-300',
    light: 'brand-light',
    ring: 'ring-brand-light/30',
  },
  trainer: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-600 dark:text-emerald-300',
    light: 'emerald',
    ring: 'ring-emerald-300/40',
  },
  member: {
    bg: 'bg-brand-light/10 dark:bg-brand-light/15',
    text: 'text-brand-light dark:text-success-300',
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
  const { currentRole, isOwner, isSuperAdmin, isAdmin } = useUserRole(roles);
  const colors = roleColors[currentRole];

  // Feature flags — hide sidebar sections for disabled modules
  const activeClubId = selectedClubId ?? clubs?.[0]?.id;
  const { features } = useClubFeatures(activeClubId);
  const hiddenSections = new Set(
    Object.entries(features)
      .filter(([, enabled]) => !enabled)
      .map(([key]) => key)
  );

  // Active club for display
  const activeClub = clubs?.find((c) => c.id === selectedClubId) ?? clubs?.[0] ?? null;
  const hasMultipleClubs = (clubs?.length ?? 0) > 1;

  // Family accounts — parent/child switching
  const family = useFamilyAccounts();
  const { branding } = useTenant();
  const [imgFailed, setImgFailed] = useState(false);
  const clubLogoUrl = branding.logos.light || branding.logos.dark;

  // Approval count is now fetched inside the MembersTabs component

  const handleSwitchClub = async (clubId: string) => {
    setClubSwitcherOpen(false);
    try {
      const response = await apiFetch('/api/admin/switch-club', {
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

  // ────────────────────────────────────────────────────────────────────
  // Unified navigation definitions — both roles use AdminSection format
  // ────────────────────────────────────────────────────────────────────

  interface SectionDef {
    label: string;
    icon: React.ComponentType<{
      className?: string | undefined;
      'aria-hidden'?: boolean | 'true' | 'false' | undefined;
    }>;
    subItems: { name: string; href: string; badge?: number }[];
    extraAction?: {
      label: string;
      icon: React.ComponentType<{
        className?: string | undefined;
        'aria-hidden'?: boolean | 'true' | 'false' | undefined;
      }>;
      onClick: () => void;
    };
  }

  // Role-specific collapsible sections — uniform structure for both roles
  // Filter out sections whose primary feature is disabled.
  const roleSections: SectionDef[] = (() => {
    if (isAdmin) {
      const allSections: SectionDef[] = [
        {
          label: 'Mitglieder',
          icon: Users,
          subItems: [
            { name: 'Alle Mitglieder', href: '/admin/members' },
            { name: 'Familienkonten', href: '/admin/members/family' },
            ...(!hiddenSections.has('trial_training')
              ? [{ name: 'Probetrainings', href: '/admin/trial-training' }]
              : []),
            ...(!hiddenSections.has('work_duty')
              ? [{ name: 'Arbeitsdienste', href: '/admin/work-duties' }]
              : []),
            { name: 'Nachrichten', href: '/messages' },
            { name: 'E-Mail-Kampagnen', href: '/admin/email-campaigns' },
          ],
          extraAction: onInvite
            ? {
                label: 'Einladen',
                icon: UserPlus,
                onClick: () => {
                  onClose?.();
                  onInvite();
                },
              }
            : undefined,
        },
        {
          label: 'Training',
          icon: GraduationCap,
          subItems: [
            { name: 'Saisonplanung', href: '/admin/seasons' },
            { name: 'Wochenstundenplan', href: '/scheduler' },
            { name: 'Trainer-Profile', href: '/admin/trainers' },
            { name: 'Sonderveranstaltungen', href: '/admin/special-events' },
          ],
        },
        {
          label: 'Spielbetrieb',
          icon: Trophy,
          subItems: [
            { name: 'Platzverwaltung', href: '/admin/courts' },
            ...(!hiddenSections.has('weather_integration')
              ? [{ name: 'Platzsperren & Wetter', href: '/admin/weather' }]
              : []),
            ...(!hiddenSections.has('league_lineup')
              ? [{ name: 'Ligen & Teams', href: '/admin/leagues' }]
              : []),
            ...(!hiddenSections.has('tournaments')
              ? [{ name: 'Turniere', href: '/admin/tournaments' }]
              : []),
            ...(!hiddenSections.has('ai_matchmaking')
              ? [{ name: 'KI-Matchmaking', href: '/matchmaking' }]
              : []),
          ],
        },
        {
          label: 'Finanzen',
          icon: DollarSign,
          subItems: [
            { name: 'Abrechnung', href: '/admin/billing' },
            { name: 'Abonnement', href: '/admin/subscription' },
          ],
        },
        {
          label: 'Einstellungen',
          icon: Settings,
          subItems: [
            { name: 'Vereinseinstellungen', href: '/admin/settings' },
            { name: 'Auswertungen & Berichte', href: '/admin/analytics' },
            { name: 'Dokumente', href: '/admin/documents' },
            { name: 'Versammlungen', href: '/admin/meetings' },
            { name: 'Board-Beschlüsse', href: '/admin/decisions' },
            { name: 'Wartungsplan', href: '/admin/maintenance' },
            ...(!hiddenSections.has('shop') ? [{ name: 'Shop', href: '/admin/shop' }] : []),
          ],
        },
      ];

      return allSections.filter((section) => {
        if (section.label === 'Mitglieder') return !hiddenSections.has('members');
        if (section.label === 'Training')
          return !hiddenSections.has('trainers') || !hiddenSections.has('seasons');
        if (section.label === 'Finanzen') return !hiddenSections.has('finance');
        return true;
      });
    }

    if (isOwner) {
      return [
        {
          label: 'Plattform',
          icon: Shield,
          subItems: [
            { name: 'Alle Vereine', href: '/owner/clubs' },
            { name: 'Superadmins', href: '/owner/superadmins' },
            { name: 'Admins', href: '/owner/admins' },
            { name: 'Zugänge & Anfragen', href: '/owner/access' },
          ],
        },
        {
          label: 'System',
          icon: Settings,
          subItems: [
            { name: 'Umsatz & Abos', href: '/owner/billing' },
            { name: 'System-Einstellungen', href: '/owner/settings' },
          ],
        },
      ];
    }

    if (isSuperAdmin) {
      return [
        {
          label: 'Meine Vereine',
          icon: Building2,
          subItems: [
            { name: 'Vereinsübersicht', href: '/superadmin/clubs' },
            { name: 'Admins verwalten', href: '/superadmin/admins' },
          ],
        },
        {
          label: 'Verwaltung',
          icon: Settings,
          subItems: [
            { name: 'Statistiken', href: '/superadmin/dashboard' },
            { name: 'Einstellungen', href: '/superadmin/settings' },
            { name: 'Abonnement', href: '/superadmin/subscription' },
          ],
        },
      ];
    }

    return [];
  })();

  interface NavItem {
    name: string;
    href: string;
    icon: React.ComponentType<{
      className?: string | undefined;
      'aria-hidden'?: boolean | 'true' | 'false' | undefined;
    }>;
    badge?: number;
  }

  // Secondary navigation — shown consistently for both admin & superadmin
  const secondaryNav: NavItem[] = [
    ...(!isAdmin && !isSuperAdmin && !isOwner
      ? [{ name: 'Stundenplan', href: '/scheduler', icon: Calendar }]
      : []),
    ...(!isAdmin && !isSuperAdmin && !isOwner
      ? [{ name: 'Trainings­präferenzen', href: '/member/preferences', icon: GraduationCap }]
      : []),
    ...(!isAdmin && !isSuperAdmin && !isOwner
      ? [{ name: 'Nachrichten', href: '/messages', icon: MessageSquare }]
      : []),
    ...(!isAdmin && !isSuperAdmin && !isOwner
      ? [{ name: 'Matchmaking', href: '/matchmaking', icon: Shuffle }]
      : []),
    ...(!isAdmin && !isSuperAdmin && !isOwner
      ? [{ name: 'Offene Spiele', href: '/matches', icon: Users }]
      : []),
    ...(!isAdmin && !isSuperAdmin && !isOwner
      ? [{ name: 'Meine Rechnungen', href: '/billing', icon: CreditCard }]
      : []),
    ...(!isAdmin && !isSuperAdmin && !isOwner
      ? [{ name: 'Vereinsdokumente', href: '/documents', icon: CheckCircle }]
      : []),
    ...(!isAdmin && !isSuperAdmin && !isOwner
      ? [{ name: 'Arbeitsdienste', href: '/member/work-duties', icon: HardHat }]
      : []),
  ];

  const dashboardHref = isOwner ? '/owner' : isSuperAdmin ? '/superadmin' : '/admin';
  const sectionLabel = isOwner ? 'Swingz' : isSuperAdmin ? 'Plattform' : 'Administration';

  // ────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        'h-[calc(100vh-4rem)] w-64 border-r border-white/[0.04] dark:border-white/[0.06] bg-gradient-to-b from-[hsl(150,48%,14%)] via-[hsl(150,48%,11%)] to-[hsl(150,48%,8%)] backdrop-blur-xl transition-transform duration-300 ease-out will-change-transform',
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
      {open && (          <button
            onClick={onClose}
            className="md:hidden absolute top-4 right-4 p-2 rounded-xl hover:bg-white/5 text-white/70 focus:outline-none focus:ring-2 focus:ring-brand-light transition-colors"
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
                {clubLogoUrl && !imgFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element,jsx-a11y/no-noninteractive-element-interactions -- external dynamic logo URL
                  <img
                    key={clubLogoUrl}
                    src={clubLogoUrl}
                    alt={activeClub?.name || 'Club Logo'}
                    className="h-5 w-5 object-contain relative"
                    onError={() => setImgFailed(true)}
                    onLoad={() => setImgFailed(false)}
                  />
                ) : (
                  <Trophy className="h-5 w-5 text-white/70 relative" />
                )}
              </div>
              <span className="text-sm font-bold tracking-tight text-white">
                {activeClub?.name || 'SWINGZ'}
              </span>
            </Link>
            <span
              className={cn(
                'text-2xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full',
                colors.bg,
                colors.text
              )}
            >
              {sectionLabel}
            </span>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>

        {/* Family Account Switcher — for parents with minor children */}
        {family.isParent && (
          <FamilySwitcher
            isParent={family.isParent}
            childMembers={family.children}
            activeChild={family.activeChild ?? null}
            isParentViewingChild={family.isParentViewingChild}
            switchToChild={family.switchToChild}
            switchToOwnAccount={family.switchToOwnAccount}
            colors={colors}
          />
        )}

        {/* Owner / Superadmin Club Switcher */}
        {(isOwner || isSuperAdmin) && hasMultipleClubs && (
          <div className="mx-3 mb-4 border border-white/[0.08] rounded-xl overflow-hidden bg-white/5">
            <button
              onClick={() => setClubSwitcherOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-4 w-4 shrink-0 text-purple-500" />
                <span className="truncate">{activeClub?.name ?? 'Club auswählen'}</span>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-white/50 transition-transform duration-200',
                  clubSwitcherOpen && 'rotate-180'
                )}
              />
            </button>
            {clubSwitcherOpen && (
              <div className="border-t border-border/60 dark:border-white/[0.06] overflow-hidden animate-slide-down">
                {clubs?.map((club) => (
                  <button
                    key={club.id}
                    onClick={() => handleSwitchClub(club.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                      club.id === (selectedClubId ?? activeClub?.id)
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-medium'
                        : 'text-white/70 hover:bg-white/5'
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

        {/* ── Unified Navigation ── */}
        <nav className="flex flex-col gap-1 px-3" role="navigation" aria-label="Hauptnavigation">
          {/* Dashboard — prominent first link, consistent for both roles */}
          <Link
            href={dashboardHref}
            onClick={() => onClose?.()}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
              isExactActive(pathname, dashboardHref)
                ? `${colors.bg} ${colors.text} shadow-sm`
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            )}
            aria-current={isExactActive(pathname, dashboardHref) ? 'page' : undefined}
          >
            <Home
              className={cn(
                'h-5 w-5 shrink-0 transition-transform duration-200',
                isExactActive(pathname, dashboardHref) && 'scale-110'
              )}
              aria-hidden="true"
            />
            <span>Dashboard</span>
          </Link>

          {/* Role-specific sections — flat for owner, collapsible for admin/superadmin */}
          {roleSections.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {isOwner
                ? roleSections
                    .flatMap((section) => section.subItems)
                    .map((item) => {
                      const isActive = isActivePath(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => onClose?.()}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                            isActive
                              ? `${colors.bg} ${colors.text} shadow-sm`
                              : 'text-white/70 hover:bg-white/5 hover:text-white'
                          )}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <span>{item.name}</span>
                        </Link>
                      );
                    })
                : roleSections.map((section) => (
                    <AdminSection
                      key={section.label}
                      label={section.label}
                      icon={section.icon}
                      subItems={section.subItems}
                      pathname={pathname}
                      onClose={onClose}
                      colors={colors}
                      extraAction={section.extraAction}
                    />
                  ))}
            </div>
          )}

          {/* Secondary Navigation — shown for both roles */}
          {secondaryNav.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {secondaryNav.map((item) => {
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
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
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
            </div>
          )}
        </nav>
      </ScrollArea>
    </aside>
  );
}
