import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { DrizzleClubRepository } from '@/infrastructure/persistence/repositories/club.repository';
import { ClubId } from '@/domain/value-objects';
import { updateClubSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { AuditServiceImpl } from '@/infrastructure/audit/audit.service';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { clubs } from '@/infrastructure/persistence/schema';
import { db } from '@/infrastructure/persistence/db';
import { eq } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clubs:[id]');

const clubRepo = new DrizzleClubRepository();
const auditService = new AuditServiceImpl();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const { id } = await params;
      const club = await clubRepo.findById(ClubId.fromString(id));
      if (!club) {
        return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      }
      // Query default_hourly_rate from DB
      const result = await db
        .select({
          default_hourly_rate: clubs.default_hourly_rate,
          bundesland: clubs.bundesland,
          billing_unit_minutes: clubs.billing_unit_minutes,
          tax_rate: clubs.tax_rate,
          default_payment_method: clubs.default_payment_method,
          invoice_number_prefix: clubs.invoice_number_prefix,
        })
        .from(clubs)
        .where(eq(clubs.id, id))
        .limit(1);
      const row = result[0];
      const defaultHourlyRate = row?.default_hourly_rate ? Number(row.default_hourly_rate) : 15.0;

      return NextResponse.json({
        id: club.getId().getValue(),
        name: club.getName(),
        maxMembers: club.getMaxMembers(),
        openingHours: club.getOpeningHours(),
        status: club.getStatus(),
        memberCount: club.getMemberCount(),
        defaultHourlyRate,
        bundesland: row?.bundesland ?? null,
        billing_unit_minutes: row?.billing_unit_minutes ?? 60,
        tax_rate: row?.tax_rate ?? 0,
        default_payment_method: row?.default_payment_method ?? 'transfer',
        invoice_number_prefix: row?.invoice_number_prefix ?? '',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error getting club:', error);
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

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;
    if (!verifyClubAccess(auth, id)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

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
          existing.setOpeningHours(
            input.openingHours as Parameters<typeof existing.setOpeningHours>[0]
          );
        }
        if (input.status !== undefined) {
          existing.setStatus(input.status);
        }

        // Save domain changes
        await clubRepo.save(existing);

        const hasExtraUpdates =
          input.defaultHourlyRate !== undefined ||
          input.bundesland !== undefined ||
          input.billing_unit_minutes !== undefined ||
          input.tax_rate !== undefined ||
          input.default_payment_method !== undefined ||
          input.invoice_number_prefix !== undefined;

        if (hasExtraUpdates) {
          await db
            .update(clubs)
            .set({
              ...(input.defaultHourlyRate !== undefined && {
                default_hourly_rate: input.defaultHourlyRate.toFixed(2),
              }),
              ...(input.bundesland !== undefined && { bundesland: input.bundesland }),
              ...(input.billing_unit_minutes !== undefined && {
                billing_unit_minutes: input.billing_unit_minutes,
              }),
              ...(input.tax_rate !== undefined && { tax_rate: input.tax_rate }),
              ...(input.default_payment_method !== undefined && {
                default_payment_method: input.default_payment_method,
              }),
              ...(input.invoice_number_prefix !== undefined && {
                invoice_number_prefix: input.invoice_number_prefix,
              }),
            })
            .where(eq(clubs.id, clubId.getValue()));
        }

        try {
          await auditService.log({
            userId: auth.user.id,
            action: 'update',
            entityType: 'club',
            entityId: id,
            details: input as unknown as Record<string, unknown>,
          });
        } catch (auditError) {
          log.warn('Failed to record audit log:', auditError);
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        log.error('Error updating club:', error);
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

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;
    if (!verifyClubAccess(auth, id)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    try {
      const clubId = ClubId.fromString(id);
      const existing = await clubRepo.findById(clubId);
      if (!existing) {
        return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      }

      await clubRepo.delete(clubId);

      try {
        await auditService.log({
          userId: auth.user.id,
          action: 'delete',
          entityType: 'club',
          entityId: id,
          details: {},
        });
      } catch (auditError) {
        log.warn('Audit log failed:', auditError);
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error deleting club:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
