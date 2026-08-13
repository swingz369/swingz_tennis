import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { courtService } from '@/lib/booking/court.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { CreateCourtTypeSchema } from '@/lib/types/court-booking';
import { buildPaginationMeta } from '@/lib/pagination';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:court-types');

// GET /api/court-types – Alle Platz-Typen abrufen (mit serverseitiger Pagination)
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    // Platztypen sind vereinsgebunden; ohne Club-Kontext gibt es nichts zu zeigen.
    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Club-Kontext ausgewählt' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));

    try {
      // Admins see all (active + inactive), members see only active
      const result =
        auth.role === 'admin' || auth.role === 'superadmin'
          ? await courtService.getAllCourtTypesPaginated(auth.clubId, page, limit)
          : await courtService.getCourtTypesPaginated(auth.clubId, page, limit);

      const pagination = buildPaginationMeta(page, limit, result.count);

      return NextResponse.json({ courtTypes: result.data, pagination });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error fetching court types:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

// POST /api/court-types – Neuen Platz-Typ erstellen
export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Club-Kontext ausgewählt' }, { status: 400 });
    }

    try {
      const body = await req.json();

      // Validate with Zod
      const validation = CreateCourtTypeSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.errors },
          { status: 400 }
        );
      }

      const courtType = await courtService.createCourtType(
        auth.clubId,
        validation.data as Parameters<typeof courtService.createCourtType>[1]
      );
      return NextResponse.json({ success: true, courtType }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error creating court type:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
