import { redirect } from 'next/navigation';

// Zusammengelegt (PRODUKTIONSREIFE.md 4.1, seit Sanierungsplan Phase 2 ohne
// Tabs): Gruppen und eigene Buchungen stehen unter /bookings. Zwei Seiten mit
// denselben zwei Komponenten waren fuer ein Mitglied nicht unterscheidbar.
export default function TrainingSchedulePage() {
  redirect('/bookings');
}
