import { createClient } from '@/infrastructure/external/supabase/server';

export default async function DebugAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Not logged in</div>;
  }

  // Get memberships
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Debug – Admin Check</h1>
      <div className="space-y-4">
        <div>
          <h2 className="font-bold">User</h2>
          <pre>{JSON.stringify({ id: user.id, email: user.email }, null, 2)}</pre>
        </div>
        <div>
          <h2 className="font-bold">Memberships</h2>
          <pre>{JSON.stringify(memberships, null, 2)}</pre>
        </div>
        <div>
          <h2 className="font-bold">isSuperadmin</h2>
          <p>{memberships?.some((m: any) => m.role === 'superadmin') ? 'YES' : 'NO'}</p>
        </div>
        <div>
          <h2 className="font-bold">hasAdminRole</h2>
          <p>{memberships?.some((m: any) => m.role === 'admin') ? 'YES' : 'NO'}</p>
        </div>
      </div>
    </div>
  );
}
