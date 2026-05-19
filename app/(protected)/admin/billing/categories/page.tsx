import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import FeeCategoriesClient from './fee-categories-client';

export default async function FeeCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string }>;
}) {
  const { supabase } = await requireAuth();
  const sp = await searchParams;
  const clubId = sp.clubId;
  if (!clubId) redirect('/admin/billing');

  const { data: categories } = await (supabase as any)
    .from('fee_configurations')
    .select('*')
    .eq('club_id', clubId)
    .in('type', ['training', 'membership'])
    .order('type').order('name');

  return <FeeCategoriesClient clubId={clubId} initialCategories={categories ?? []} />;
}
