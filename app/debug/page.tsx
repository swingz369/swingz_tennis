import { createClient } from '@/infrastructure/external/supabase/client';
import { cookies } from 'next/headers';

export default async function DebugPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Debug Info</h1>
      <pre className="bg-muted p-4 rounded">
        {JSON.stringify(
          {
            user: user ? { id: user.id, email: user.email } : null,
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
            cookies: allCookies.map((c) => ({
              name: c.name,
              value: c.value.substring(0, 20) + '...',
            })),
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}
