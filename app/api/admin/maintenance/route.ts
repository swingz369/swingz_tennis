import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) return forbiddenResponse();
    const clubId = auth.clubId;
    if (!clubId) return NextResponse.json({ items: [] });

    const { data } = await (auth.supabase as any)
      .from('court_maintenance')
      .select('id, title, description, start_date, end_date, status, court_id, courts(name)')
      .eq('club_id', clubId)
      .order('start_date', { ascending: true });

    return NextResponse.json({ items: data ?? [] });
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Admin access required');
    const clubId = auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'Kein Verein' }, { status: 400 });

    const {
      title,
      description,
      start_date,
      end_date,
      court_id,
      status = 'geplant',
    } = await req.json();
    if (!title || !start_date || !end_date)
      return NextResponse.json(
        { error: 'Titel, Start- und Enddatum erforderlich' },
        { status: 400 }
      );

    const { data, error } = await (auth.supabase as any)
      .from('court_maintenance')
      .insert({
        club_id: clubId,
        title,
        description,
        start_date,
        end_date,
        status,
        court_id: court_id || null,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data }, { status: 201 });
  });
}
