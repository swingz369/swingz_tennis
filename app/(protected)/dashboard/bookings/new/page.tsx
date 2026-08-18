import { redirect } from 'next/navigation';

// Konsolidiert: Neue Buchungen entstehen im Platz-Kalender von /bookings.
export default function NewBookingRedirect() {
  redirect('/scheduler');
}
