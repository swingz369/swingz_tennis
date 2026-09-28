'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Sub-Navigation der Saisonplanung: Übersicht (Status, Tabs) und der
 * Planungs-Wizard. Der eigentliche Wochenplan lebt nicht mehr hier —
 * er ist die rollenübergreifende gemeinsame Ansicht unter /scheduler.
 */
export function SeasonPlanningTabs({ seasonId }: { seasonId: string }) {
  const pathname = usePathname();

  const overviewHref = `/admin/seasons/${seasonId}`;
  const tabs = [
    { name: 'Übersicht', href: overviewHref },
    { name: 'Planungs-Wizard', href: `${overviewHref}/planning` },
    { name: 'Saison-Einstellungen', href: `${overviewHref}/edit` },
  ];

  return (
    <nav
      aria-label="Saisonplanungs-Werkzeuge"
      className="mb-4 inline-flex h-11 max-w-full items-center gap-1 overflow-x-auto rounded-md border border-border bg-card p-1"
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
              'inline-flex items-center justify-center whitespace-nowrap h-full rounded px-3 py-1 text-sm font-medium transition-colors hover:text-foreground',
              active ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground'
            )}
          >
            {tab.name}
          </Link>
        );
      })}
    </nav>
  );
}
