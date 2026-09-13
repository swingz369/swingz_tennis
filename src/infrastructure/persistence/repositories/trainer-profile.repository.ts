/**
 * Trainer-Teildomäne "Profil" für ADR-005. `trainer_profiles` selbst ist
 * vollständig über RLS abgedeckt (trainer_profiles_admin_manage/
 * _member_view_active/_trainer_view/_trainer_update_own, alle bereits
 * vorhanden) und läuft über getUserDb(auth). Die `trainers`-Tabelle hat
 * dagegen **keine INSERT-Policy** — sie kann nicht existieren, bevor der
 * Trainer-Datensatz da ist, also kann RLS das Anlegen nicht anhand einer
 * bestehenden Zuordnung prüfen. `ensureTrainersRecord` braucht deshalb
 * bewusst systemDb() (ADR-005-Whitelist: Bootstrapping ohne RLS-fähigen
 * Ausgangszustand).
 *
 * Anders als die übrigen migrierten Domänen gibt dieses Repository NICHT
 * die rohe Tables<>-Zeile zurück, sondern mappt auf die camelCase-Entity
 * aus domain/entities/trainer.entity.ts — app/(protected)/trainer/profile/
 * page.tsx liest `detail.firstName`/`detail.hourlyRate`/... ohne
 * snake_case-Fallback, ein Wechsel auf rohe DB-Feldnamen hätte die Seite
 * gebrochen.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert } from '@/types/supabase';
import type { TrainerProfile, TrainerQualification } from '@/domain/entities/trainer.entity';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:trainer-profile.repository');

type Row = Tables<'trainer_profiles'>;

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

/**
 * Qualifikationen aus der JSONB-Spalte in die Entity-Form bringen.
 *
 * Die Spalte enthält historisch drei Formen: den erwarteten Objekt-Array
 * (`addQualification` schreibt ihn mit `id`), einen Array einfacher Strings
 * (`["DTB C-Lizenz"]`, so legt der Seed sie an) und bei älteren Zeilen einen
 * JSON-String, der einen solchen Array enthält. Ein reiner Cast behauptete
 * für alle drei den Objekt-Array: im Trainer-Detail fehlte dadurch `id`
 * (React meldete „unique key prop"), `name` blieb leer, und bei der
 * String-Form hätte `.map()` die Seite ganz abgeräumt.
 *
 * Die Ersatz-ID ist aus Position und Name gebildet und damit über Renders
 * stabil — ein reiner Index würde beim Löschen einer Zeile die Karten
 * darunter neu mounten.
 */
export function normalizeQualifications(raw: unknown): TrainerQualification[] {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw.trim() ? [raw] : [];
    }
  }
  if (!Array.isArray(value)) return [];

  return value.map((entry, i) => {
    if (typeof entry === 'string') {
      return {
        id: `legacy-${i}-${entry}`,
        name: entry,
        issuer: '',
        issuedDate: '',
        verified: false,
      };
    }
    const q = (entry ?? {}) as Partial<TrainerQualification>;
    return {
      ...q,
      id: q.id ?? `legacy-${i}-${q.name ?? ''}`,
      name: q.name ?? '',
      issuer: q.issuer ?? '',
      issuedDate: q.issuedDate ?? '',
      verified: q.verified ?? false,
    } as TrainerQualification;
  });
}

/**
 * NaN-Guard für numerische Spalten. PostgREST liefert `numeric`-Spalten als
 * String; fehlerhafte Legacy-Werte (Anführungszeichen, Textreste) lassen
 * parseFloat NaN zurückgeben, das die UI sonst als "NaN/h" gerendert hätte.
 */
export function parseNumericField(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  return null;
}

