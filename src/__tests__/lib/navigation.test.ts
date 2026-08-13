import { describe, expect, it } from 'vitest';
import {
  adminSidebarSections,
  memberSidebarSections,
  mobileNavItems,
  ownerSidebarSections,
  superadminSidebarSections,
  trainerSidebarSections,
  type NavSection,
} from '@/lib/navigation';
import { CLUB_FEATURES } from '@/lib/features';

/**
 * Wächter gegen Navigations-Drift. Die drei Oberflächen (Sidebar, Mobile-Nav,
 * Cmd+K) werden von Hand gepflegt; ohne diesen Test laufen sie auseinander,
 * wie zuletzt geschehen: /superadmin/tenants gab es nur mobil, /scheduler hieß
 * an drei Stellen anders, und Matchmaking stand zweimal in der Mitglieder-
 * Sidebar — einmal ungegated, wodurch das Feature-Flag wirkungslos war.
 */

const NO_FLAGS = new Set<string>();

const SECTIONS_BY_ROLE: Record<string, NavSection[]> = {
  owner: ownerSidebarSections(),
  superadmin: superadminSidebarSections(),
  admin: adminSidebarSections(NO_FLAGS),
  trainer: trainerSidebarSections(),
  member: memberSidebarSections(NO_FLAGS, true),
};

/** Rollen-Startseiten und das globale Profil sind absichtlich nur mobil verlinkt. */
const MOBILE_ONLY = new Set([
  '/owner',
  '/superadmin',
  '/admin',
  '/trainer',
  '/member',
  '/profile',
  '/billing',
]);

describe('Sidebar-Sektionen', () => {
  it.each(Object.entries(SECTIONS_BY_ROLE))('%s verlinkt kein Ziel doppelt', (_role, sections) => {
    const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toHaveLength(new Set(hrefs).size);
  });

  it('vergibt pro Ziel genau einen Namen — über alle Rollen hinweg', () => {
    const namesByHref = new Map<string, Set<string>>();
    for (const sections of Object.values(SECTIONS_BY_ROLE)) {
      for (const item of sections.flatMap((s) => s.items)) {
        const names = namesByHref.get(item.href) ?? new Set<string>();
        names.add(item.name);
        namesByHref.set(item.href, names);
      }
    }
    const ambiguous = [...namesByHref.entries()]
      .filter(([, names]) => names.size > 1)
      .map(([href, names]) => `${href}: ${[...names].join(' / ')}`);
    expect(ambiguous).toEqual([]);
  });

  it('führt kein Ziel mit Query-Parameter (bricht das Active-Highlighting)', () => {
    const withQuery = Object.values(SECTIONS_BY_ROLE)
      .flatMap((sections) => sections.flatMap((s) => s.items))
      .map((i) => i.href)
      .filter((href) => href.includes('?'));
    expect(withQuery).toEqual([]);
  });

  it('gibt jedem Kernmodul aus lib/features.ts genau eine Admin-Sektion', () => {
    const coreKeys = CLUB_FEATURES.filter((f) => f.category === 'core').map((f) => f.key);
    for (const key of coreKeys) {
      const withoutModule = adminSidebarSections(new Set([key]));
      const all = adminSidebarSections(NO_FLAGS);
      expect(withoutModule.length, `Modul "${key}" blendet keine Sektion aus`).toBe(all.length - 1);
    }
  });
});

describe('Mobile-Bottom-Nav', () => {
  const roles = ['owner', 'superadmin', 'admin', 'trainer', 'member'] as const;

  it.each(roles)('%s: jedes Ziel existiert auch in der Sidebar derselben Rolle', (role) => {
    const sidebarHrefs = new Set(
      SECTIONS_BY_ROLE[role]!.flatMap((s) => s.items.map((i) => i.href))
    );
    const orphans = mobileNavItems(role)
      .map((i) => i.href)
      .filter((href) => !MOBILE_ONLY.has(href) && !sidebarHrefs.has(href));
    expect(orphans).toEqual([]);
  });

  it.each(roles)('%s: höchstens 5 Tabs', (role) => {
    expect(mobileNavItems(role).length).toBeLessThanOrEqual(5);
  });
});
