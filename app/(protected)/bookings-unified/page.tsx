import { redirect } from 'next/navigation';

// Konsolidiert: alle Buchungs-Flows laufen über /bookings (Tab „Meine Buchungen").
export default function UnifiedBookingsRedirect() {
  redirect('/bookings?tab=my');
}
