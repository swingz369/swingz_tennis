import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { formatDateTime } from '@/lib/format';
import type { ScheduleSlot } from '@/lib/season-planning/types';
import { getUserDb, systemDb } from '@/infrastructure/db';
import {
  SeasonPlanningRepository,
  type Season,
  type Trainer,
} from '@/infrastructure/persistence/repositories/season-planning.repository';

/** Ältere Stände fallen raus — ein Verein vergleicht ein paar Fassungen, kein Archiv. */
const MAX_VERSIONS = 10;

/**
 * Saisonplanung, Hilfsdaten (ADR-005). Nur Vereins-Admins; RLS trennt die Vereine, der Service
 * prüft zusätzlich die Rolle im Verein der Saison. Owner haben keine Membership → systemDb.
 * Schreibvorgänge über mehrere Zeilen sind nicht atomar (ponytail: RPC, falls Abbrüche stören).
 */
export class SeasonPlanningService {
  private readonly repo: SeasonPlanningRepository;
  private readonly isOwner: boolean;

  constructor(private readonly auth: AuthContext) {
    this.isOwner = auth.role === 'owner';
    this.repo = new SeasonPlanningRepository(
      this.isOwner ? systemDb('Owner: Saisonplanung aller Vereine') : getUserDb(auth)
    );
  }

  /** Saison laden und Admin-Rolle im Verein prüfen. */
  async season(seasonId: string): Promise<Season> {
    const season = seasonId ? await this.repo.findSeason(seasonId) : null;
    if (!season) throw new ApiException('NOT_FOUND', 'Saison nicht gefunden');
    if (this.isOwner) return season;
    const isAdmin = this.auth.memberships.some(
      (m) => m.club_id === season.club_id && (m.role === 'admin' || m.role === 'superadmin')
    );
    if (!isAdmin) throw new ApiException('FORBIDDEN', 'Kein Zugriff auf diese Saison');
    return season;
  }

  // ── Inaktive Wochen ───────────────────────────────────────────────
  async listWeeks(seasonId: string) {
    await this.season(seasonId);
    return (await this.repo.listGroupWeeks(seasonId)).map(({ id: _id, ...w }) => w);
  }

  async setWeeks(
    seasonId: string,
    weeks: Array<{ groupId: string; weekNumber: number; isActive: boolean }>
  ): Promise<number> {
    const season = await this.season(seasonId);
    if (!Array.isArray(weeks))
      throw new ApiException('VALIDATION_ERROR', 'weeks muss ein Array sein');

    const existing = new Map(
      (await this.repo.listGroupWeeks(seasonId)).map((w) => [
        `${w.group_id}:${w.week_number}`,
        w.id,
      ])
    );
    const start = new Date(season.start_date);
    const inserts = [];
    for (const w of weeks) {
      const id = existing.get(`${w.groupId}:${w.weekNumber}`);
      if (id) {
        await this.repo.updateGroupWeek(id, w.isActive);
      } else if (!w.isActive) {
        const monday = new Date(start);
        monday.setUTCDate(monday.getUTCDate() + (w.weekNumber - 1) * 7);
        inserts.push({
          season_id: seasonId,
          group_id: w.groupId,
          club_id: season.club_id,
          week_number: w.weekNumber,
          week_monday: monday.toISOString().slice(0, 10),
          is_active: false,
        });
      }
    }
    await this.repo.insertGroupWeeks(inserts);
    return weeks.length;
  }

  // ── Warteliste ────────────────────────────────────────────────────
  async waitlist(seasonId: string) {
    await this.season(seasonId);
    return this.repo.listWaitlist(seasonId);
  }

