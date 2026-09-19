import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import type { TablesUpdate } from '@/types/supabase';
import { getUserDb, systemDb } from '@/infrastructure/db';
import {
  SeasonPlanningConfigRepository,
  type PlanningConfig,
  type Season,
} from '@/infrastructure/persistence/repositories/season-planning-config.repository';

type Patch = TablesUpdate<'season_planning_configs'>;

/** Nur diese Felder sind über die API änderbar; alles andere wird ignoriert. */
const NUMERIC = [
  'max_niveau_span_beginner_months',
  'max_niveau_span_advanced_months',
  'trainer_utilization_max_pct',
  'group_max_size',
  'group_min_size',
  'proven_group_attendance_threshold_pct',
  'slot_failure_rate_threshold_pct',
  'kids_group_max_size',
  'kids_group_min_size',
  'slot_duration_minutes',
] as const;
const BOOLEAN = [
  'prefer_historic_groups',
  'avoid_high_failure_slots',
  'treat_high_failure_as_hard',
] as const;

/**
 * Planungs-Konfiguration (ADR-005). Admin-only; RLS trennt die Vereine, der Service prüft
 * zusätzlich die Rolle im Verein der Saison. Owner haben keine Membership → systemDb.
 */
export class SeasonPlanningConfigService {
  private readonly repo: SeasonPlanningConfigRepository;
  private readonly isOwner: boolean;

  constructor(private readonly auth: AuthContext) {
    this.isOwner = auth.role === 'owner';
    this.repo = new SeasonPlanningConfigRepository(
      this.isOwner ? systemDb('Owner: Planungs-Konfiguration aller Vereine') : getUserDb(auth)
    );
  }

  private async season(seasonId: string): Promise<Season> {
    const season = await this.repo.findSeason(seasonId);
    if (!season) throw new ApiException('NOT_FOUND', 'Saison nicht gefunden');
    if (this.isOwner) return season;
    const isAdmin = this.auth.memberships.some(
      (m) => m.club_id === season.club_id && (m.role === 'admin' || m.role === 'superadmin')
    );
    if (!isAdmin) throw new ApiException('FORBIDDEN', 'Kein Zugriff auf diese Saison');
    return season;
  }

  async get(seasonId: string): Promise<PlanningConfig | null> {
    await this.season(seasonId);
    return this.repo.find(seasonId);
  }

  async save(seasonId: string, body: Record<string, unknown>): Promise<PlanningConfig> {
    const season = await this.season(seasonId);
    const patch: Record<string, unknown> = {};

    for (const f of NUMERIC) if (f in body) patch[f] = body[f];
    if ('waitlist_priority_rule' in body)
      patch.waitlist_priority_rule = body.waitlist_priority_rule;
    // Defensiv gegen "true"/"false" als String.
    for (const f of BOOLEAN) {
      if (f in body)
        patch[f] = typeof body[f] === 'boolean' ? body[f] : body[f] === 'true' || body[f] === 1;
    }
    // CHECK-Constraints der DB: backtrack_depth 0..10, unassigned_rate_threshold 0..1.
    const ranged = (field: string, max: number) => {
      if (!(field in body)) return;
      const n = Number(body[field]);
      if (!Number.isFinite(n) || n < 0 || n > max) {
        throw new ApiException(
          'VALIDATION_ERROR',
          `${field} muss eine Zahl zwischen 0 und ${max} sein`
        );
      }
      patch[field] = n;
    };
    ranged('backtrack_depth', 10);
    ranged('unassigned_rate_threshold', 1);

    if (Object.keys(patch).length === 0) {
      throw new ApiException('VALIDATION_ERROR', 'Keine aktualisierbaren Felder angegeben');
    }

    const existing = await this.repo.find(seasonId);
    if (existing) {
      const updated = await this.repo.update(existing.id, patch as Patch);
      if (!updated) throw new ApiException('FORBIDDEN', 'Konfiguration kann nicht geändert werden');
      return updated;
    }
    return this.repo.insert({ ...(patch as Patch), club_id: season.club_id, season_id: seasonId });
  }
}
