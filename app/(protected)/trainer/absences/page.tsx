import { requireAuth } from '@/lib/auth';
import { AbsenceManagement } from '@/components/absences/absence-management';

export const dynamic = 'force-dynamic';

export default async function TrainerAbsencesPage() {
  const { supabase, user } = await requireAuth();
  const { data } = await supabase.from('users').select('full_name').eq('id', user.id).single();
  const trainerName = (data?.full_name as string | null) || user.email || 'Trainer';

  return <AbsenceManagement trainerId={user.id} trainerName={trainerName} />;
}
