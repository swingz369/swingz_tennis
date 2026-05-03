import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { UpdateBookingStatusUseCase } from '@/application/use-cases/booking-status.use-cases';
import { DrizzleBookingRepository } from '@/infrastructure/persistence/repositories/booking.repository';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';
import { updateBookingStatusSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';

type Membership = {
  club_id: string;
  role: 'member' | 'trainer' | 'admin' | 'superadmin';
};

export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withValidation(updateBookingStatusSchema, async (input) => {
    const { status } = input;

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Load user club memberships
    const { data: rawMemberships } = await supabase
      .from('user_club_memberships')
      .select('club_id, role')
      .eq('user_id', user.id);

    const memberships = (rawMemberships as Membership[] | null) || [];

    if (memberships.length === 0) {
      return NextResponse.json({ error: 'No club membership' }, { status: 403 });
    }

    const actorClubIds = memberships.map((m) => m.club_id);
    const isAdmin = memberships.some((m) => m.role === 'admin' || m.role === 'superadmin');

    // Execute use case
    const bookingRepo = new DrizzleBookingRepository();
    const scheduleRepo = new DrizzleScheduleRepository();
    const useCase = new UpdateBookingStatusUseCase(bookingRepo, scheduleRepo);

    try {
      await useCase.execute(id, status, actorClubIds, isAdmin, user.id);
      return NextResponse.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const statusCode = message.includes('Forbidden') ? 403 : 400;
      return NextResponse.json({ error: message }, { status: statusCode });
    }
   })(_request);
}
