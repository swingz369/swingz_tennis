import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CreateBookingForm } from '@/components/bookings/CreateBookingForm';

export const dynamic = 'force-dynamic'; // No caching for booking pages

export default async function NewBookingPage() {
  const supabase = await createClient();

  // Server-seitige Auth-Prüfung
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Alle aktiven Courts abrufen
  const { data: courts, error } = await supabase
    .from('courts')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  if (error || !courts || courts.length === 0) {
    // Fallback: Leere Liste oder Fehlerbehandlung
    console.error('Failed to fetch courts:', error);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold mb-6">Neue Buchung</h1>
      <CreateBookingForm courts={courts ?? []} />
    </div>
  );
}
