'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, User } from 'lucide-react';

// Import existing booking components (will create simplified versions)
import { SessionBookings } from '@/components/bookings/session-bookings';
import { CourtBookings } from '@/components/bookings/court-bookings';
import { MyBookings } from '@/components/bookings/my-bookings';

export default function UnifiedBookingsPage() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'courts' | 'mine'>('sessions');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Buchungen</h1>
        <p className="text-muted-foreground mt-2">
          Verwalte deine Trainings und Platzreservierungen
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full max-w-[600px] grid-cols-3">
          <TabsTrigger value="sessions" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Trainings</span>
            <span className="sm:hidden">Train</span>
          </TabsTrigger>
          <TabsTrigger value="courts" className="gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Platzreservierung</span>
            <span className="sm:hidden">Platz</span>
          </TabsTrigger>
          <TabsTrigger value="mine" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Meine Buchungen</span>
            <span className="sm:hidden">Meine</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-6">
          <SessionBookings />
        </TabsContent>

        <TabsContent value="courts" className="mt-6">
          <CourtBookings />
        </TabsContent>

        <TabsContent value="mine" className="mt-6">
          <MyBookings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
