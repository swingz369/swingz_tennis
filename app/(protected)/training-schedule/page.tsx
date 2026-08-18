import { redirect } from 'next/navigation';

// Zusammengelegt (PRODUKTIONSREIFE.md 4.1): Gruppen und eigene Buchungen
// stehen jetzt zusammen im Tab „Mein Trainingsplan" von /bookings. Zwei Seiten
// mit denselben zwei Komponenten waren fuer ein Mitglied nicht unterscheidbar.
export default function TrainingSchedulePage() {
  redirect('/bookings?tab=my');
}
