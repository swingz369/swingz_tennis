import dynamicImport from 'next/dynamic';
import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { Skeleton } from '@/components/ui/skeleton';

const FeeCategoriesClient = dynamicImport(() => import('./fee-categories-client'), {
  loading: () => <Skeleton className="h-96 w-full rounded-xl" />,
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FeeCategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Get the user's active admin membership to determine club context
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isSuperadmin = memberships?.some((m: { role: string }) => m.role === 'superadmin');
  const adminMembership = memberships?.find((m: { role: string }) => m.role === 'admin');

  if (!isSuperadmin && !adminMembership) {
    redirect('/dashboard');
  }

  const clubId = adminMembership?.club_id ?? memberships?.[0]?.club_id ?? null;

  if (!clubId) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground">Kein Verein ausgewählt.</p>
      </div>
    );
  } // Fetch fee configurations for this club
  let categories: {
    id: string;
    name: string;
    type: string;
    amount: number;
    billing_cycle: string;
    is_active: boolean;
  }[] = [];
  try {
    const { data } = await supabase
      .from('fee_configurations')
      .select('id, name, type, amount, billing_cycle, is_active')
      .eq('club_id', clubId)
      .order('name');
    categories = data ?? [];
  } catch {
    // Table may not exist or RLS may block — render empty state
  }

  return <FeeCategoriesClient clubId={clubId} initialCategories={categories} />;
}
