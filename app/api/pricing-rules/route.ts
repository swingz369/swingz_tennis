import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { DrizzlePricingRuleRepository } from '@/infrastructure/persistence/repositories/pricing-rule.repository';
import { ClubId, CourtId } from '@/domain/value-objects';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pricing-rules');

const repo = new DrizzlePricingRuleRepository();

const timeRangeSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  priceMultiplier: z.number().min(0).max(10),
});

const pricingRuleSchema = z.object({
  clubId: z.string().uuid(),
  courtId: z.string().uuid().optional().nullable(),
  ruleType: z.enum(['hourly', 'member', 'trial', 'group', 'season']),
  name: z.string().max(200).optional(),
  description: z.string().optional(),
  minBookingHours: z.number().nonnegative().default(1),
  maxBookingHours: z.number().nonnegative().default(4),
  pricePerHour: z.number().positive(),
  advanceBookingDays: z.number().int().nonnegative().default(7),
  appliesToMemberTypes: z.array(z.string()).optional().default([]),
  appliesToGroups: z.array(z.string()).optional().default([]),
  timeRanges: z.array(timeRangeSchema).optional().default([]),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  seasonId: z.string().uuid().optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  priority: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// GET /api/pricing-rules – Alle Regeln (mit clubId Filter)
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    const clubId = url.searchParams.get('clubId');

    if (!clubId) {
      return NextResponse.json({ error: 'Query-Parameter clubId erforderlich' }, { status: 400 });
    }
    if (!verifyClubAccess(auth, clubId)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    try {
      const rules = await repo.findByClubId(ClubId.fromString(clubId));
      return NextResponse.json({
        pricingRules: rules.map((r) => ({
          id: r.id,
          clubId: r.clubId.getValue(),
          courtId: r.courtId?.getValue(),
          ruleType: r.ruleType,
          name: r.name,
          description: r.description,
          minBookingHours: r.minBookingHours,
          maxBookingHours: r.maxBookingHours,
          pricePerHour: r.pricePerHour,
          advanceBookingDays: r.advanceBookingDays,
          appliesToMemberTypes: r.appliesToMemberTypes,
          appliesToGroups: r.appliesToGroups,
          timeRanges: r.timeRanges,
          daysOfWeek: r.daysOfWeek,
          seasonId: r.seasonId,
          validFrom: r.validFrom?.toISOString(),
          validUntil: r.validUntil?.toISOString(),
          priority: r.priority,
          isActive: r.isActive,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error fetching pricing rules:', message);
      return internalErrorResponse();
    }
  });
}

// POST /api/pricing-rules – Neue Regel erstellen
export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const body = await req.json();
      const validation = pricingRuleSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validierung fehlgeschlagen', details: validation.error.errors },
          { status: 400 }
        );
      }

      const data = validation.data;
      if (!verifyClubAccess(auth, data.clubId)) {
        return forbiddenResponse('Kein Zugriff auf diesen Verein');
      }
      const rule = {
        id: randomUUID(),
        clubId: ClubId.fromString(data.clubId),
        courtId: data.courtId ? CourtId.fromString(data.courtId) : undefined,
        ruleType: data.ruleType,
        name: data.name,
        description: data.description,
        minBookingHours: data.minBookingHours,
        maxBookingHours: data.maxBookingHours,
        pricePerHour: data.pricePerHour,
        advanceBookingDays: data.advanceBookingDays,
        appliesToMemberTypes: data.appliesToMemberTypes,
        appliesToGroups: data.appliesToGroups,
        timeRanges: data.timeRanges,
        daysOfWeek: data.daysOfWeek,
        seasonId: data.seasonId ?? undefined,
        validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        priority: data.priority,
        isActive: data.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repo.save(rule);

      return NextResponse.json(
        {
          success: true,
          pricingRule: {
            id: rule.id,
            clubId: rule.clubId.getValue(),
            courtId: rule.courtId?.getValue(),
            ruleType: rule.ruleType,
            name: rule.name,
            pricePerHour: rule.pricePerHour,
            timeRanges: rule.timeRanges,
            daysOfWeek: rule.daysOfWeek,
            seasonId: rule.seasonId,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error creating pricing rule:', message);
      return internalErrorResponse();
    }
  });
}

// PUT /api/pricing-rules/[id] – via dynamic route (see [id]/route.ts)
// GET /api/pricing-rules/calculate – via separate file (see calculate/route.ts)
