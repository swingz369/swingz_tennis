/**
 * Saison-Präferenzen (ADR-005): Supabase-Client mit RLS statt Drizzle. Die Mandantentrennung
 * erzwingt die Datenbank — eine fremde Saison oder Präferenz liefert hier schlicht `null`.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:season-preference.repository');

export type Season = Tables<'seasons'>;
export type Preference = Tables<'user_training_preferences'>;
export type PreferenceWithUser = Preference & {
  user_name: string | null;
  user_email: string | null;
};

const WITH_USER = '*, users(full_name, email)';

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

function flatten(
  row: Preference & { users: { full_name: string | null; email: string | null } | null }
): PreferenceWithUser {
  const { users, ...preference } = row;
  return { ...preference, user_name: users?.full_name ?? null, user_email: users?.email ?? null };
}

export class SeasonPreferenceRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async findSeason(seasonId: string): Promise<Season | null> {
    const { data, error } = await this.db.from('seasons').select().eq('id', seasonId).maybeSingle();
    assertNoError(error, 'Lesen der Saison fehlgeschlagen');
    return data;
  }

  async findBySeason(
    seasonId: string,
    filters: { userId?: string; userRole?: string; isSubmitted?: boolean } = {}
  ): Promise<PreferenceWithUser[]> {
    let query = this.db
      .from('user_training_preferences')
      .select(WITH_USER)
      .eq('season_id', seasonId);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.userRole) query = query.eq('user_role', filters.userRole);
    if (filters.isSubmitted !== undefined) query = query.eq('is_submitted', filters.isSubmitted);
    const { data, error } = await query.order('submitted_at', { ascending: false });
    assertNoError(error, 'Lesen der Präferenzen fehlgeschlagen');
    return (data ?? []).map((row) => flatten(row as never));
  }

  async findOne(seasonId: string, userId: string): Promise<PreferenceWithUser | null> {
    const { data, error } = await this.db
      .from('user_training_preferences')
      .select(WITH_USER)
      .eq('season_id', seasonId)
      .eq('user_id', userId)
      .maybeSingle();
    assertNoError(error, 'Lesen der Präferenz fehlgeschlagen');
    return data ? flatten(data as never) : null;
  }

  async insert(input: TablesInsert<'user_training_preferences'>): Promise<Preference> {
    const { data, error } = await this.db
      .from('user_training_preferences')
      .insert(input)
      .select()
      .single();
    assertNoError(error, 'Speichern der Präferenz fehlgeschlagen');
    return data!;
  }

  /** `null`, wenn RLS die Zeile nicht zum Ändern freigibt. */
  async update(
    id: string,
    patch: TablesUpdate<'user_training_preferences'>
  ): Promise<Preference | null> {
    const { data, error } = await this.db
      .from('user_training_preferences')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();
    assertNoError(error, 'Ändern der Präferenz fehlgeschlagen');
    return data;
  }

  async delete(id: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('user_training_preferences')
      .delete()
      .eq('id', id)
      .select('id');
    assertNoError(error, 'Löschen der Präferenz fehlgeschlagen');
    return (data ?? []).length > 0;
  }
}
