import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { CancelBookingUseCase } from '@/application/use-cases/booking.use-cases';
import { DrizzleBookingRepository } from '@/infrastructure/persistence/repositories/booking.repository';
import { AuditServiceImpl } from '@/infrastructure/audit/audit.service';
import { cancelBookingSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

const bookingRepo = new DrizzleBookingRepository();
const auditService = new AuditServiceImpl();
const cancelBookingUseCase = new CancelBookingUseCase(bookingRepo, auditService);

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

  return withApiAuth(req, async (auth) => {
    // Members can cancel bookings
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    return withValidation(cancelBookingSchema, async (input) => {
      try {
        const result = await cancelBookingUseCase.execute({
          bookingId: id,
          reason: input.reason,
          notes: input.notes,
          actorId: auth.user.id,
        });
        return NextResponse.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error cancelling booking:', error);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    })(req);
  });
}
