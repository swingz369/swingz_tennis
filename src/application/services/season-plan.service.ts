import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import type { CreatePlanEntryRequest, UpdatePlanEntryRequest } from '@/lib/types/season-planning';
import type { ScheduleSlot } from '@/lib/season-planning/types';
import type { TablesUpdate } from '@/types/supabase';
import { createLogger } from '@/lib/logger';
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
const log = createLogger('season-plan-service');

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

/** Spalten, die PATCH aus dem Request übernimmt (alles andere wird ignoriert). */
const UPDATABLE = [
  'trainer_id',
  'court_id',
  'group_id',
  'day_of_week',
  'start_time',
  'end_time',
  'duration_minutes',
  'starts_from_week',
  'ends_at_week',
  'entry_type',
  'planning_source',
  'max_participants',
  'expected_participants',
  'status',
  'notes',
  'admin_notes',
  'substitute_trainer_id',
  'substitute_from_week',
  'substitute_to_week',
] as const;

/** "09:30" | "09:30:00" → "09:30:00" (Spaltentyp ist `time`) */
function toSqlTime(value: string): string {
  const [h = '00', m = '00'] = value.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
}

export type ApplyPlanResult = {
  /** Anzahl tatsächlich aktualisierter Termine */
  applied: number;
  /** Gruppen aus der Vorlage, zu denen es keinen Termin mehr gibt */
  missingGroupNames: string[];
};

