'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Wrench } from 'lucide-react';
import UnifiedCourtCalendar from '@/components/unified-court-calendar';
import { CourtsHubTabs } from './courts-hub-tabs';
import type { Court } from '@/lib/types/court-booking';

/**
 * „Plätze" — eine Sidebar-Sektion, eine Seite, zwei Sichten.
 * Platzkalender (vorher /scheduler) und Platzverwaltung (vorher eigener
 * Sidebar-Link) sind jetzt Tabs derselben Seite:
 *   • Kalender   = Überblick über Buchungen/Sessions, Platz sperren
 *   • Verwaltung = Plätze & Typen, Wartungsplan, Platzsperren (+ Wetter)
 *
 * Der Kalender bleibt für Mitglieder/Trainer weiterhin unter /scheduler
 * erreichbar — nur die ADMIN-Navigation bündelt beide Sichten.
 * `?view=manage` öffnet die Seite direkt auf der Verwaltungs-Sicht.
 */

type Props = {
  clubId: string;
  initialCourts: Court[];
  courtTypes: Array<{ id: string; name: string; surface: string }>;
  showWeather: boolean;
};

function PlacesHubTabsInner({ clubId, initialCourts, courtTypes, showWeather }: Props) {
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState(searchParams?.get('view') || 'calendar');

  useEffect(() => {
    const view = searchParams?.get('view');
    if (view) setActiveView(view);
  }, [searchParams]);

  return (
    <Tabs value={activeView} onValueChange={setActiveView}>
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="calendar" className="gap-2">
          <CalendarDays className="h-4 w-4" />
          Kalender
        </TabsTrigger>
        <TabsTrigger value="manage" className="gap-2">
          <Wrench className="h-4 w-4" />
          Verwaltung
        </TabsTrigger>
      </TabsList>

      <TabsContent value="calendar" className="mt-6">
        <UnifiedCourtCalendar />
      </TabsContent>

      <TabsContent value="manage" className="mt-6">
        <CourtsHubTabs
          clubId={clubId}
          initialCourts={initialCourts}
          courtTypes={courtTypes}
          showWeather={showWeather}
        />
      </TabsContent>
    </Tabs>
  );
}

export function PlacesHubTabs(props: Props) {
  return (
    <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Laden</div>}>
      <PlacesHubTabsInner {...props} />
    </Suspense>
  );
}
