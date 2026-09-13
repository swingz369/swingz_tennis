import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { requireAuth, verifyClubAccess, verifyRole } from '@/lib/api-auth';
import { InvoiceService } from '@/application/services/invoice.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:invoices:id');

const UpdateSchema = z.object({
  status: z.enum(['sent', 'cancelled', 'overdue', 'reminder_sent']),
  cancellation_reason: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(request);

  try {
    const service = new InvoiceService(auth);
    const invoice = await service.getInvoiceById(id);

    const isMember = invoice.member_id === auth.user.id;
    if (!isMember && !verifyClubAccess(auth, invoice.club_id)) {
      return errorResponse('FORBIDDEN', 'Nicht berechtigt');
    }

    return NextResponse.json({ data: invoice });
  } catch (error) {
    if (error instanceof ApiException) {
      return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
    }
    log.error('Rechnung konnte nicht geladen werden', error instanceof Error ? error : undefined);
    return internalErrorResponse();
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(request);
  const body = await request.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const service = new InvoiceService(auth);
    const invoice = await service.getInvoiceById(id);
    if (!verifyClubAccess(auth, invoice.club_id) || !(await verifyRole(auth, 'admin'))) {
      return errorResponse('FORBIDDEN', 'Nicht berechtigt');
    }

    const updated = await service.updateInvoiceStatus(id, parsed.data.status, {
      cancellationReason: parsed.data.cancellation_reason,
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof ApiException) {
      return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
    }
    log.error(
      'Rechnung konnte nicht aktualisiert werden',
      error instanceof Error ? error : undefined
    );
    return internalErrorResponse();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);

  try {
    const service = new InvoiceService(auth);
    const invoice = await service.getInvoiceById(id);
    if (!verifyClubAccess(auth, invoice.club_id) || !(await verifyRole(auth, 'admin'))) {
      return errorResponse('FORBIDDEN', 'Nicht berechtigt');
    }

    await service.deleteInvoice(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiException) {
      return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
    }
    log.error('Rechnung konnte nicht gelöscht werden', error instanceof Error ? error : undefined);
    return internalErrorResponse();
  }
}
