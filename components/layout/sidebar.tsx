'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isExactActive } from '@/lib/navigation-utils';
import { useUserRole } from '@/hooks/use-user-role';
import { useClubFeatures } from '@/hooks/use-club-features';
import { useOwnerClubContext } from '@/hooks/use-owner-club-context';

import { AdminSection } from './admin-section';
import { FamilySwitcher } from './family-switcher';
import { useFamilyAccounts } from '@/hooks/use-family-accounts';
import { Home, X, CheckCircle, Building2, ChevronDown, UserPlus } from 'lucide-react';
import {
  adminSidebarSections,
  memberSidebarSections,
  trainerSidebarSections,
  superadminSidebarSections,
  ownerSidebarSections,
} from '@/lib/navigation';
import { apiFetch } from '@/lib/api-fetch';
import { createLogger } from '@/lib/logger';

const log = createLogger('sidebar');

interface Club {
  id: string;
  name: string;
}

// Phase 3: Owner (Violett) und Superadmin (Lila) jetzt optisch unterschiedlich.
// Vorher waren beide „info-50/700“ → in der Sidebar nicht unterscheidbar, wenn
// der User beide Rollen-Memberships parallel hat (selten aber möglich).
const roleColors = {
  owner: {
    bg: 'bg-info-50 dark:bg-info-900/20',
    text: 'text-info-700 dark:text-info-300',
    light: 'info',
    ring: 'ring-info-300/50',
  },
  superadmin: {
    bg: 'bg-info-50 dark:bg-info-900/20',
    text: 'text-info-700 dark:text-info-300',
    light: 'info',
    ring: 'ring-info-300/50',
  },
  admin: {
    bg: 'bg-brand-light/10 dark:bg-brand-light/15',
    text: 'text-brand-light dark:text-success-300',
    light: 'brand-light',
    ring: 'ring-brand-light/30',
  },
  trainer: {
    bg: 'bg-success-50 dark:bg-success-900/20',
    text: 'text-success-600 dark:text-success-300',
    light: 'emerald',
    ring: 'ring-success-300/40',
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
  const [approvalCount, setApprovalCount] = useState(0);
  // Kennzahlen der Navigation (Mitglieder, offene Rechnungen, Präferenz-Stand).
  // `null` heisst „nicht ermittelbar" und wird ausgeblendet — nicht als 0
  // dargestellt, sonst behauptet die Navigation bei einem Abfragefehler, der
  // Verein habe keine Mitglieder.
  const [navCounts, setNavCounts] = useState<{
    members: number | null;
    openInvoices: number | null;
    preferencesPct: number | null;
  }>({ members: null, openInvoices: null, preferencesPct: null });

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
  const { currentRole, isOwner, isSuperAdmin, isAdmin, isTrainer } = useUserRole(roles);
  const colors = roleColors[currentRole];

  // Rollen-Unterzeile — stand früher im Header unter dem Vereinsnamen und ist
  // mit dem Marken-Cluster dorthin gewandert, wo der Vereinsname jetzt steht.
  // Für Owner und Superadmin ist sie die eigentliche Ortsangabe: beide sehen
  // fremde Vereine, und ohne die Zeile ist nicht ersichtlich, in welcher
  // Verwaltungsebene man gerade arbeitet.
  /**
   * Kennzahl für eine Navigationsgruppe. Nur dort, wo die Zahl eine Frage
   * beantwortet, die man beim Blick auf die Navigation stellt: wie viele
   * Mitglieder, wie viel liegt offen, wie weit ist die Saison. Gruppen ohne
   * solche Frage (Trainer, Verein) bekommen bewusst keine — eine Zahl an jedem
   * Eintrag wäre Dekoration und würde die drei echten entwerten.
   *
   * Offene Rechnungen zeigen nur, wenn es welche gibt: eine „0" ist keine
   * Kennzahl, sondern eine Entwarnung, die niemand sucht.
   */
  const sectionBadge = (sectionLabel: string): string | null => {
    if (!isAdmin && !isSuperAdmin) return null;
    switch (sectionLabel) {
      case 'Mitglieder':
        return navCounts.members !== null ? String(navCounts.members) : null;
      case 'Finanzen':
        return navCounts.openInvoices ? String(navCounts.openInvoices) : null;
      case 'Saison & Plätze':
        return navCounts.preferencesPct !== null ? `${navCounts.preferencesPct} %` : null;
      default:
        return null;
    }
  };

  // Pending member registrations — surfaced as a nav badge instead of only inside the Mitglieder tab.
  //
  // Refresh strategy: mount-fetch + 45 s polling + refetch on tab-focus
  // and on every pathname change. Without this, the badge stays frozen
  // at the value captured when the sidebar first mounted — admins would
  // see "3" forever even after approving all three requests, because
  // (1) the dashboard Server Component re-fetches on every navigation
  // and (2) the sidebar is a Client Component that only fetched once.
  //
  // Realtime-via-Supabase-channel would be the “instant” upgrade, but
  // for a single badge counter the polling cost is ~96 requests/day per
  // active admin and is the lowest-complexity fix. Provide an opt-out
  // later if write-load becomes a concern.
  useEffect(() => {
    if (!isAdmin) return undefined;
    const controller = new AbortController();

    // Race-condition guard: the same `controller.signal` is reused across
    // every fetchCount() call, so back-to-back calls (interval firing
    // while a previous fetch is still pending) run in parallel. Without
    // a generation counter, the slower response can clobber the freshly-
    // arrived value, briefly causing the badge to flip back to a stale
    // number. The guard ensures only the most-recent response may
    // update the state.
    const fetchGenRef = { current: 0 };
    const fetchCount = () => {
      const myGen = ++fetchGenRef.current;
      return (
        apiFetch('/api/admin/approvals/count', { signal: controller.signal })
          .then((res) => res.json())
          .then((data) => {
            // Gate on typeof: malformed shapes (e.g. `{ error: '...' }`)
            // would otherwise briefly clear the badge to 0 until the
            // next successful fetch lands. The previous in-flight value
            // is preserved when we skip the setState.
            if (
              fetchGenRef.current === myGen &&
              typeof data?.count === 'number' &&
              Number.isFinite(data.count)
            ) {
              setApprovalCount(data.count);
            }
          })
          // 401 / 403 / 5xx all collapse to a silent no-op — UX stays calm.
          .catch(() => {})
      );
    };

    // Kennzahlen laufen im selben Takt wie der Genehmigungs-Zähler mit —
    // eigener Poll-Timer wäre ein zweiter Wecker für dieselbe Anzeige.
    const fetchNavCounts = () =>
      apiFetch('/api/admin/nav-counts', { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data === 'object' && !('error' in data)) {
            setNavCounts({
              members: typeof data.members === 'number' ? data.members : null,
              openInvoices: typeof data.openInvoices === 'number' ? data.openInvoices : null,
              preferencesPct: typeof data.preferencesPct === 'number' ? data.preferencesPct : null,
            });
          }
        })
        .catch(() => {});

    // 1) Initial fetch on mount.
    fetchCount();
    fetchNavCounts();
    // 2) Poll every 45 s while the sidebar stays mounted.
    const interval = window.setInterval(() => {
      fetchCount();
      fetchNavCounts();
    }, 45_000);
    // 3) Refetch when the tab regains visibility (e.g. user switched
    //    back from another app or another tab).
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCount();
        fetchNavCounts();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // Re-run when the admin role or the active club changes — a
    // superadmin switching clubs must see the badge recompute.
  }, [isAdmin, pathname]);

  // 4) Separate effect: refetch immediately when the user navigates
  // (e.g. from /admin/members after approving a request, then back).
  // We only re-fetch when the new path is past the *initial* load —
  // for that we piggy-back on the same useEffect with `pathname` in
  // the dependency array above. Splitting into two effects would
  // double-fetch on mount; the merged dependency is intentional.

  /**
   * Owner, der über „Als Admin" in einen Verein gewechselt ist — er bekommt die
   * Admin-Navigation, sonst stünde er im Verein ohne Navigation da. Den Hinweis
   * darauf und den Rückweg liefert die Leiste über dem Inhalt
   * (components/layout/owner-club-banner), die denselben Hook nutzt.
   */
  const actsAsClubAdmin = useOwnerClubContext(isOwner);

  // Steht unter dem Logo. Für den Owner im Vereinskontext wäre
  // "Plattform-Konsole" irreführend — er sieht dann die Vereinsverwaltung.
  const roleLabel = actsAsClubAdmin
    ? 'Vereinsverwaltung (als Owner)'
    : isOwner
      ? 'Plattform-Konsole'
      : isSuperAdmin
        ? 'Tennisschule-Verwaltung'
        : isAdmin
          ? 'Vereinsverwaltung'
          : isTrainer
            ? 'Mein Training'
            : 'Mein Verein';

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
      log.error('Fehler beim Vereinswechsel', error instanceof Error ? error : undefined);
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

  // Sektionen kommen aus lib/navigation.ts (gemeinsame Quelle mit Mobile-Nav
  // und Command-Palette) und werden hier nur dekoriert: Approval-Badge,
  // Einladen-Aktion, Trainer-Zusammenführung.
  const includeMemberOnly = !isTrainer || (roles?.includes('member') ?? false);

  const roleSections: SectionDef[] = (() => {
    if (isAdmin || actsAsClubAdmin) {
      const sections = adminSidebarSections(hiddenSections, isSuperAdmin).map((section) => ({
        label: section.label,
        icon: section.icon,
        subItems: section.items.map((item) =>
          item.href === '/admin/members' && approvalCount > 0
            ? { ...item, badge: approvalCount }
            : item
        ),
        ...(section.label === 'Mitglieder' && onInvite
          ? {
              extraAction: {
                label: 'Einladen',
                icon: UserPlus,
                onClick: () => {
                  onClose?.();
                  onInvite();
                },
              },
            }
          : {}),
      }));

      // Der Weg zurück zur Owner-Konsole steht bewusst NICHT hier, sondern in
      // der Hinweisleiste über dem Inhalt (components/layout/owner-club-banner):
      // Wer im falschen Verein arbeitet, soll das permanent sehen und nicht
      // erst beim Aufklappen einer Navigationsgruppe bemerken.
      return sections;
    }

    if (isOwner) {
      // Owner: Konsistente Section-Darstellung wie Admin/Superadmin — die
      // Section-Labels ("Plattform-Konsole", "Monetarisierung") sind die
      // semantische Gruppierung und bleiben sichtbar (Audit-Log direkt
      // unter "Vereine" weil es das operativ wichtigste Sicherheitsnetz ist).
      return ownerSidebarSections().map((s) => ({
        label: s.label,
        icon: s.icon,
        subItems: s.items.map((i) => ({ name: i.name, href: i.href })),
      }));
    }

    if (isSuperAdmin) {
      return superadminSidebarSections().map((s) => ({
        label: s.label,
        icon: s.icon,
        subItems: s.items,
      }));
    }

    const memberSections = memberSidebarSections(hiddenSections, includeMemberOnly);

    if (isTrainer) {
      // Trainer: eigene Sektionen („Mein Training", „Meine Leistung") +
      // „Spielen"/„Mein Verein" des Mitglieds. Die Mitglieder-Trainingssektion
      // wird eingeschmolzen (Spieler-Präferenzen an die erste Trainer-Sektion);
      // „Trainerstunde buchen" entfällt für Trainer.
      const trainerSections = trainerSidebarSections();
      return [
        ...trainerSections.map((s, i) => ({
          label: s.label,
          icon: s.icon,
          subItems:
            i === 0 && includeMemberOnly
              ? [
                  ...s.items,
                  { name: 'Trainingspräferenzen (Spieler)', href: '/member/preferences' },
                ]
              : s.items,
        })),
        ...memberSections
          .filter((s) => s.label !== 'Training')
          .map((s) => ({ label: s.label, icon: s.icon, subItems: s.items })),
      ];
    }

    // Mitglied — gruppierte Sektionen statt flacher Liste
    return memberSections.map((s) => ({ label: s.label, icon: s.icon, subItems: s.items }));
  })();

  const dashboardHref = actsAsClubAdmin
    ? '/admin' // Owner im Vereinskontext: „Dashboard" meint das des Vereins
    : isOwner
      ? '/owner'
      : isSuperAdmin
        ? '/superadmin'
        : isAdmin
          ? '/admin'
          : isTrainer
            ? '/trainer'
            : '/member';

  // ────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        // `sidebar-surface` (app/globals.css) setzt den eigenen dunklen
        // Farbraum + die Court-Linien-Textur. Volle Höhe statt
        // `100vh-4rem`/`top-16`, weil der Header seit dem Layout-Umbau
        // nicht mehr über der Sidebar sitzt, sondern neben ihr beginnt.
        'sidebar-surface w-64 shrink-0 overflow-y-auto transition-transform duration-300 ease-out will-change-transform',
        'md:translate-x-0',
        open
          ? 'fixed inset-y-0 left-0 z-50 h-screen translate-x-0 shadow-2xl shadow-black/10'
          : 'fixed inset-y-0 left-0 z-50 h-screen -translate-x-full md:sticky md:top-0 md:translate-x-0 md:shadow-none'
      )}
      role="navigation"
      aria-label="Seitennavigation"
      aria-hidden={isMobile === true && !open ? true : undefined}
    >
      {/* Mobile close button */}
      {open && (
        <button
          onClick={onClose}
          className="md:hidden absolute top-4 right-4 p-2 rounded-xl hover:bg-muted text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-light transition-colors"
          aria-label="Menü schließen"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Menü schließen</span>
        </button>
      )}

      {/* Markenblock — exakt `h-16` wie die Header-Leiste daneben, damit die
          Oberkante der Navigation mit der Oberkante des Inhalts fluchtet.
          Ohne ihn begann die Navigation ganz oben und die aktive Pille las
          sich wie eine zweite Kopfzeile. */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <span
          aria-hidden="true"
          className="relative block h-6 w-6 shrink-0 rounded-full bg-brand-accent"
        >
          <span className="absolute inset-[3px] rounded-full border border-y-transparent border-background" />
        </span>
        <span className="text-[17px] font-bold tracking-[-0.025em] text-foreground">SwingZ</span>
      </div>

      {/* Kompaktere Navigation: 12 px oben statt 16, Gruppen dichter. Die
          Sidebar hatte bei acht Gruppen mehr Weissraum als Inhalt und der
          untere Teil blieb trotzdem leer. */}
      <div className="pb-6 pt-3">
        {/* Family Account Switcher — for parents with minor children */}
        {family.isParent && !hiddenSections.has('family_accounts') && (
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

        {/* Vereinsblock — steht jetzt für JEDE Rolle hier, nicht nur für
            Superadmins mit mehreren Vereinen. Grund: der Vereinsname ist aus
            dem Header in die Sidebar gezogen, und ein Admin muss weiterhin
            sehen, in wessen Verein er gerade arbeitet. Aufklappbar bleibt er
            nur, wenn es überhaupt etwas zu wechseln gibt — sonst ist es eine
            reine Beschriftung ohne Klickversprechen. */}
        {activeClub && !(isSuperAdmin && hasMultipleClubs) && (
          <div className="mx-3 mb-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <p className="truncate text-[13.5px] font-semibold leading-tight">{activeClub.name}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              {roleLabel}
            </p>
          </div>
        )}

        {/* Superadmin Club Switcher — owner picks clubs via /owner/clubs instead */}
        {isSuperAdmin && hasMultipleClubs && (
          <div className="mx-3 mb-4 border border-border rounded-xl overflow-hidden bg-muted/40">
            <button
              onClick={() => setClubSwitcherOpen((prev) => !prev)}
              className="w-full flex flex-col items-stretch px-3 py-2 text-left hover:bg-muted transition-colors"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Verein
              </span>
              <span className="mt-0.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-[13.5px] font-semibold">
                    {activeClub?.name ?? 'Club auswählen'}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                    clubSwitcherOpen && 'rotate-180'
                  )}
                />
              </span>
            </button>
            {clubSwitcherOpen && (
              <div className="border-t border-border overflow-hidden animate-slide-down">
                {clubs?.map((club) => (
                  <button
                    key={club.id}
                    onClick={() => handleSwitchClub(club.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                      club.id === (selectedClubId ?? activeClub?.id)
                        ? 'bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-300 font-medium'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <CheckCircle
                      className={cn(
                        'h-4 w-4 shrink-0',
                        club.id === (selectedClubId ?? activeClub?.id)
                          ? 'text-info-500'
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
        <nav
          className="flex flex-col gap-0.5 px-2.5"
          role="navigation"
          aria-label="Hauptnavigation"
        >
          {/* Dashboard — prominent first link, consistent for both roles */}
          <Link
            href={dashboardHref}
            onClick={() => onClose?.()}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-all duration-200',
              isExactActive(pathname, dashboardHref)
                ? `${colors.bg} ${colors.text}`
                : 'text-muted-foreground hover:bg-muted/70 dark:hover:bg-white/[0.06] hover:text-foreground'
            )}
            aria-current={isExactActive(pathname, dashboardHref) ? 'page' : undefined}
          >
            {/* 16 px statt 20 px: neben 13,5-px-Text war das Icon vorher
                grösser als die Versalhöhe und zog den Blick auf sich. */}
            <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Dashboard</span>
          </Link>

          {/* Role-specific sections — einheitlich collapsible für alle Rollen
              inkl. Owner (war vorher flatMap, jetzt konsistent mit Admin/Superadmin). */}
          {roleSections.length > 0 && (
            <div className="mt-1.5 space-y-px">
              {roleSections.map((section) => (
                <AdminSection
                  key={section.label}
                  label={section.label}
                  icon={section.icon}
                  subItems={section.subItems}
                  pathname={pathname}
                  onClose={onClose}
                  colors={colors}
                  extraAction={section.extraAction}
                  badge={sectionBadge(section.label)}
                  defaultOpen={
                    section.label === 'Mitglieder' ||
                    section.label === 'Spielbetrieb' ||
                    section.label === 'Spielen' ||
                    section.label === 'Plattform-Konsole' ||
                    (isTrainer && !isAdmin && section.label === 'Training')
                  }
                />
              ))}
            </div>
          )}
        </nav>
      </div>
    </aside>
  );
}
