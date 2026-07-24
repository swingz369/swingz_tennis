'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Wrench, Ban, Cpu } from 'lucide-react';
import { CourtsManageClient } from './courts-manage-client';
import { MaintenanceTab } from './maintenance-tab';
import WeatherClient from './weather-tab';
import { ClosuresManager } from './closures-tab';
import SmartCourtClient from './smart-court-tab';
import type { Court } from '@/lib/types/court-booking';
import type { HardwareVendor } from '@/lib/hardware/adapter';

type Props = {
  clubId: string;
  initialCourts: Court[];
  courtTypes: Array<{ id: string; name: string; surface: string }>;
  showWeather: boolean;
  showSmartCourt: boolean;
  initialVendor: HardwareVendor;
};

const GRID_COLS: Record<number, string> = {
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

function CourtsHubTabsInner({
  clubId,
  initialCourts,
  courtTypes,
  showWeather,
  showSmartCourt,
  initialVendor,
}: Props) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams?.get('tab') || 'courts');

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const tabCount = 3 + (showSmartCourt ? 1 : 0);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className={`grid w-full max-w-2xl ${GRID_COLS[tabCount]}`}>
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
        {showSmartCourt && (
          <TabsTrigger value="smart-court" className="gap-2">
            <Cpu className="h-4 w-4" />
            Smart Court
          </TabsTrigger>
        )}
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

      {showSmartCourt && (
        <TabsContent value="smart-court" className="mt-6">
          <SmartCourtClient
            clubId={clubId}
            initialVendor={initialVendor}
            courts={initialCourts.map((c) => ({
              id: c.id,
              name: c.name,
              court_type_id: c.court_type_id,
              is_active: c.is_active,
            }))}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}

export function CourtsHubTabs(props: Props) {
  return (
    <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Laden...</div>}>
      <CourtsHubTabsInner {...props} />
    </Suspense>
  );
}
