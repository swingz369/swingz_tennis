import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { DrizzlePricingRuleRepository } from '@/infrastructure/persistence/repositories/pricing-rule.repository';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pricing-rules:[id]');

const repo = new DrizzlePricingRuleRepository();

const updateSchema = z.object({
  ruleType: z.enum(['hourly', 'member', 'trial', 'group', 'season']).optional(),
  name: z.string().max(200).optional().nullable(),
  description: z.string().optional().nullable(),
  minBookingHours: z.number().nonnegative().optional(),
  maxBookingHours: z.number().nonnegative().optional(),
  pricePerHour: z.number().positive().optional(),
  advanceBookingDays: z.number().int().nonnegative().optional(),
  appliesToMemberTypes: z.array(z.string()).optional(),
  appliesToGroups: z.array(z.string()).optional(),
  timeRanges: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
        priceMultiplier: z.number(),
      })
    )
    .optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  seasonId: z.string().uuid().optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// PATCH /api/pricing-rules/[id] – Update rule
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    try {
      const existing = await repo.findById(id);
      if (!existing) {
        return NextResponse.json({ error: 'Preisregel nicht gefunden' }, { status: 404 });
      }

      const body = await req.json();
      const validation = updateSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validierung fehlgeschlagen', details: validation.error.errors },
          { status: 400 }
        );
      }

      const data = validation.data;

      const updated = {
        ...existing,
        ruleType: data.ruleType ?? existing.ruleType,
        name: data.name !== undefined ? (data.name ?? undefined) : existing.name,
        description:
          data.description !== undefined ? (data.description ?? undefined) : existing.description,
        minBookingHours: data.minBookingHours ?? existing.minBookingHours,
        maxBookingHours: data.maxBookingHours ?? existing.maxBookingHours,
        pricePerHour: data.pricePerHour ?? existing.pricePerHour,
        advanceBookingDays: data.advanceBookingDays ?? existing.advanceBookingDays,
        appliesToMemberTypes: data.appliesToMemberTypes ?? existing.appliesToMemberTypes,
        appliesToGroups: data.appliesToGroups ?? existing.appliesToGroups,
        timeRanges: data.timeRanges ?? existing.timeRanges,
        daysOfWeek:
          data.daysOfWeek !== undefined ? (data.daysOfWeek ?? undefined) : existing.daysOfWeek,
        seasonId: data.seasonId !== undefined ? (data.seasonId ?? undefined) : existing.seasonId,
        validFrom:
          data.validFrom !== undefined
            ? data.validFrom
              ? new Date(data.validFrom)
              : undefined
            : existing.validFrom,
        validUntil:
          data.validUntil !== undefined
            ? data.validUntil
              ? new Date(data.validUntil)
              : undefined
            : existing.validUntil,
        priority: data.priority ?? existing.priority,
        isActive: data.isActive ?? existing.isActive,
        updatedAt: new Date(),
      };

      await repo.save(updated);

      return NextResponse.json({
        success: true,
        pricingRule: {
          id: updated.id,
          name: updated.name,
          pricePerHour: updated.pricePerHour,
          timeRanges: updated.timeRanges,
          daysOfWeek: updated.daysOfWeek,
          seasonId: updated.seasonId,
          isActive: updated.isActive,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error updating pricing rule:', message);
      return internalErrorResponse();
    }
  });
}

// DELETE /api/pricing-rules/[id] – Delete rule
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    try {
      const existing = await repo.findById(id);
      if (!existing) {
        return NextResponse.json({ error: 'Preisregel nicht gefunden' }, { status: 404 });
      }

      await repo.delete(id);
      return NextResponse.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error deleting pricing rule:', message);
      return internalErrorResponse();
    }
  });
}
