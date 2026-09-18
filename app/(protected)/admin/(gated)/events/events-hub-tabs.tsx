'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, CalendarDays } from 'lucide-react';
import { TournamentsClient } from '../tournaments/tournaments-client';
import { SpecialEventsClient } from '../special-events/special-events-client';

/**
 * „Veranstaltungen" — eine Sidebar-Sektion, eine Seite, zwei Sichten.
 * Turniere und Sonderveranstaltungen waren zwei Navigations-Einträge;
 * jetzt sind sie Tabs derselben Seite. „Turniere" hängt am
 * `tournaments`-Feature-Flag und verschwindet, wenn es aus ist —
 * Sonderveranstaltungen sind immer verfügbar.
 * `?tab=tournaments` / `?tab=special-events` öffnen die Seite direkt auf
 * der jeweiligen Sicht (Deep-Links der alten Routen).
 */

type Props = Parameters<typeof TournamentsClient>[0] & {
  showTournaments: boolean;
};

function EventsHubTabsInner({ initialTournaments, pagination, showTournaments }: Props) {
  const searchParams = useSearchParams();
  const defaultTab = showTournaments ? 'tournaments' : 'special-events';
  const [activeTab, setActiveTab] = useState(searchParams?.get('tab') ?? defaultTab);

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList
        className={`grid w-full max-w-md ${showTournaments ? 'grid-cols-2' : 'grid-cols-1'}`}
      >
        {showTournaments && (
          <TabsTrigger value="tournaments" className="gap-2">
            <Trophy className="h-4 w-4" />
            Turniere
          </TabsTrigger>
        )}
        <TabsTrigger value="special-events" className="gap-2">
          <CalendarDays className="h-4 w-4" />
          Sonderveranstaltungen
        </TabsTrigger>
      </TabsList>

      {showTournaments && (
        <TabsContent value="tournaments" className="mt-6">
          <TournamentsClient initialTournaments={initialTournaments} pagination={pagination} />
        </TabsContent>
      )}

      <TabsContent value="special-events" className="mt-6">
        <SpecialEventsClient />
      </TabsContent>
    </Tabs>
  );
}

export function EventsHubTabs(props: Props) {
  return (
    <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Laden</div>}>
      <EventsHubTabsInner {...props} />
    </Suspense>
  );
}
