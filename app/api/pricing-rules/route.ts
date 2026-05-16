import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { DrizzlePricingRuleRepository } from '@/infrastructure/persistence/repositories/pricing-rule.repository';
import { ClubId, CourtId } from '@/domain/value-objects';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const repo = new DrizzlePricingRuleRepository();

const pricingRuleSchema = z.object({
  clubId: z.string().uuid(),
  courtId: z.string().uuid().optional().nullable(),
  ruleType: z.enum(['hourly', 'member', 'trial', 'group', 'season']),
  minBookingHours: z.number().nonnegative().default(1),
  maxBookingHours: z.number().nonnegative().default(4),
  pricePerHour: z.number().positive(),
  advanceBookingDays: z.number().int().nonnegative().default(7),
  appliesToMemberTypes: z.array(z.string()).optional().default([]),
  appliesToGroups: z.array(z.string()).optional().default([]),
  priority: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// GET /api/pricing-rules – Alle Regeln (mit clubId Filter)
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    const clubId = url.searchParams.get('clubId');

    if (!clubId) {
      return NextResponse.json({ error: 'clubId query parameter required' }, { status: 400 });
    }

    try {
      const rules = await repo.findByClubId(ClubId.fromString(clubId));
      return NextResponse.json({
        pricingRules: rules.map((r) => ({
          id: r.id,
          clubId: r.clubId.getValue(),
          courtId: r.courtId?.getValue(),
          ruleType: r.ruleType,
          minBookingHours: r.minBookingHours,
          maxBookingHours: r.maxBookingHours,
          pricePerHour: r.pricePerHour,
          advanceBookingDays: r.advanceBookingDays,
          appliesToMemberTypes: r.appliesToMemberTypes,
          appliesToGroups: r.appliesToGroups,
          priority: r.priority,
          isActive: r.isActive,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching pricing rules:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

// POST /api/pricing-rules – Neue Regel erstellen
export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const body = await req.json();
      const validation = pricingRuleSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.errors },
          { status: 400 }
        );
      }

      const data = validation.data;
      const rule = {
        id: randomUUID(),
        clubId: ClubId.fromString(data.clubId),
        courtId: data.courtId ? CourtId.fromString(data.courtId) : undefined,
        ruleType: data.ruleType,
        minBookingHours: data.minBookingHours,
        maxBookingHours: data.maxBookingHours,
        pricePerHour: data.pricePerHour,
        advanceBookingDays: data.advanceBookingDays,
        appliesToMemberTypes: data.appliesToMemberTypes,
        appliesToGroups: data.appliesToGroups,
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
            minBookingHours: rule.minBookingHours,
            maxBookingHours: rule.maxBookingHours,
            pricePerHour: rule.pricePerHour,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating pricing rule:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

// GET /api/pricing-rules/match – Beste Preisregel für gegebenes Szenario finden
export async function GET_MATCH(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    const clubId = url.searchParams.get('clubId');
    const courtId = url.searchParams.get('courtId');
    const memberType = url.searchParams.get('memberType');
    const bookingHours = url.searchParams.get('bookingHours');
    const advanceDays = url.searchParams.get('advanceDays');

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    try {
      const rule = await repo.findBestMatch(
        ClubId.fromString(clubId),
        courtId ? CourtId.fromString(courtId) : undefined,
        memberType || undefined,
        undefined,
        bookingHours ? Number(bookingHours) : undefined,
        advanceDays ? Number(advanceDays) : undefined
      );

      if (!rule) {
        // Fallback: return default hourly rate from club (could be fetched here)
        return NextResponse.json({ pricePerHour: 15.0, source: 'default' });
      }

      return NextResponse.json({
        pricePerHour: rule.pricePerHour,
        ruleId: rule.id,
        source: 'pricing_rule',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error matching pricing rule:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
