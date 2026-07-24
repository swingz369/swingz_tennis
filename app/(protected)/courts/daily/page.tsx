import { redirect } from 'next/navigation';

// Konsolidiert: Tagesansicht lebt im Platz-Kalender-Tab von /bookings.
export default function DailyCourtViewRedirect() {
  redirect('/bookings?tab=courts');
}
