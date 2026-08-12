import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { authorizeSeasonAccess } from '@/lib/season-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { getClubFeatures, featureDisabledResponse } from '@/lib/require-feature';
import { db } from '@/src/infrastructure/persistence/db';
import { seasons } from '@/src/infrastructure/persistence/schema';
import { eq } from 'drizzle-orm';
import { AutoPlanningService } from '@/lib/services/auto-planning.service';
import type { AutoPlanRequest } from '@/lib/types/season-planning';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:auto-plan');

interface RouteContext {
  params: Promise<{
    id: string; // season_id
  }>;
}

/**
 * POST /api/seasons/[id]/auto-plan
 * Trigger auto-planning algorithm for a season
 *
 * Body: AutoPlanRequest
 * - config?: Partial<AutoPlanConfig> - Override default config
 * - dry_run?: boolean - Preview only, don't save
 * - use_ai?: boolean - Use AI-powered scheduling (default: false, uses deterministic)
 *
 * Returns: AutoPlanResponse with generated entries and metrics
 */
export async function POST(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    // Higher rate limit for expensive operation
    const rateLimitError = await checkRateLimitOrFail(request, {
      max: 5,
      windowMs: 3600000, // 5 requests per hour
    });
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId } = await context.params;

        // Zentrale Prüfung statt inline dupliziertem Rollen- und Clubcheck,
        // siehe lib/season-auth.ts.
        const access = await authorizeSeasonAccess(auth, seasonId, {
          allowedRoles: ['admin', 'superadmin'],
        });
        if (!access.ok) return access.response;
        const { season } = access;
        const isSuperadmin =
          access.effectiveRole === 'superadmin' || access.effectiveRole === 'owner';

        const clubId = season.club_id;

        // Check if auto-planning is enabled
        if (!season.auto_plan_enabled) {
          return NextResponse.json(
            { error: 'Auto-planning is disabled for this season' },
            { status: 400 }
          );
        }

        // Check season status
        if (
          !['draft', 'collecting_preferences', 'manual_review'].includes(season.planning_status)
        ) {
          return NextResponse.json(
            {
              error:
                'Auto-planning can only run on draft, collecting_preferences, or manual_review seasons',
              current_status: season.planning_status,
            },
            { status: 400 }
          );
        }

        const body: AutoPlanRequest = await request.json();

        // Merge configs
        const finalConfig = {
          ...((season.auto_plan_config as any) || {}),
          ...(body.config || {}),
        };

        const dryRun = body.dry_run || false;
        const useAI = body.use_ai === true || finalConfig.use_ai === true;

        // Server-side Premium-Gate: der Client-Toggle allein reicht nicht, ein
        // Admin könnte use_ai per curl direkt anfragen (analog ai-analysis/route.ts).
        if (useAI && !isSuperadmin) {
          const features = await getClubFeatures(auth.supabase, clubId);
          if (!features.ai_analysis) {
            return featureDisabledResponse('ai_analysis');
          }
        }

        // Update season status
        if (!dryRun) {
          await db
            .update(seasons)
            .set({ planning_status: 'auto_planning' })
            .where(eq(seasons.id, seasonId));
        }

        // Run auto-planning algorithm (AI or deterministic)
        log.info('Starting auto-planning', { seasonId, dryRun, useAI });
        const startTime = Date.now();

        let result;
        let aiEnhanced = false;
        let modelUsed = 'none';

        try {
          if (useAI) {
            const aiResult = await AutoPlanningService.generatePlanAI(
              seasonId,
              finalConfig,
              dryRun
            );
            result = aiResult;
            aiEnhanced = aiResult.aiEnhanced;
            modelUsed = aiResult.modelUsed;
          } else {
            result = await AutoPlanningService.generatePlan(seasonId, finalConfig, dryRun);
          }
        } catch (error) {
          // Revert status on failure
          if (!dryRun) {
            await db
              .update(seasons)
              .set({ planning_status: 'manual_review' })
              .where(eq(seasons.id, seasonId));
          }
          throw error;
        }

        const endTime = Date.now();
        log.info('Auto-planning completed', {
          durationMs: endTime - startTime,
          aiEnhanced,
          modelUsed,
        });

        // Build warnings
        const warnings: string[] = [];

        if (result.conflicts.length > 0) {
          warnings.push(`${result.conflicts.length} conflicts detected`);
        }

        if (result.metrics.trainer_utilization < 50) {
          warnings.push('Low trainer utilization (less than 50%)');
        }

        if (result.metrics.preferences_matched < result.entries.length * 0.5) {
          warnings.push('Less than 50% of preferences could be matched');
        }

        if (aiEnhanced) {
          warnings.push(`AI-enhanced planning (${modelUsed})`);
        }

        const response = {
          success: true,
          season_id: seasonId,
          metrics: result.metrics,
          entries_created: result.entries.length,
          conflicts_detected: result.conflicts.length,
          ai_enhanced: aiEnhanced,
          model_used: modelUsed,
          warnings,
          ...(dryRun && {
            plan_entries: result.entries.map((entry) => ({
              ...entry,
              trainer_name: 'Trainer',
              court_name: 'Court',
              group_name: 'Group',
              participant_count: entry.expected_participants.length,
              id: '',
              club_id: clubId,
              season_id: seasonId,
              starts_from_week: 1,
              ends_at_week: null,
              entry_type: 'trial',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              optimization_score: 0,
              conflict_score: entry.conflict_score || 0,
            })) as any,
          }),
          ...(!dryRun && {
            plan_entries: result.entries.map((entry) => ({
              ...entry,
              trainer_name: 'Trainer',
              court_name: 'Court',
              group_name: 'Group',
              participant_count: entry.expected_participants.length,
              id: '',
              club_id: clubId,
              season_id: seasonId,
              starts_from_week: 1,
              ends_at_week: null,
              entry_type: 'trial',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              optimization_score: 0,
              conflict_score: entry.conflict_score || 0,
            })) as any,
          }),
        } as any;

        return NextResponse.json(response, { status: 200 });
      } catch (error) {
        const { id: _id } = await context.params;
        log.error(
          `POST auto-plan error (season ${_id})`,
          error instanceof Error ? error : undefined
        );
        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : 'Auto-planning failed',
            details: error instanceof Error ? error.stack : undefined,
          },
          { status: 500 }
        );
      }
    });
  });
}

/**
 * GET /api/seasons/[id]/auto-plan/status
 * Get current auto-planning status
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;

      // Vorher stand hier:
      //   if (!isAdmin && !isSuperadmin && season.club_id !== auth.clubId)
      // Die Bedingung war durch die UND-Verknüpfung faktisch wirkungslos:
      // sobald der Aufrufer Admin war, wurde sie falsch und der Clubvergleich
      // nie erreicht — jeder Admin kam damit an jede Saison.
      const access = await authorizeSeasonAccess(auth, seasonId, {
        allowedRoles: ['admin', 'superadmin'],
      });
      if (!access.ok) return access.response;
      const { season } = access;

      return NextResponse.json({
        success: true,
        status: {
          planning_status: season.planning_status,
          auto_plan_enabled: season.auto_plan_enabled,
          last_planned_at: season.last_planned_at,
          can_run_auto_plan:
            season.auto_plan_enabled &&
            ['draft', 'collecting_preferences', 'manual_review'].includes(season.planning_status),
        },
      });
    } catch (error) {
      log.error('GET auto-plan/status error', error instanceof Error ? error : undefined);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch status' },
        { status: 500 }
      );
    }
  });
}
