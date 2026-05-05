import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { courtService } from '@/lib/booking/court.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';
import { CreateCourtTypeSchema } from '@/lib/types/court-booking';

// GET /api/court-types – Alle Platz-Typen abrufen
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    try {
      const courtTypes = await courtService.getAllCourtTypes();
      return NextResponse.json({ courtTypes });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching court types:', message);
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

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

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

      const courtType = await courtService.createCourtType(validation.data);
      return NextResponse.json({ success: true, courtType }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating court type:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
