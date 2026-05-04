import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';
import { courtBookingEngine } from '@/lib/court-booking-engine';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    try {
      const { id: courtId } = await params;

      const searchParams = req.nextUrl.searchParams;
      const startDate = searchParams.get('start_date') || '';
      const endDate = searchParams.get('end_date') || '';

      if (!startDate || !endDate) {
        return NextResponse.json(
          { error: 'start_date and end_date are required' },
          { status: 400 }
        );
      }

      const { data: court } = await auth.supabase
        .from('courts')
        .select('*, court_type(*)')
        .eq('id', courtId)
        .single();

      if (!court) {
        return NextResponse.json({ error: 'Platz nicht gefunden' }, { status: 404 });
      }

      if (
        court.club_id !== auth.clubId &&
        !['admin', 'superadmin'].includes(
          (
            await auth.supabase
              .from('user_club_memberships')
              .select('role')
              .eq('user_id', auth.user.id)
              .eq('club_id', auth.clubId)
              .single()
          ).data?.role || ''
        )
      ) {
        return NextResponse.json({ error: 'Keine Berechtigung für diesen Platz' }, { status: 403 });
      }

      const schedule = await courtBookingEngine.getCourtSchedule(courtId, startDate, endDate);

      return NextResponse.json(schedule);
    } catch (error) {
      console.error('Error fetching court schedule:', error);
      const isDevelopment = process.env.NODE_ENV === 'development';
      const message =
        isDevelopment && error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
