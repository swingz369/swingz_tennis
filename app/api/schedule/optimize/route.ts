import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { aiScheduleServiceV2 } from '@/lib/ai/schedule-generator-v2';
import type { ScheduleGenerationInput } from '@/lib/ai/schedule-generator-v2';
import { db } from '@/src/infrastructure/persistence/db';
import { seasons, userTrainingPreferences, courts } from '@/src/infrastructure/persistence/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { WeeklyAvailability } from '@/lib/types/season-planning';

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
      const { clubId, seasonId } = body as { clubId?: string; seasonId?: string };

      if (!seasonId) {
        return NextResponse.json({ error: 'seasonId required' }, { status: 400 });
      }

      // ── Fetch season data ──────────────────────────────────
      const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));

      if (!season) {
        return NextResponse.json({ error: 'Season not found' }, { status: 404 });
      }

      const effectiveClubId = clubId || season.club_id;

      // ── Fetch all submitted preferences ────────────────────
      const allPreferences = await db
        .select({
          pref: userTrainingPreferences,
          user_name: sql<string>`COALESCE(users.full_name, users.email)`,
        })
        .from(userTrainingPreferences)
        .leftJoin(sql`users`, sql`users.id = ${userTrainingPreferences.user_id}`)
        .where(
          and(
            eq(userTrainingPreferences.season_id, seasonId),
            eq(userTrainingPreferences.is_submitted, true)
          )
        );

      // ── Fetch available courts ─────────────────────────────
      const availableCourts = await db
        .select()
        .from(courts)
        .where(and(eq(courts.club_id, effectiveClubId), eq(courts.is_active, true)));

      // ── Build planning data for AI ─────────────────────────
      const flattenAvailability = (avail: WeeklyAvailability): string[] => {
        if (!avail) return [];
        const dayNames = [
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday',
        ] as const;
        return dayNames.filter((day) => {
          const slots = avail[day];
          return slots && Array.isArray(slots) && slots.length > 0;
        });
      };

      const planningData = {
        members: allPreferences
          .filter(({ pref }) => pref.user_role !== 'trainer')
          .map(({ pref, user_name }) => ({
            id: pref.user_id,
            name: user_name || 'Unknown',
            skillLevel: pref.preferred_level || 'intermediate',
            availability: flattenAvailability(pref.weekly_availability as WeeklyAvailability),
          })),
        trainers: allPreferences
          .filter(({ pref }) => pref.user_role === 'trainer')
          .map(({ pref, user_name }) => ({
            id: pref.user_id,
            name: user_name || 'Unknown',
            specialization: pref.can_teach_groups?.[0] || 'general',
            availability: flattenAvailability(pref.weekly_availability as WeeklyAvailability),
          })),
        courts: availableCourts.map((c) => ({
          id: c.id,
          name: c.name || `Court ${c.id.slice(0, 8)}`,
          capacity: 12,
        })),
      };

      if (planningData.trainers.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No trainers available for this season' },
          { status: 400 }
        );
      }

      // ── Build AI input ─────────────────────────────────────
      const aiInput: ScheduleGenerationInput = {
        clubId: effectiveClubId,
        startDate: season.start_date || new Date(),
        endDate: season.end_date || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        constraints: {
          maxParticipantsPerSession: 12,
          preferredDays: undefined,
          skillLevels: undefined,
          avoidTrainerOverload: true,
          balanceGroupSizes: true,
        },
      };

      // ── Call AI scheduler ──────────────────────────────────
      const aiResult = await aiScheduleServiceV2.generateSchedule(aiInput, planningData);

      if (!aiResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'AI scheduling failed',
            reasoning: aiResult.reasoning,
            modelUsed: aiResult.modelUsed,
            warnings: aiResult.warnings || [],
          },
          { status: 422 }
        );
      }

      // ── Format response ────────────────────────────────────
      const dayOfWeekMap: Record<number, number> = {
        0: 6, // Sunday → 6
        1: 0, // Monday → 0
        2: 1,
        3: 2,
        4: 3,
        5: 4,
        6: 5,
      };

      const pad = (n: number) => String(n).padStart(2, '0');

      const sessions = aiResult.sessions.map((s, i) => ({
        id: `${s.trainerId.slice(0, 8)}-${i}`,
        dayOfWeek: dayOfWeekMap[s.startTime.getDay()] || 0,
        startTime: `${pad(s.startTime.getHours())}:${pad(s.startTime.getMinutes())}`,
        endTime: `${pad(s.endTime.getHours())}:${pad(s.endTime.getMinutes())}`,
        trainerId: s.trainerId,
        courtId: s.courtId,
        participants: s.participants,
        skillLevel: s.skillLevel,
        confidence: s.confidence,
      }));

      const totalConfidence =
        sessions.length > 0
          ? sessions.reduce((sum, s) => sum + s.confidence, 0) / sessions.length
          : 0;

      return NextResponse.json({
        success: true,
        source: 'ai',
        modelUsed: aiResult.modelUsed,
        sessions,
        sessionCount: sessions.length,
        participantCount: aiResult.sessions.reduce((sum, s) => sum + s.participants.length, 0),
        confidence: Math.round(totalConfidence * 100) / 100,
        reasoning: aiResult.reasoning,
        warnings: aiResult.warnings || [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scheduling failed';
      console.error('[Optimize API] Error:', message);
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  });
}
