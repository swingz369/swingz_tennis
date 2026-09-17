import { redirect } from 'next/navigation';

// Konsolidiert: Tagesansicht ist ein Ansichtsmodus des Platzkalenders /scheduler
// (?calView=daily), kein eigener Tab von /bookings mehr.
export default function DailyCourtViewRedirect() {
  redirect('/scheduler?calView=daily');
}