  async promote(seasonId: string, waitlistId: string, promoteToGroupId?: string): Promise<void> {
    const season = await this.season(seasonId);
    if (!waitlistId) throw new ApiException('VALIDATION_ERROR', 'waitlistId erforderlich');

    const entry = await this.repo.findWaitlistEntry(waitlistId);
    if (!entry || entry.season_id !== seasonId || entry.club_id !== season.club_id) {
      throw new ApiException('NOT_FOUND', 'Wartelisten-Eintrag nicht gefunden');
    }

    const targets = await this.repo.listEntriesForGroup(
      seasonId,
      promoteToGroupId || entry.group_id
    );
    if (targets.length === 0) {
      throw new ApiException(
        'VALIDATION_ERROR',
        'Keine Trainingstermine für die Zielgruppe gefunden'
      );
    }
    const people = (e: { expected_participants: unknown }) =>
      (e.expected_participants as string[]) || [];
    if (
      targets.some(
        (e) => !people(e).includes(entry.member_id) && people(e).length >= e.max_participants
      )
    ) {
      throw new ApiException('CONFLICT', 'Zielgruppe hat keinen freien Platz mehr');
    }

    for (const e of targets) {
      if (!people(e).includes(entry.member_id)) {
        await this.repo.setParticipants(e.id, [...people(e), entry.member_id]);
      }
    }
    const now = new Date().toISOString();
    await this.repo.updateWaitlist(waitlistId, {
      status: 'accepted',
      accepted_at: now,
      alternative_group_id: promoteToGroupId || null,
      alternative_assigned_at: now,
    });
  }

  // ── Planstände ────────────────────────────────────────────────────
  async versions(seasonId: string) {
    await this.season(seasonId);
    return this.repo.listVersions(seasonId);
  }

  async saveVersion(seasonId: string, slots: ScheduleSlot[] | undefined, label?: string) {
    const season = await this.season(seasonId);
    if (!Array.isArray(slots) || slots.length === 0) {
      throw new ApiException('VALIDATION_ERROR', 'Kein Plan zum Speichern');
    }
    const created = await this.repo.insertVersion({
      season_id: seasonId,
      club_id: season.club_id,
      created_by: this.auth.user.id,
      label: label?.trim().slice(0, 100) || `Stand ${formatDateTime(new Date())}`,
      slots: slots as never,
    });
    const obsolete = (await this.repo.listVersionIds(seasonId)).slice(MAX_VERSIONS);
    if (obsolete.length > 0) await this.repo.deleteVersions(obsolete);
    return created;
  }

  async versionSlots(seasonId: string, versionId: string): Promise<ScheduleSlot[]> {
    await this.season(seasonId);
    if (!versionId) throw new ApiException('VALIDATION_ERROR', 'versionId erforderlich');
    const version = await this.repo.findVersion(seasonId, versionId);
    if (!version) throw new ApiException('NOT_FOUND', 'Planstand nicht gefunden');
    return (version.slots ?? []) as unknown as ScheduleSlot[];
  }

  // ── Datenbasis für die Übersichten (Berechnung bleibt in der Route) ─
  async preferencesSummaryData(seasonId: string) {
    const season = await this.season(seasonId);
    const [prefs, eligible, stats] = await Promise.all([
      this.repo.listMemberPreferences(seasonId),
      this.repo.countPlannableMembers(season.club_id),
      this.repo.listStatistics(season.club_id),
    ]);
    return { prefs, eligible, stats };
  }

  async trainerOverviewData(seasonId: string) {
    const season = await this.season(seasonId);
    const [prefs, entries, config] = await Promise.all([
      this.repo.listSubmittedTrainerPreferences(seasonId),
      this.repo.listEntries(seasonId),
      this.repo.findPlanningConfig(seasonId),
    ]);
    const prefTrainers = await this.repo.trainersByUserIds(prefs.map((p) => p.pref.user_id));
    const byUser = new Map(prefTrainers.map((t) => [t.user_id, t]));
    const trainerPrefs = prefs.flatMap((p) => {
      const trainer = byUser.get(p.pref.user_id);
      return trainer ? [{ ...p, trainer }] : [];
    });

    let clubTrainers: Trainer[] = await this.repo.activeClubTrainers(season.club_id);
    if (clubTrainers.length === 0) {
      const userIds = await this.repo.trainerMembershipUserIds(season.club_id);
      clubTrainers = (await this.repo.trainersByUserIds(userIds)).filter((t) => t.is_active);
    }
    return { trainerPrefs, clubTrainers, entries, config };
  }
}
