import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { HoursLogService } from '@/src/application/services/hours-log.service';
import { billingEngine } from '@/lib/billing-engine';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    // Only admin and superadmin can approve
    const isAdmin = await verifyRole(auth, 'admin');
    const isSuperadmin = await verifyRole(auth, 'superadmin');

    if (!isAdmin && !isSuperadmin) {
      return forbiddenResponse('Admin oder Superadmin Zugriff erforderlich');
    }

    // Apply rate limiting
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const hoursLog = await HoursLogService.approveHoursLog(id, auth.user.id);

      // Fire-and-forget: create an invoice line for the approved hours.
      // Failures here must NOT fail the approval response.
      if (hoursLog?.trainerId && hoursLog?.duration) {
        (async () => {
          try {
            // Fetch the club_id for this hours_log from the DB since the
            // in-memory HoursLog entity doesn't carry it.
            const { data: dbLog } = await auth.supabase
              .from('hours_logs')
              .select('club_id')
              .eq('id', id)
              .maybeSingle();

            const clubId = dbLog?.club_id;
            if (!clubId) return;

            const now = new Date();
            const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 15)
              .toISOString()
              .substring(0, 10);

            // Only create a new invoice if none is already open for this trainer
            const existing = await billingEngine.getInvoicesByMember(hoursLog.trainerId, {
              status: 'draft',
              limit: 1,
            });

            const hours = hoursLog.duration / 60;
            const description = `Trainerstunden ${hoursLog.date}: ${hours.toFixed(2)}h`;

            if (existing.length === 0) {
              await billingEngine.createInvoice({
                club_id: clubId,
                member_id: hoursLog.trainerId,
                due_date: dueDate,
                notes: 'Auto-generated from approved hours log',
                items: [
                  {
                    description,
                    quantity: hours,
                    unit_price: 0, // hourly rate applied separately
                    tax_rate: 19,
                    item_type: 'trainer_hours',
                  },
                ],
              });
            }
          } catch (billingErr) {
            console.warn(
              '[HoursLog Approve] invoice auto-create failed (non-blocking):',
              billingErr
            );
          }
        })();
      }

      return NextResponse.json({
        success: true,
        hoursLog,
        message: 'Stundennachweis genehmigt',
      });
    } catch (error) {
      console.error('Approve hours log error:', error);
      return NextResponse.json(
        { success: false, error: 'Fehler bei der Genehmigung' },
        { status: 500 }
      );
    }
  });
}
