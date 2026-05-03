import { NextRequest, NextResponse } from 'next/server';
import { CancelBookingUseCase } from '@/application/use-cases/booking.use-cases';
import { DrizzleBookingRepository } from '@/infrastructure/persistence/repositories/booking.repository';
import { cancelBookingSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { createClient } from '@/infrastructure/external/supabase/server';

const bookingRepo = new DrizzleBookingRepository();
const cancelBookingUseCase = new CancelBookingUseCase(bookingRepo);

// Helper: Check for demo mode cookie
function isDemoMode(req: NextRequest): boolean {
  const cookies = req.cookies.get('demo-mode');
  return !!cookies?.value;
}

// PATCH /api/bookings/:id/cancel – Booking stornieren
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Demo mode: always succeed
  if (isDemoMode(req)) {
    return NextResponse.json({
      success: true,
      bookingId: id,
      cancelled: true,
    });
  }

  return withValidation(cancelBookingSchema, async (input) => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (!user || authError) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const result = await cancelBookingUseCase.execute({
        bookingId: id,
        reason: input.reason,
        notes: input.notes,
        actorId: user.id,
      });
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error cancelling booking:', error);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  })(req);
}
