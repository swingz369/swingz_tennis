import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
    const body = await req.json();
    const { data: ex } = await (auth.supabase as any)
      .from('member_meetings')
      .select('club_id')
      .eq('id', id)
      .maybeSingle();
    if (!ex || ex.club_id !== auth.clubId) return forbiddenResponse();
    const { data, error } = await (auth.supabase as any)
      .from('member_meetings')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ meeting: data });
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withApiAuth(_req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
    const { data: ex } = await (auth.supabase as any)
      .from('member_meetings')
      .select('club_id')
      .eq('id', id)
      .maybeSingle();
    if (!ex || ex.club_id !== auth.clubId) return forbiddenResponse();
    await (auth.supabase as any).from('member_meetings').delete().eq('id', id);
    return NextResponse.json({ success: true });
  });
}
