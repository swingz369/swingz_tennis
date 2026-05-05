import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { DrizzleClubRepository } from '@/infrastructure/persistence/repositories/club.repository';
import { ClubId } from '@/domain/value-objects';
import { updateClubSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

const clubRepo = new DrizzleClubRepository();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    try {
      const { id } = await params;
      const club = await clubRepo.findById(ClubId.fromString(id));
      if (!club) {
        return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      }
      // Query default_hourly_rate from DB
      const { getDb } = await import('@/infrastructure/persistence/client');
      const db2 = getDb();
      const result = await db2
        .select({ default_hourly_rate: clubs.default_hourly_rate })
        .from(clubs)
        .where(eq(clubs.id, id))
        .limit(1);
      const defaultHourlyRate = result[0]?.default_hourly_rate || 15.0;

      return NextResponse.json({
        id: club.getId().getValue(),
        name: club.getName(),
        maxMembers: club.getMaxMembers(),
        openingHours: club.getOpeningHours(),
        status: club.getStatus(),
        memberCount: club.getMemberCount(),
        defaultHourlyRate,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error getting club:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    return withValidation(updateClubSchema, async (input) => {
      try {
        const clubId = ClubId.fromString(id);
        const existing = await clubRepo.findById(clubId);
        if (!existing) {
          return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        // Update domain fields
        if (input.name !== undefined) {
          existing.setName(input.name);
        }
        if (input.maxMembers !== undefined) {
          existing.setMaxMembers(input.maxMembers);
        }
        if (input.openingHours !== undefined) {
          existing.setOpeningHours(input.openingHours);
        }
        if (input.status !== undefined) {
          existing.setStatus(input.status);
        }

        // Save domain changes
        await clubRepo.save(existing);

        // Handle defaultHourlyRate separately (not in domain entity yet)
        if (input.defaultHourlyRate !== undefined) {
          const { getDb } = await import('@/infrastructure/persistence/client');
          const db = getDb();
          await db
            .update(clubs)
            .set({ default_hourly_rate: input.defaultHourlyRate })
            .where(eq(clubs.id, clubId.getValue()));
        }

        try {
          await AuditService.logClubUpdated(auth.user.id, id, input);
        } catch (auditError) {
          console.warn('Failed to record audit log:', auditError);
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error updating club:', error);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    })(req);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    try {
      const clubId = ClubId.fromString(id);
      const existing = await clubRepo.findById(clubId);
      if (!existing) {
        return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      }

      await clubRepo.delete(clubId);

      try {
        await AuditService.logClubDeleted(auth.user.id, id);
      } catch (auditError) {
        console.warn('Audit log failed:', auditError);
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error deleting club:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
