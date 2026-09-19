import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import type { CreatePlanEntryRequest } from '@/lib/types/season-planning';
import { getUserDb, systemDb } from '@/infrastructure/db';
import {
  SeasonPlanRepository,
  type PlanEntry,
  type PlanEntryFilters,
  type PlanEntryWithNames,
  type Season,
} from '@/infrastructure/persistence/repositories/season-plan.repository';

/**
 * Saisonplan (ADR-005). Die Datenbank (RLS) trennt Vereine; der Service prüft zusätzlich die
 * Rolle im Verein der Saison. Owner haben keine Membership — für sie systemDb.
 */
const READ_ROLES = ['admin', 'superadmin', 'trainer', 'member'];
const WRITE_ROLES = ['admin', 'superadmin'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

const GROUP_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#4f46e5',
  '#9333ea',
  '#c026d3',
  '#e11d48',
];
const FALLBACK_COLOR = '#6b7280';

export type CreateResult =
  | { entry: PlanEntry }
  | { conflicts: Pick<PlanEntry, 'id' | 'day_of_week' | 'start_time' | 'end_time'>[] };

export class SeasonPlanService {
  private readonly repo: SeasonPlanRepository;
  private readonly isOwner: boolean;

  constructor(private readonly auth: AuthContext) {
    this.isOwner = auth.role === 'owner';
    this.repo = new SeasonPlanRepository(
      this.isOwner
        ? systemDb('Owner: Saisonplan aller Vereine (keine Membership)')
        : getUserDb(auth)
    );
  }

  private async access(
    seasonId: string,
    allowed: string[]
  ): Promise<{ season: Season; role: string }> {
    const season = seasonId ? await this.repo.findSeason(seasonId) : null;
    if (!season) throw new ApiException('NOT_FOUND', 'Saison nicht gefunden');
    if (this.isOwner) return { season, role: 'owner' };
    const m = this.auth.memberships.find((x) => x.club_id === season.club_id);
    if (!m) throw new ApiException('FORBIDDEN', 'Kein Zugriff auf diese Saison');
    if (!allowed.includes(m.role)) {
      throw new ApiException('FORBIDDEN', 'Keine ausreichende Rolle für diese Saison');
    }
    return { season, role: m.role };
  }

  async list(seasonId: string, filters: PlanEntryFilters): Promise<PlanEntryWithNames[]> {
    await this.access(seasonId, READ_ROLES);
    return this.repo.listEntries(seasonId, filters);
  }

  /** Raster für den Kalender; Trainer/Mitglieder sehen nur die eigenen Slots. */
  async grid(seasonId: string) {
    const { season, role } = await this.access(seasonId, READ_ROLES);
    const [groups, courts, entries, ownTrainerId] = await Promise.all([
      this.repo.listActiveGroups(season.club_id),
      this.repo.listCourts(season.club_id),
      this.repo.listEntries(seasonId),
      role === 'trainer' ? this.repo.findTrainerIdByUser(this.auth.user.id) : null,
    ]);
    const color = new Map(groups.map((g, i) => [g.id, GROUP_COLORS[i % GROUP_COLORS.length]]));
    const participants = (e: PlanEntry): string[] =>
      Array.isArray(e.expected_participants) ? (e.expected_participants as string[]) : [];
    const names = await this.repo.userNames([...new Set(entries.flatMap(participants))]);

    const slots = entries.map((e) => {
      const ids = participants(e);
      return {
        id: e.id,
        group_id: e.group_id,
        group_name: e.group_name || 'Unbekannte Gruppe',
        group_color: (e.group_id && color.get(e.group_id)) || FALLBACK_COLOR,
        trainer_id: e.trainer_id,
        trainer_name: e.trainer_name || 'Unbekannt',
        substitute_trainer_id: e.substitute_trainer_id,
        court_id: e.court_id,
        court_name: e.court_name,
        day_of_week: e.day_of_week,
        start_time: e.start_time.substring(0, 5),
        end_time: e.end_time.substring(0, 5),
        duration_min: e.duration_minutes,
        member_ids: ids,
        member_names: ids.map((id) => names.get(id) || 'Unbekannt'),
        member_count: ids.length,
        status: e.status,
      };
    });

    const scoped =
      role === 'trainer'
        ? slots.filter(
            (s) => s.trainer_id === ownTrainerId || s.substitute_trainer_id === ownTrainerId
          )
        : role === 'member'
          ? slots.filter((s) => s.member_ids.includes(this.auth.user.id))
          : slots;

    return {
      slots: scoped,
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        color: color.get(g.id) || FALLBACK_COLOR,
        level: g.level,
        age_group: g.age_group,
      })),
      courts,
    };
  }

  async create(seasonId: string, body: CreatePlanEntryRequest): Promise<CreateResult> {
    const { season } = await this.access(seasonId, WRITE_ROLES);

    if (
      !body.trainer_id ||
      body.day_of_week === undefined ||
      !body.start_time ||
      !body.end_time ||
      !body.duration_minutes
    ) {
      throw new ApiException(
        'VALIDATION_ERROR',
        'Missing required fields: trainer_id, day_of_week, start_time, end_time, duration_minutes'
      );
    }
    if (body.day_of_week < 0 || body.day_of_week > 6) {
      throw new ApiException(
        'VALIDATION_ERROR',
        'day_of_week muss zwischen 0 (Montag) und 6 (Sonntag) liegen'
      );
    }
    // Sonntag ist spielfrei/Turniertag: Training nur Mo–Sa, andere entry_types dürfen auf Sonntag.
    const entryType = body.entry_type || 'training';
    if (body.day_of_week === 6 && entryType === 'training') {
      throw new ApiException(
        'VALIDATION_ERROR',
        'Trainingsstunden können nicht auf einen Sonntag gelegt werden (nur Mo-Sa).'
      );
    }
    if (!TIME.test(body.start_time) || !TIME.test(body.end_time)) {
      throw new ApiException('VALIDATION_ERROR', 'Zeiten müssen im Format HH:MM:SS sein');
    }
    if (body.start_time >= body.end_time) {
      throw new ApiException('VALIDATION_ERROR', 'start_time muss vor end_time liegen');
    }
    // IDs landen in einem PostgREST-Filter-String → nur echte UUIDs durchlassen.
    if (!UUID.test(body.trainer_id) || (body.court_id && !UUID.test(body.court_id))) {
      throw new ApiException('VALIDATION_ERROR', 'Ungültige trainer_id oder court_id');
    }

    const conflicts = await this.repo.findConflicts(
      seasonId,
      body.day_of_week,
      body.start_time,
      body.end_time,
      body.trainer_id,
      body.court_id || null
    );
    if (conflicts.length > 0) {
      return {
        conflicts: conflicts.map((c) => ({
          id: c.id,
          day_of_week: c.day_of_week,
          start_time: c.start_time,
          end_time: c.end_time,
        })),
      };
    }

    const entry = await this.repo.insertEntry({
      season_id: seasonId,
      club_id: season.club_id,
      trainer_id: body.trainer_id,
      court_id: body.court_id || null,
      group_id: body.group_id || null,
      day_of_week: body.day_of_week,
      start_time: body.start_time,
      end_time: body.end_time,
      duration_minutes: body.duration_minutes,
      starts_from_week: body.starts_from_week || 1,
      ends_at_week: body.ends_at_week || null,
      entry_type: entryType,
      planning_source: body.planning_source || 'manual',
      max_participants: body.max_participants || 10,
      expected_participants: body.expected_participants || [],
      notes: body.notes || null,
      admin_notes: body.admin_notes || null,
      status: 'planned',
    });
    return { entry };
  }
}
