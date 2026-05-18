// Season Planning Config Service
// Manages configurable parameters for the KI Saisonplanung

import { getDb } from '@/src/infrastructure/persistence/client';
import { seasonPlanningConfigs } from '@/src/infrastructure/persistence/season-planning-schema';
import { and, eq } from 'drizzle-orm';
import type { SeasonPlanningConfig } from '@/lib/season-planning/types';

export class PlanningConfigService {
  /**
   * Get or create default config for a season/club
   */
  static async getOrCreateConfig(
    clubId: string,
    seasonId?: string
  ): Promise<SeasonPlanningConfig> {
    const conditions = [eq(seasonPlanningConfigs.club_id, clubId)];
    if (seasonId) {
      conditions.push(eq(seasonPlanningConfigs.season_id, seasonId));
    }

    const [existing] = await getDb()
      .select()
      .from(seasonPlanningConfigs)
      .where(and(...conditions));

    if (existing) return existing as unknown as SeasonPlanningConfig;

    // Create with defaults
    const [created] = await getDb()
      .insert(seasonPlanningConfigs)
      .values({
        club_id: clubId,
        season_id: seasonId || null,
        max_niveau_span_beginner_months: 4,
        max_niveau_span_advanced_months: 8,
        trainer_utilization_max_pct: 80,
        slot_failure_rate_threshold_pct: 30,
        waitlist_priority_rule: 'registration_time',
        group_min_size: 3,
        group_max_size: 12,
        proven_group_attendance_threshold_pct: 80,
        ai_clustering_enabled: true,
        prefer_historic_groups: true,
        avoid_high_failure_slots: true,
      })
      .returning();

    return created as unknown as SeasonPlanningConfig;
  }

  /**
   * Update config
   */
  static async updateConfig(
    clubId: string,
    seasonId: string | null,
    updates: Partial<{
      maxNiveauSpanBeginner: number;
      maxNiveauSpanAdvanced: number;
      trainerUtilizationMaxPct: number;
      slotFailureThresholdPct: number;
      waitlistPriorityRule: string;
      groupMinSize: number;
      groupMaxSize: number;
      provenGroupThresholdPct: number;
      aiClusteringEnabled: boolean;
      preferHistoricGroups: boolean;
      avoidHighFailureSlots: boolean;
    }>
  ): Promise<SeasonPlanningConfig> {
    const conditions = [eq(seasonPlanningConfigs.club_id, clubId)];
    if (seasonId) {
      conditions.push(eq(seasonPlanningConfigs.season_id, seasonId));
    }

    const [existing] = await getDb()
      .select()
      .from(seasonPlanningConfigs)
      .where(and(...conditions));

    const setValues: Record<string, unknown> = {};
    if (updates.maxNiveauSpanBeginner !== undefined)
      setValues.max_niveau_span_beginner_months = updates.maxNiveauSpanBeginner;
    if (updates.maxNiveauSpanAdvanced !== undefined)
      setValues.max_niveau_span_advanced_months = updates.maxNiveauSpanAdvanced;
    if (updates.trainerUtilizationMaxPct !== undefined)
      setValues.trainer_utilization_max_pct = updates.trainerUtilizationMaxPct;
    if (updates.slotFailureThresholdPct !== undefined)
      setValues.slot_failure_rate_threshold_pct = updates.slotFailureThresholdPct;
    if (updates.waitlistPriorityRule !== undefined)
      setValues.waitlist_priority_rule = updates.waitlistPriorityRule;
    if (updates.groupMinSize !== undefined)
      setValues.group_min_size = updates.groupMinSize;
    if (updates.groupMaxSize !== undefined)
      setValues.group_max_size = updates.groupMaxSize;
    if (updates.provenGroupThresholdPct !== undefined)
      setValues.proven_group_attendance_threshold_pct = updates.provenGroupThresholdPct;
    if (updates.aiClusteringEnabled !== undefined)
      setValues.ai_clustering_enabled = updates.aiClusteringEnabled;
    if (updates.preferHistoricGroups !== undefined)
      setValues.prefer_historic_groups = updates.preferHistoricGroups;
    if (updates.avoidHighFailureSlots !== undefined)
      setValues.avoid_high_failure_slots = updates.avoidHighFailureSlots;

    if (existing) {
      const [updated] = await getDb()
        .update(seasonPlanningConfigs)
        .set(setValues)
        .where(eq(seasonPlanningConfigs.id, existing.id))
        .returning();
      return updated as unknown as SeasonPlanningConfig;
    }

    // Create if not exists
    const [created] = await getDb()
      .insert(seasonPlanningConfigs)
      .values({
        club_id: clubId,
        season_id: seasonId || null,
        max_niveau_span_beginner_months: 4,
        max_niveau_span_advanced_months: 8,
        trainer_utilization_max_pct: 80,
        slot_failure_rate_threshold_pct: 30,
        waitlist_priority_rule: 'registration_time',
        group_min_size: 3,
        group_max_size: 12,
        proven_group_attendance_threshold_pct: 80,
        ai_clustering_enabled: true,
        prefer_historic_groups: true,
        avoid_high_failure_slots: true,
        ...setValues,
      })
      .returning();

    return created as unknown as SeasonPlanningConfig;
  }
}
