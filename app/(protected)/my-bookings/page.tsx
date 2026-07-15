import { redirect } from 'next/navigation';

// Konsolidiert: alle Buchungs-Flows laufen über /bookings (Tab „Meine Buchungen").
export default function MyBookingsRedirect() {
  redirect('/bookings?tab=my');
}
