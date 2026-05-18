// POST /api/seasons/[id]/planning/members/select
// Schritt 1: Select members for the season, returns promotions + waitlist carryovers

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { getDb } from '@/src/infrastructure/persistence/client';
import { seasons, users, userTrainingPreferences } from '@/src/infrastructure/persistence/schema';
import { trainerFeedback, seasonWaitlists } from '@/src/infrastructure/persistence/season-planning-schema';
import { eq, and, desc } from 'drizzle-orm';

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 30, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const [season] = await getDb().select().from(seasons).where(eq(seasons.id, seasonId));
      if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');
      if (!isAdmin && !isSuperadmin) return forbiddenResponse('Nur Admins');

      // Get all members from user_club_memberships for this club
      const db = getDb();
      const allPrefs = await db
        .select({
          id: userTrainingPreferences.id,
          user_id: userTrainingPreferences.user_id,
          is_submitted: userTrainingPreferences.is_submitted,
          user_name: users.full_name,
          user_email: users.email,
          skill_level: users.skill_level,
          experience_months: users.experience_months,
        })
        .from(userTrainingPreferences)
        .innerJoin(users, eq(userTrainingPreferences.user_id, users.id))
        .where(
          and(
            eq(userTrainingPreferences.season_id, seasonId),
            eq(userTrainingPreferences.user_role, 'member')
          )
        );

      // Get trainer feedback from previous season
      const previousSeasons = await db
        .select()
        .from(seasons)
        .where(and(eq(seasons.club_id, season.club_id), eq(seasons.season_type, season.season_type)))
        .orderBy(desc(seasons.year));

      const prevSeason = previousSeasons.find((s) => s.year < season.year);

      let promotedMembers: any[] = [];
      let waitlistCarryovers: any[] = [];

      if (prevSeason) {
        const feedback = await db
          .select({
            member_id: trainerFeedback.member_id,
            ready_for_next_level: trainerFeedback.ready_for_next_level,
            recommended_level: trainerFeedback.recommended_level,
            trainer_name: trainerFeedback.trainer_id,
          })
          .from(trainerFeedback)
          .where(eq(trainerFeedback.season_id, prevSeason.id));

        promotedMembers = feedback
          .filter((f) => f.ready_for_next_level === 'yes')
          .map((f) => {
            const pref = allPrefs.find((p) => p.user_id === f.member_id);
            return {
              memberId: f.member_id,
              memberName: pref?.user_name || pref?.user_email || 'Unbekannt',
              recommendedLevel: f.recommended_level,
              trainerName: f.trainer_name,
            };
          });

        // Waitlist carryovers
        const prevWaitlist = await db
          .select()
          .from(seasonWaitlists)
          .where(and(eq(seasonWaitlists.season_id, prevSeason.id), eq(seasonWaitlists.status, 'waiting')));

        waitlistCarryovers = prevWaitlist
          .filter((w) => !promotedMembers.some((p) => p.memberId === w.member_id))
          .map((w) => {
            const pref = allPrefs.find((p) => p.user_id === w.member_id);
            return {
              memberId: w.member_id,
              memberName: pref?.user_name || pref?.user_email || 'Unbekannt',
              previousSeason: prevSeason.name,
            };
          });
      }

      const members = allPrefs.map((p) => ({
        id: p.user_id,
        name: p.user_name || p.user_email || 'Unbekannt',
        email: p.user_email || '',
        skillLevel: p.skill_level || 'beginner',
        experienceMonths: p.experience_months || 0,
        isSubmitted: p.is_submitted,
        isPromoted: promotedMembers.some((pm) => pm.memberId === p.user_id),
        isWaitlistCarryover: waitlistCarryovers.some((wc) => wc.memberId === p.user_id),
      }));

      return NextResponse.json({
        success: true,
        members,
        promotedMembers,
        waitlistCarryovers,
        totalCount: members.length,
        submittedCount: members.filter((m) => m.isSubmitted).length,
      });
    } catch (error) {
      console.error('GET /api/seasons/[id]/planning/members error:', error);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  });
}
