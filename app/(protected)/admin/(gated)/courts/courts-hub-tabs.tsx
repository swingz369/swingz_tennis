'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Wrench, Ban } from 'lucide-react';
import { CourtsManageClient } from './courts-manage-client';
import { MaintenanceTab } from './maintenance-tab';
import WeatherClient from './weather-tab';
import { ClosuresManager } from './closures-tab';
import type { Court } from '@/lib/types/court-booking';

type Props = {
  clubId: string;
  initialCourts: Court[];
  courtTypes: Array<{ id: string; name: string; surface: string }>;
  showWeather: boolean;
};

function CourtsHubTabsInner({ clubId, initialCourts, courtTypes, showWeather }: Props) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams?.get('tab') || 'courts');

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className={`grid w-full max-w-2xl grid-cols-3`}>
        <TabsTrigger value="courts" className="gap-2">
          <MapPin className="h-4 w-4" />
          Plätze & Typen
        </TabsTrigger>
        <TabsTrigger value="maintenance" className="gap-2">
          <Wrench className="h-4 w-4" />
          Wartungsplan
        </TabsTrigger>
        <TabsTrigger value="closures" className="gap-2">
          <Ban className="h-4 w-4" />
          Platzsperren
        </TabsTrigger>
      </TabsList>

      <TabsContent value="courts" className="mt-6">
        <CourtsManageClient initialCourts={initialCourts} courtTypes={courtTypes} clubId={clubId} />
      </TabsContent>

      <TabsContent value="maintenance" className="mt-6">
        <MaintenanceTab />
      </TabsContent>

      <TabsContent value="closures" className="mt-6 space-y-6">
        {showWeather && <WeatherClient />}
        <ClosuresManager
          courts={initialCourts
            .filter((c) => c.is_active)
            .map((c) => ({ id: c.id, name: c.name, surface: c.surface }))}
        />
      </TabsContent>
    </Tabs>
  );
}

export function CourtsHubTabs(props: Props) {
  return (
    <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Laden</div>}>
      <CourtsHubTabsInner {...props} />
    </Suspense>
  );
}
