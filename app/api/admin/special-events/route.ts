import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createClient } from '@/infrastructure/external/supabase/server';

// ponytail: cast until `supabase gen types` re-runs with the new migration

const from = (sb: Awaited<ReturnType<typeof createClient>>, t: string) => (sb as any).from(t);

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
    const sb = await createClient();
    const { data, error } = await from(sb, 'special_events')
      .select('*')
      .eq('club_id', auth.clubId!)
      .order('start_date', { ascending: true });
    if (error) return internalErrorResponse();
    return NextResponse.json({ events: data });
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
    const body = await req.json();
    const sb = await createClient();
    const { data, error } = await from(sb, 'special_events')
      .insert({ ...body, club_id: auth.clubId, created_by: auth.user.id })
      .select()
      .single();
    if (error) return internalErrorResponse();
    return NextResponse.json({ event: data }, { status: 201 });
  });
}
