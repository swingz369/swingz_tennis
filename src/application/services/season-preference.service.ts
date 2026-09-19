import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import type { Json, TablesInsert, TablesUpdate } from '@/types/supabase';
import type {
  SubmitPreferencesRequest,
  UpdatePreferencesRequest,
} from '@/lib/types/season-planning';
import { getUserDb } from '@/infrastructure/db';
import {
  SeasonPreferenceRepository,
  type Preference,
  type PreferenceWithUser,
  type Season,
} from '@/infrastructure/persistence/repositories/season-preference.repository';

/**
 * Saison-Präferenzen (ADR-005). Fachregeln hier, Datenzugriff im Repository, Mandantentrennung
 * in der Datenbank (RLS). Die Vereinsprüfung im Service ist zusätzlich (Rolle im Verein der Saison).
 */
export class SeasonPreferenceService {
  private readonly repo: SeasonPreferenceRepository;

  constructor(private readonly auth: AuthContext) {
    this.repo = new SeasonPreferenceRepository(getUserDb(auth));
  }

  private get userId(): string {
    return this.auth.user.id;
  }

  private isMember(season: Season): boolean {
    return this.auth.memberships.some((m) => m.club_id === season.club_id);
  }

  private isClubAdmin(season: Season): boolean {
    return this.auth.memberships.some(
      (m) => m.club_id === season.club_id && (m.role === 'admin' || m.role === 'superadmin')
    );
  }

  private async season(seasonId: string): Promise<Season> {
    const season = await this.repo.findSeason(seasonId);
    if (!season) throw new ApiException('NOT_FOUND', 'Saison nicht gefunden');
    return season;
  }

  async list(
    seasonId: string,
    filters: { userId?: string; userRole?: string; isSubmitted?: boolean }
  ): Promise<PreferenceWithUser[]> {
    const season = await this.season(seasonId);
    if (!this.isMember(season))
      throw new ApiException('FORBIDDEN', 'Kein Zugriff auf diese Saison');
    // Nicht-Admins: nur die eigene Zeile (RLS erzwingt das ohnehin, hier zur Klarheit).
    return this.repo.findBySeason(
      seasonId,
      this.isClubAdmin(season) ? filters : { userId: this.userId }
    );
  }

  async get(seasonId: string, userId: string): Promise<PreferenceWithUser> {
    const season = await this.season(seasonId);
    if (userId !== this.userId && !this.isClubAdmin(season)) {
      throw new ApiException('FORBIDDEN', 'Du kannst nur deine eigenen Präferenzen einsehen');
    }
    const preference = await this.repo.findOne(seasonId, userId);
    if (!preference) throw new ApiException('NOT_FOUND', 'Präferenz nicht gefunden');
    return preference;
  }

  /** Eigene Präferenz anlegen oder aktualisieren. `created` steuert 201 vs. 200. */
  async submit(
    seasonId: string,
    body: SubmitPreferencesRequest
  ): Promise<{ preference: Preference; created: boolean }> {
    const season = await this.season(seasonId);
    if (!this.isMember(season))
      throw new ApiException('FORBIDDEN', 'Kein Zugriff auf diese Saison');
    if (!season.preferences_open) {
      throw new ApiException(
        'VALIDATION_ERROR',
        'Präferenzen sind für diese Saison nicht geöffnet'
      );
    }
    if (season.preferences_deadline && new Date() > new Date(season.preferences_deadline)) {
      throw new ApiException('VALIDATION_ERROR', 'Präferenzfrist ist abgelaufen');
    }
    if (!body.user_role || !body.weekly_availability) {
      throw new ApiException(
        'VALIDATION_ERROR',
        'Pflichtfelder fehlen: user_role, weekly_availability'
      );
    }

    const fields = {
      user_role: body.user_role,
      preferred_level: body.preferred_level || null,
      preferred_age_group: body.preferred_age_group || null,
      preferred_group_ids: body.preferred_group_ids || [],
      weekly_availability: body.weekly_availability as unknown as Json,
      unavailable_dates: body.unavailable_dates || [],
      max_sessions_per_week: body.max_sessions_per_week || null,
      preferred_court_ids: body.preferred_court_ids || [],
      can_teach_groups: body.can_teach_groups || [],
      priority: body.priority || 5,
      special_requests: body.special_requests || null,
      notes: body.notes || null,
      is_submitted: true,
      submitted_at: new Date().toISOString(),
    };

    const existing = await this.repo.findOne(seasonId, this.userId);
    if (existing) {
      const updated = await this.repo.update(existing.id, fields);
      if (!updated) throw new ApiException('FORBIDDEN', 'Präferenz kann nicht geändert werden');
      return { preference: updated, created: false };
    }
    const input: TablesInsert<'user_training_preferences'> = {
      ...fields,
      season_id: seasonId,
      user_id: this.userId,
      club_id: season.club_id,
    };
    return { preference: await this.repo.insert(input), created: true };
  }

