import { createClient } from '@/infrastructure/external/supabase/server';

export default async function AuthTestPage() {
  const supabase = await createClient();

  // Try to get user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Try a simple DB query
  const { data: testQuery, error: dbError } = await supabase
    .from('user_club_memberships')
    .select('count')
    .eq('user_id', user?.id || 'invalid')
    .limit(1);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Auth Test</h1>
      <div className="space-y-4">
        <div>
          <h2 className="font-bold">User from Session</h2>
          <pre>{JSON.stringify(user ? { id: user.id, email: user.email } : null, null, 2)}</pre>
          {authError && <p className="text-red-500">Auth Error: {authError.message}</p>}
        </div>
        <div>
          <h2 className="font-bold">DB Query Result</h2>
          <pre>{JSON.stringify({ testQuery, dbError: dbError?.message }, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
