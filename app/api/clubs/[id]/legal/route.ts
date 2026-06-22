import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withApiAuth(_req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
    if (auth.role !== 'owner' && auth.clubId !== id) return forbiddenResponse();
    const { data } = await (auth.supabase as any)
      .from('clubs')
      .select('legal_info')
      .eq('id', id)
      .maybeSingle();
    return NextResponse.json({ legal_info: data?.legal_info ?? {} });
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
    if (auth.role !== 'owner' && auth.clubId !== id) return forbiddenResponse();
    const { legal_info } = await req.json();
    const { error } = await (auth.supabase as any)
      .from('clubs')
      .update({ legal_info, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  });
}