  async update(
    seasonId: string,
    userId: string,
    body: UpdatePreferencesRequest
  ): Promise<Preference> {
    const season = await this.season(seasonId);
    const isAdmin = this.isClubAdmin(season);
    if (userId !== this.userId && !isAdmin) {
      throw new ApiException('FORBIDDEN', 'Du kannst nur deine eigenen Präferenzen ändern');
    }
    if (!season.preferences_open && !isAdmin) {
      throw new ApiException(
        'VALIDATION_ERROR',
        'Präferenzen sind für diese Saison nicht geöffnet'
      );
    }
    const existing = await this.repo.findOne(seasonId, userId);
    if (!existing) throw new ApiException('NOT_FOUND', 'Präferenz nicht gefunden');

    const patch: TablesUpdate<'user_training_preferences'> = {};
    if (body.user_role !== undefined) patch.user_role = body.user_role;
    if (body.preferred_level !== undefined) patch.preferred_level = body.preferred_level;
    if (body.preferred_age_group !== undefined)
      patch.preferred_age_group = body.preferred_age_group;
    if (body.preferred_group_ids !== undefined)
      patch.preferred_group_ids = body.preferred_group_ids;
    if (body.weekly_availability !== undefined)
      patch.weekly_availability = body.weekly_availability as unknown as Json;
    if (body.unavailable_dates !== undefined) patch.unavailable_dates = body.unavailable_dates;
    if (body.max_sessions_per_week !== undefined)
      patch.max_sessions_per_week = body.max_sessions_per_week;
    if (body.preferred_court_ids !== undefined)
      patch.preferred_court_ids = body.preferred_court_ids;
    if (body.can_teach_groups !== undefined) patch.can_teach_groups = body.can_teach_groups;
    if (body.priority !== undefined) patch.priority = body.priority;
    if (body.special_requests !== undefined) patch.special_requests = body.special_requests;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.is_submitted !== undefined) {
      patch.is_submitted = body.is_submitted;
      if (body.is_submitted) patch.submitted_at = new Date().toISOString();
    }

    const updated = await this.repo.update(existing.id, patch);
    if (!updated) throw new ApiException('FORBIDDEN', 'Präferenz kann nicht geändert werden');
    return updated;
  }

  async remove(seasonId: string, userId: string): Promise<void> {
    const season = await this.season(seasonId);
    if (userId !== this.userId && !this.isClubAdmin(season)) {
      throw new ApiException('FORBIDDEN', 'Du kannst nur deine eigenen Präferenzen löschen');
    }
    const existing = await this.repo.findOne(seasonId, userId);
    if (!existing) throw new ApiException('NOT_FOUND', 'Präferenz nicht gefunden');
    if (!(await this.repo.delete(existing.id))) {
      throw new ApiException('FORBIDDEN', 'Präferenz kann nicht gelöscht werden');
    }
  }
}
