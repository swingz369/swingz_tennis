import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) return forbiddenResponse();
    const clubId = auth.clubId;
    if (!clubId) return NextResponse.json({ meetings: [] });

    const { data } = await auth.supabase
      .from('member_meetings')
      .select('id, title, meeting_date, location, description, status, agenda, created_at')
      .eq('club_id', clubId)
      .order('meeting_date', { ascending: false });

    return NextResponse.json({ meetings: data ?? [] });
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Zugriff nur für Admins');
    const clubId = auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'Kein Verein' }, { status: 400 });

    const { title, meeting_date, location, description, agenda = [] } = await req.json();
    if (!title || !meeting_date)
      return NextResponse.json({ error: 'Titel und Datum erforderlich' }, { status: 400 });

    const { data, error } = await auth.supabase
      .from('member_meetings')
      .insert({
        club_id: clubId,
        title,
        meeting_date,
        location,
        description,
        agenda,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) return internalErrorResponse();
    return NextResponse.json({ meeting: data }, { status: 201 });
  });
}
