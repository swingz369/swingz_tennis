import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createClient } from '@/infrastructure/external/supabase/server';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

// ponytail: cast until `supabase gen types` re-runs with the new migration

const from = (sb: Awaited<ReturnType<typeof createClient>>, t: string) => (sb as any).from(t);

export async function GET(req: NextRequest, { params }: Ctx) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
    const { id } = await params;
    const sb = await createClient();
    const { data, error } = await from(sb, 'special_event_registrations')
      .select('*, user:users(id, full_name, email)')
      .eq('event_id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ registrations: data });
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
    const { id } = await params;
    const body = await req.json();
    const sb = await createClient();
    const { data, error } = await from(sb, 'special_events')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('club_id', auth.clubId!)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ event: data });
  });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
    const { id } = await params;
    const sb = await createClient();
    const { error } = await from(sb, 'special_events')
      .delete()
      .eq('id', id)
      .eq('club_id', auth.clubId!);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  });
}