function mapToEntity(row: Row): TrainerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    dateOfBirth: row.date_of_birth,
    bio: row.bio ?? undefined,
    profileImageUrl: row.profile_image_url ?? undefined,
    qualifications: normalizeQualifications(row.qualifications),
    specializations: (row.specializations as unknown as TrainerProfile['specializations']) || [],
    experience: (row.experience as TrainerProfile['experience']) || {
      years: 0,
      previousClubs: [],
      achievements: [],
    },
    status: row.status as TrainerProfile['status'],
    hourlyRate: parseNumericField(row.hourly_rate) ?? undefined,
    contractedHourlyRate: parseNumericField(row.contracted_hourly_rate),
    extraHoursRate: parseNumericField(row.extra_hours_rate),
    availability: (row.availability as TrainerProfile['availability']) || {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    },
    preferredTimeSlots: (row.preferred_time_slots as TrainerProfile['preferredTimeSlots']) || [],
    languages: (row.languages as string[]) || ['Deutsch'],
    emergencyContact: (row.emergency_contact as TrainerProfile['emergencyContact']) || {
      name: '',
      phone: '',
      relationship: '',
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TrainerProfileRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async create(
    input: TablesInsert<'trainer_profiles'>,
    systemDb: AuthContext['supabase']
  ): Promise<TrainerProfile> {
    await this.ensureTrainersRecord(systemDb, input.user_id, input.email, input.first_name);

    const { data, error } = await this.db.from('trainer_profiles').insert(input).select().single();

    if (error) {
      // Duplicate key (23505): profile already exists — return it instead of erroring.
      if (error.code === '23505') {
        const existing = await this.findByUserId(input.user_id);
        if (existing) return existing;
      }
      assertNoError(error, 'Anlegen des Trainer-Profils fehlgeschlagen');
    }
    return mapToEntity(data!);
  }

  async findById(id: string): Promise<TrainerProfile | null> {
    const { data, error } = await this.db
      .from('trainer_profiles')
      .select()
      .eq('id', id)
      .maybeSingle();
    assertNoError(error, 'Lesen des Trainer-Profils fehlgeschlagen');
    return data ? mapToEntity(data) : null;
  }

  async findByUserId(userId: string): Promise<TrainerProfile | null> {
    const { data, error } = await this.db
      .from('trainer_profiles')
      .select()
      .eq('user_id', userId)
      .maybeSingle();
    assertNoError(error, 'Lesen des Trainer-Profils fehlgeschlagen');
    return data ? mapToEntity(data) : null;
  }

  async findByClubId(clubId: string): Promise<TrainerProfile[]> {
    const { data, error } = await this.db
      .from('trainer_profiles')
      .select()
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });
    assertNoError(error, 'Lesen der Trainer-Profile fehlgeschlagen');
    return (data ?? []).map(mapToEntity);
  }

  async update(
    id: string,
    input: Partial<TablesInsert<'trainer_profiles'>>
  ): Promise<TrainerProfile | null> {
    const { data, error } = await this.db
      .from('trainer_profiles')
      .update(input)
      .eq('id', id)
      .select()
      .maybeSingle();
    assertNoError(error, 'Aktualisieren des Trainer-Profils fehlgeschlagen');
    return data ? mapToEntity(data) : null;
  }

  async delete(id: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('trainer_profiles')
      .delete()
      .eq('id', id)
      .select('id');
    assertNoError(error, 'Löschen des Trainer-Profils fehlgeschlagen');
    return (data ?? []).length > 0;
  }

  /**
   * Stellt sicher, dass ein `trainers`-Datensatz mit `trainers.id = userId`
   * existiert (Legacy-FK-Kompatibilität: trainer_availabilities,
   * trainer_absences, sessions usw. zeigen alle auf trainers.id).
   * Gibt die tatsächlich zu verwendende trainers.id zurück — normalerweise
   * userId, außer eine E-Mail-Kollision mit abweichender ID existiert
   * bereits (dann kann diese ID wegen FK-Constraints nicht geändert werden).
   *
   * Braucht systemDb: `trainers` hat keine INSERT-RLS-Policy.
   */
  private async ensureTrainersRecord(
    systemDb: AuthContext['supabase'],
    userId: string,
    email: string,
    name: string
  ): Promise<string> {
    try {
      const trainerEmail = email || `${userId}@trainer.swingz.local`;
      const trainerName = name || 'Trainer';
      const now = new Date().toISOString();

      const { error: insertError } = await systemDb.from('trainers').insert({
        id: userId,
        // Dritter Pfad, der Trainer anlegt (neben members/invite und
        // members/bulk-import). Ohne user_id findet die Saisonplanung die
        // Präferenzen des Trainers nie — sie joint users.id = trainers.user_id.
        user_id: userId,
        email: trainerEmail,
        name: trainerName,
        specialties: [],
        max_hours_per_week: 30,
        is_active: true,
        created_at: now,
        updated_at: now,
      });
      if (insertError && insertError.code !== '23505') {
        log.error('ensureTrainersRecord: Insert fehlgeschlagen', new Error(insertError.message));
      }

      const { data: existingByEmail } = await systemDb
        .from('trainers')
        .select('id')
        .eq('email', trainerEmail)
        .limit(1)
        .maybeSingle();

      if (existingByEmail && existingByEmail.id !== userId) {
        log.error(
          `ensureTrainersRecord: E-Mail-Kollision — trainers.id=${existingByEmail.id} statt erwartetem ${userId} für "${trainerEmail}". ` +
            `Trainer-Verfügbarkeitsabfragen nutzen ${existingByEmail.id}.`
        );
        await systemDb
          .from('trainers')
          .update({ name: trainerName, is_active: true, updated_at: now })
          .eq('id', existingByEmail.id);
        return existingByEmail.id;
      }

      return userId;
    } catch (err) {
      log.error(
        `ensureTrainersRecord: unerwarteter Fehler für userId=${userId}, email=${email}`,
        err instanceof Error ? err : new Error(String(err))
      );
      return userId; // best effort — Profilerstellung nicht blockieren
    }
  }
}
