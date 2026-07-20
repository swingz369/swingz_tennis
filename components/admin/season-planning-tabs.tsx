'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Gemeinsame Sub-Navigation der Saisonplanungs-Werkzeuge (P1, UX-Audit
 * 2026-07-15): drei fast gleichnamige Seiten (plan / planning /
 * season-plan) bekommen klare Namen und sind untereinander erreichbar.
 */
export function SeasonPlanningTabs({ seasonId }: { seasonId: string }) {
  const pathname = usePathname();

  const overviewHref = `/admin/seasons/${seasonId}`;
  const tabs = [
    { name: 'Übersicht', href: overviewHref },
    { name: 'Planungs-Wizard', href: `${overviewHref}/planning` },
    { name: 'Trainingsplan', href: `${overviewHref}/plan` },
    { name: 'Rasteransicht', href: `/admin/season-plan/${seasonId}` },
  ];

  return (
    <nav
      aria-label="Saisonplanungs-Werkzeuge"
      className="flex gap-1 border-b border-border mb-4 overflow-x-auto"
    >
      {tabs.map((tab) => {
        const active =
          tab.href === overviewHref ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              active
                ? 'border-brand-light text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.name}
          </Link>
        );
      })}
    </nav>
  );
}
