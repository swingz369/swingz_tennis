'use client';

import { Suspense, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, MapPin, Ban } from 'lucide-react';
import UnifiedCourtCalendar from '@/components/unified-court-calendar';
import { HideCalendarHeadingContext } from '@/components/calendar/CalendarShell';
import { CourtsManageClient } from './courts-manage-client';
import { MaintenanceTab } from './maintenance-tab';
import WeatherClient from './weather-tab';
import { ClosuresManager } from './closures-tab';
import type { Court } from '@/lib/types/court-booking';

/**
 * „Plätze" — eine Sidebar-Sektion, eine Seite, drei gleichrangige Sichten (Kalender, Plätze, Wartung & Sperren).
 * Vorher lagen zwei Tab-Leisten übereinander (Kalender|Verwaltung, darin
 * Plätze|Wartung|Sperren): vier Ziele zwei Klicks tief.
 *
 * Der aktive Tab steht im `?tab=`-Parameter, damit Deep-Link, Reload und
 * Zurück-Button funktionieren — vorher lebte er nur in `useState`.
 * Der Kalender bleibt für Mitglieder/Trainer unter /scheduler erreichbar.
 */

const TAB_VALUES = ['calendar', 'courts', 'closures'] as const;
type TabValue = (typeof TAB_VALUES)[number];

/**
 * Altlinks aus der verschachtelten Zeit abbilden: `?view=manage` öffnete die
 * Verwaltung, `?tab=` den inneren Tab (`courts`/`maintenance`/`closures` —
 * Namen sind unverändert). `/admin/courts?view=manage&tab=closures` steht so
 * z. B. in `components/calendar/calendar-banners.tsx`.
 */
export function resolveTab(params: URLSearchParams | null): TabValue {
  const tab = params?.get('tab');
  // „Wartung“ ist im Tab „Wartung & Sperren“ aufgegangen (Altlinks).
  if (tab === 'maintenance') return 'closures';
  if (tab && (TAB_VALUES as readonly string[]).includes(tab)) return tab as TabValue;
  return params?.get('view') === 'manage' ? 'courts' : 'calendar';
}

type Props = {
  clubId: string;
  initialCourts: Court[];
  courtTypes: Array<{ id: string; name: string; surface: string }>;
  showWeather: boolean;
};

function CourtsHubTabsInner({ clubId, initialCourts, courtTypes, showWeather }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = resolveTab(searchParams);

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('tab', value);
      // Der Altparameter würde den neuen `tab` sonst überdauern und Links
      // erzeugen, die zwei Zustände gleichzeitig behaupten.
      params.delete('view');
      // push statt replace: der Zurück-Button soll zum vorherigen Tab führen,
      // nicht aus der Seite heraus.
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="grid w-full max-w-3xl grid-cols-3">
        <TabsTrigger value="calendar" className="gap-2">
          <CalendarDays className="h-4 w-4" />
          Kalender
        </TabsTrigger>
        <TabsTrigger value="courts" className="gap-2">
          <MapPin className="h-4 w-4" />
          Plätze
        </TabsTrigger>
        <TabsTrigger value="closures" className="gap-2">
          <Ban className="h-4 w-4" />
          Wartung & Sperren
        </TabsTrigger>
      </TabsList>

      <TabsContent value="calendar" className="mt-6">
        <HideCalendarHeadingContext.Provider value>
          <UnifiedCourtCalendar />
        </HideCalendarHeadingContext.Provider>
      </TabsContent>

      <TabsContent value="courts" className="mt-6">
        <CourtsManageClient initialCourts={initialCourts} courtTypes={courtTypes} clubId={clubId} />
      </TabsContent>

      <TabsContent value="closures" className="mt-6 space-y-6">
        {/* Wetter steht bei den Sperren, weil Regen/Frost der häufigste Grund
            für eine Sperre ist — die Empfehlung führt direkt zur Aktion. */}
        {showWeather && <WeatherClient />}
        <ClosuresManager
          courts={initialCourts
            .filter((c) => c.is_active)
            .map((c) => ({ id: c.id, name: c.name, surface: c.surface }))}
        />
        <MaintenanceTab />
      </TabsContent>
    </Tabs>
  );
}

export function CourtsHubTabs(props: Props) {
  return (
    <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Laden</div>}>
      <CourtsHubTabsInner {...props} />
    </Suspense>
  );
}
