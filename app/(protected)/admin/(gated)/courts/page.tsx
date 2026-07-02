import { redirect } from 'next/navigation';
import { requireAdminClub } from '@/lib/admin-context';

// Platzverwaltung wurde in die rollenabhängige Kalender-Seite überführt.
export default async function AdminCourtsPage() {
  await requireAdminClub();
  redirect('/bookings?tab=courts');
}