export type UpdateResult =
  | { entry: PlanEntry; promoted: { memberId: string; position: number }[] }
  | { conflicts: Pick<PlanEntry, 'id' | 'day_of_week' | 'start_time' | 'end_time'>[] };

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

  async get(seasonId: string, entryId: string): Promise<PlanEntryWithNames> {
    await this.access(seasonId, READ_ROLES);
    return this.entryOrThrow(seasonId, entryId);
  }

  async update(
    seasonId: string,
    entryId: string,
    body: UpdatePlanEntryRequest
  ): Promise<UpdateResult> {
    await this.access(seasonId, WRITE_ROLES);
    const existing = await this.entryOrThrow(seasonId, entryId);

    const patch: Record<string, unknown> = {};
    for (const key of UPDATABLE) if (body[key] !== undefined) patch[key] = body[key];

    if (body.day_of_week !== undefined && (body.day_of_week < 0 || body.day_of_week > 6)) {
      throw new ApiException('VALIDATION_ERROR', 'day_of_week muss zwischen 0 und 6 liegen');
    }
    // Vereinsrealität: regulärer Trainingsbetrieb findet nicht sonntags statt.
    const entryType = body.entry_type ?? existing.entry_type;
    const day = (patch.day_of_week as number | undefined) ?? existing.day_of_week;
    if (day === 6 && entryType === 'training') {
      throw new ApiException(
        'VALIDATION_ERROR',
        'Trainingsstunden können nicht auf einen Sonntag gelegt werden (nur Mo-Sa).'
      );
    }
    // Nur unbekannte Felder: kein Update möglich — Eingabefehler, kein 500er.
    if (Object.keys(patch).length === 0) {
      throw new ApiException(
        'VALIDATION_ERROR',
        'Keine bekannten Felder im Request — nichts zu ändern'
      );
    }
    const start = (patch.start_time as string | undefined) || existing.start_time;
    const end = (patch.end_time as string | undefined) || existing.end_time;
    if (start >= end) {
      throw new ApiException('VALIDATION_ERROR', 'start_time muss vor end_time liegen');
    }

    if (
      body.day_of_week !== undefined ||
      body.start_time !== undefined ||
      body.end_time !== undefined ||
      body.trainer_id !== undefined ||
      body.court_id !== undefined
    ) {
      const conflicts = await this.repo.findConflicts(
        seasonId,
        day,
        start,
        end,
        (patch.trainer_id as string | undefined) ?? existing.trainer_id,
        (patch.court_id as string | null | undefined) ?? existing.court_id,
        entryId
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
    }

    const entry = await this.repo.updateEntry(
      entryId,
      patch as TablesUpdate<'season_plan_entries'>
    );

    // Wurde die Teilnehmerliste kleiner, ist ein Platz frei geworden — dann rückt die
    // Saison-Warteliste automatisch nach. Ohne das bliebe der Platz leer, während jemand wartet.
    let promoted: { memberId: string; position: number }[] = [];
    const groupId = entry.group_id ?? existing.group_id;
    if (body.expected_participants !== undefined && groupId) {
      const before = ((existing.expected_participants as string[] | null) ?? []).length;
      if (body.expected_participants.length < before) {
        promoted = await this.promoteFromWaitlist(seasonId, groupId);
      }
    }
    return { entry, promoted };
  }

  async remove(seasonId: string, entryId: string): Promise<void> {
    await this.access(seasonId, WRITE_ROLES);
    const existing = await this.entryOrThrow(seasonId, entryId);
    if (existing.status === 'published' || existing.status === 'active') {
      throw new ApiException(
        'VALIDATION_ERROR',
        'Veröffentlichte oder aktive Einträge können nicht gelöscht werden'
      );
    }
    await this.repo.deleteEntry(entryId);
  }

  /**
   * Schreibt den im Wizard bearbeiteten Wochenstundenplan zurück in season_plan_entries.
   * Zuordnung über group_id (= ScheduleSlot.id), seit dem Dedupe in clustering-engine.ts
   * pro Plan eindeutig. Ohne dieses Zurückschreiben ginge jede Drag-&-Drop-Korrektur beim
   * Publish verloren, weil confirm die Termine aus der Datenbank liest.
   */
  async applySlots(seasonId: string, slots: ScheduleSlot[]): Promise<ApplyPlanResult> {
    await this.access(seasonId, WRITE_ROLES);
    const entries = await this.repo.listEntries(seasonId);
    const idsByGroup = new Map<string, string[]>();
    for (const e of entries) {
      if (!e.group_id) continue;
      idsByGroup.set(e.group_id, [...(idsByGroup.get(e.group_id) ?? []), e.id]);
    }

    let applied = 0;
    const missingGroupNames: string[] = [];
    for (const slot of slots) {
      const ids = idsByGroup.get(slot.id);
      if (!ids?.length) {
        // Vorkommen: Stand nach einer Neugenerierung zurückgeholt, Gruppe entstand nicht mehr.
        missingGroupNames.push(slot.groupName);
        continue;
      }
      await this.repo.updateEntries(ids, {
        day_of_week: slot.dayOfWeek,
        start_time: toSqlTime(slot.startTime),
        end_time: toSqlTime(slot.endTime),
        duration_minutes: slot.durationMin,
        court_id: slot.courtId,
        expected_participants: slot.memberIds,
        // Der Bearbeiten-Dialog ändert nur den Trainer-Namen, nicht die ID — sonst kippt der FK.
        ...(UUID.test(slot.trainerId) ? { trainer_id: slot.trainerId } : {}),
        planning_source: 'manual',
        updated_at: new Date().toISOString(),
      });
      applied += ids.length;
    }
    return { applied, missingGroupNames };
  }

  private async entryOrThrow(seasonId: string, entryId: string): Promise<PlanEntryWithNames> {
    const entry = await this.repo.findEntry(seasonId, entryId);
    if (!entry) throw new ApiException('NOT_FOUND', 'Plan-Eintrag nicht gefunden');
    return entry;
  }

  /**
   * Nachrücken von der Saison-Warteliste (`season_waitlists`, nicht `session_waitlist` — die
   * gilt für einen einzelnen Termin). Ein Mitglied rückt nur nach, wenn in ALLEN Terminen der
   * Gruppe Platz ist: Eine Gruppe mit zwei Einheiten pro Woche ist eine Einheit, kein halber Platz.
   */
  private async promoteFromWaitlist(
    seasonId: string,
    groupId: string
  ): Promise<{ memberId: string; position: number }[]> {
    const entries = await this.repo.listEntries(seasonId, { groupId });
    if (entries.length === 0) return [];
    const participants = new Map(
      entries.map((e) => [e.id, ((e.expected_participants as string[] | null) ?? []).slice()])
    );
    const freeSeats = Math.min(
      ...entries.map((e) =>
        Math.max(0, (e.max_participants ?? 0) - (participants.get(e.id) ?? []).length)
      )
    );
    if (freeSeats <= 0) return [];

    const promoted: { memberId: string; position: number }[] = [];
    for (const candidate of (await this.repo.listWaiting(seasonId, groupId)).slice(0, freeSeats)) {
      for (const entry of entries) {
        const list = participants.get(entry.id)!;
        if (list.includes(candidate.member_id)) continue;
        list.push(candidate.member_id);
        await this.repo.updateEntry(entry.id, { expected_participants: list });
      }
      await this.repo.markWaitlistAccepted(candidate.id);
      promoted.push({ memberId: candidate.member_id, position: candidate.position ?? 0 });
    }
    if (promoted.length > 0) {
      log.info('Von der Warteliste nachgerückt', { seasonId, groupId, members: promoted.length });
    }
    return promoted;
  }
}
