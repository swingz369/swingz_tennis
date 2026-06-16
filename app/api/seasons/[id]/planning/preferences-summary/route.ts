// GET /api/seasons/[id]/planning/preferences-summary
// Schritt 2: Summary of member preferences with slot failure warnings

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { db } from '@/src/infrastructure/persistence/db';
import { seasons, users, userTrainingPreferences } from '@/src/infrastructure/persistence/schema';
import { seasonStatistics } from '@/src/infrastructure/persistence/season-planning-schema';
import { eq, and } from 'drizzle-orm';
import type { PreferencesSummary } from '@/lib/season-planning/types';
import type { SkillLevel } from '@/lib/types/season-planning';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:preferences-summary');

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 30, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
      if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');
      if (!isAdmin && !isSuperadmin) return forbiddenResponse('Nur Admins');

      // Get all preferences
      const prefs = await db
        .select({
          pref: userTrainingPreferences,
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

      const totalMembers = prefs.length;
      const submittedPrefs = prefs.filter((p) => p.pref.is_submitted);
      const responseRate = totalMembers > 0 ? (submittedPrefs.length / totalMembers) * 100 : 0;

      // Load slot failure rates
      const stats = await db
        .select()
        .from(seasonStatistics)
        .where(eq(seasonStatistics.club_id, season.club_id));

      const slotFailureWarnings: PreferencesSummary['slotFailureWarnings'] = [];
      for (const stat of stats) {
        const rates = stat.slot_failure_rates as Record<
          string,
          { day_of_week: number; start_time: string; failure_rate: number }
        > | null;
        if (rates) {
          for (const [, val] of Object.entries(rates)) {
            if (val.failure_rate >= 0.3) {
              slotFailureWarnings.push({
                dayOfWeek: val.day_of_week,
                startTime: val.start_time,
                failureRate: val.failure_rate,
                warning: `Tag ${val.day_of_week} um ${val.start_time} hat ${(val.failure_rate * 100).toFixed(0)}% Ausfallrate – Nutzung nicht empfohlen`,
              });
            }
          }
        }
      }

      // Detect incompatible wish partners
      const incompatibleWishPartners: PreferencesSummary['incompatibleWishPartners'] = [];
      for (const p of submittedPrefs) {
        const wishIds = (p.pref.wish_partner_ids as string[]) || [];
        const memberLevel = (p.skill_level || p.pref.preferred_level || 'beginner') as SkillLevel;
        const memberExp = p.experience_months || 0;

        for (const wid of wishIds) {
          const partner = submittedPrefs.find((sp) => sp.pref.user_id === wid);
          if (!partner) continue;

          const partnerLevel = (partner.skill_level ||
            partner.pref.preferred_level ||
            'beginner') as SkillLevel;
          const partnerExp = partner.experience_months || 0;

          // Check level gap
          const levelOrder = { beginner: 0, intermediate: 1, advanced: 2, professional: 3 };
          const levelGap = Math.abs(
            (levelOrder[memberLevel] || 0) - (levelOrder[partnerLevel] || 0)
          );

          let reason = '';
          if (levelGap >= 2) {
            reason = `Niveau-Unterschied (${memberLevel} vs ${partnerLevel})`;
          } else if (Math.abs(memberExp - partnerExp) > 8) {
            reason = `Erfahrungs-Unterschied (${memberExp} vs ${partnerExp} Monate)`;
          }

          if (reason) {
            incompatibleWishPartners.push({
              memberA: {
                id: p.pref.user_id,
                name: p.user_name || p.user_email || 'Unbekannt',
                level: memberLevel,
              },
              memberB: {
                id: partner.pref.user_id,
                name: partner.user_name || partner.user_email || 'Unbekannt',
                level: partnerLevel,
              },
              reason,
            });
          }
        }
      }

      const summary: PreferencesSummary = {
        totalMembers,
        submittedCount: submittedPrefs.length,
        responseRate: Math.round(responseRate * 100) / 100,
        slotFailureWarnings,
        incompatibleWishPartners,
      };

      return NextResponse.json({ success: true, summary });
    } catch (error) {
      log.error('GET preferences-summary error:', error);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  });
}
