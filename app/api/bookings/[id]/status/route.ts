import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { UpdateBookingStatusUseCase } from '@/application/use-cases/booking-status.use-cases';
import { DrizzleBookingRepository } from '@/infrastructure/persistence/repositories/booking.repository';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';
import { updateBookingStatusSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withApiAuth(_request, async (auth) => {
    // Only admins can update booking status
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    return withValidation(updateBookingStatusSchema, async (input) => {
      const { status } = input;

      // Get user's role for authorization
      const { data: membership } = await auth.supabase
        .from('user_club_memberships')
        .select('role')
        .eq('user_id', auth.user.id)
        .eq('club_id', auth.clubId)
        .single();

      const isAdmin = membership?.role === 'admin' || membership?.role === 'superadmin';

      // Execute use case
      const bookingRepo = new DrizzleBookingRepository();
      const scheduleRepo = new DrizzleScheduleRepository();
      const useCase = new UpdateBookingStatusUseCase(bookingRepo, scheduleRepo);

      try {
        await useCase.execute(id, status, [auth.clubId], isAdmin, auth.user.id);
        return NextResponse.json({ success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const statusCode = message.includes('Forbidden') ? 403 : 400;
        return NextResponse.json({ error: message }, { status: statusCode });
      }
    })(_request);
  });
}
