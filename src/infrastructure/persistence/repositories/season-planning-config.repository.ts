/**
 * Planungs-Konfiguration je Saison (ADR-005): Supabase-Client mit RLS statt Drizzle.
 * Die Policies erlauben nur Vereins-Admins (`is_club_admin`, schließt Superadmin je Verein ein).
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:season-planning-config.repository');

export type Season = Tables<'seasons'>;
export type PlanningConfig = Tables<'season_planning_configs'>;

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

export class SeasonPlanningConfigRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async findSeason(seasonId: string): Promise<Season | null> {
    const { data, error } = await this.db.from('seasons').select().eq('id', seasonId).maybeSingle();
    assertNoError(error, 'Lesen der Saison fehlgeschlagen');
    return data;
  }

  async find(seasonId: string): Promise<PlanningConfig | null> {
    const { data, error } = await this.db
      .from('season_planning_configs')
      .select()
      .eq('season_id', seasonId)
      .maybeSingle();
    assertNoError(error, 'Lesen der Planungs-Konfiguration fehlgeschlagen');
    return data;
  }

  async insert(input: TablesInsert<'season_planning_configs'>): Promise<PlanningConfig> {
    const { data, error } = await this.db
      .from('season_planning_configs')
      .insert(input)
      .select()
      .single();
    assertNoError(error, 'Speichern der Planungs-Konfiguration fehlgeschlagen');
    return data!;
  }

  /** `null`, wenn RLS die Zeile nicht zum Ändern freigibt. */
  async update(id: string, patch: TablesUpdate<'season_planning_configs'>) {
    const { data, error } = await this.db
      .from('season_planning_configs')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();
    assertNoError(error, 'Ändern der Planungs-Konfiguration fehlgeschlagen');
    return data;
  }
}
