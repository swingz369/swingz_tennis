import { redirect } from 'next/navigation';
import { requireAdminClub } from '@/lib/admin-context';
import { TrainerDetailClient } from './trainer-detail-client';

export const dynamic = 'force-dynamic';

export default async function TrainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { clubId } = await requireAdminClub();
  if (!clubId) redirect('/login');

  return <TrainerDetailClient trainerId={id} />;
}
