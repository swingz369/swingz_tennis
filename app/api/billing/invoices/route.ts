import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { InvoiceService } from '@/application/services/invoice.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:invoices');

const CreateSchema = z.object({
  club_id: z.string().uuid(),
  member_id: z.string().uuid(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(255),
        quantity: z.number().int().min(1),
        unit_price: z.number().min(0),
      })
    )
    .min(1),
});

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId');
    if (!clubId) return errorResponse('VALIDATION_ERROR', 'clubId erforderlich');
    if (!verifyClubAccess(auth, clubId)) return forbiddenResponse('Nicht berechtigt');

    try {
      const invoices = await new InvoiceService(auth).getInvoicesByClub(clubId, {
        type: searchParams.get('type') ?? undefined,
        status: searchParams.get('status') ?? undefined,
        memberId: searchParams.get('memberId') ?? undefined,
        includeItems: true,
      });
      return NextResponse.json({ data: invoices });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error(
        'Rechnungen konnten nicht geladen werden',
        error instanceof Error ? error : undefined
      );
      return internalErrorResponse();
    }
  });
}

export async function POST(request: NextRequest) {
  return withApiAuth(
    request,
    async (auth, body) => {
      const hasPermission = await verifyRole(auth, 'admin');
      if (!hasPermission) return forbiddenResponse('Zugriff nur für Admins');
      if (!verifyClubAccess(auth, body.club_id)) return forbiddenResponse('Nicht berechtigt');

      try {
        const invoice = await new InvoiceService(auth).createAdhocInvoice(body);
        return NextResponse.json({ data: invoice }, { status: 201 });
      } catch (error) {
        if (error instanceof ApiException) {
          return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
        }
        log.error(
          'Adhoc-Rechnung konnte nicht erstellt werden',
          error instanceof Error ? error : undefined
        );
        return internalErrorResponse();
      }
    },
    { body: CreateSchema }
  );
}
