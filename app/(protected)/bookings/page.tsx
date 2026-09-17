'use client';

import { PageHeader } from '@/components/ui/page-header';
import { MyBookings } from '@/components/bookings/my-bookings';
import MyGroups from '@/components/bookings/my-groups';

/**
 * „Meine Buchungen" — Gruppen und eigene Trainings-/Platzbuchungen.
 *
 * Enthielt bis zur Kalender-Konsolidierung (Sanierungsplan Phase 2.1) zusätzlich
 * ein eigenes 7-Spalten-Monatsraster mit denselben Sessions, die der Platzkalender
 * (/scheduler) schon zeigte — reine Dopplung. Das Monatsraster lebt jetzt dort als
 * fünfter Ansichtsmodus, diese Seite bleibt die reine Listenansicht.
 */
export default function BookingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Meine Buchungen"
        description="Deine Gruppen und Trainingseinheiten"
        actions={[{ label: 'Neue Platzbuchung', href: '/scheduler' }]}
      />
      <div className="space-y-6">
        <MyGroups />
        <MyBookings />
      </div>
    </div>
  );
}
