import { redirect } from 'next/navigation';

// Konsolidiert: /bookings ist seit der Kalender-Konsolidierung (Phase 2) nur
// noch die eine Ansicht „Meine Buchungen", keine Tabs mehr.
export default function MyBookingsRedirect() {
  redirect('/bookings');
}
